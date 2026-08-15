# Architecture Decisions

## Node como backend
No crear un backend separado para procesamiento. Simplifica despliegue y permite compartir SQLite, filesystem y configuración.

## FFmpeg externo
Usar FFmpeg como proceso externo. Es compatible con Windows y Ubuntu y coincide con el flujo actual.

## No depender de WSL
WSL seguirá sirviendo para rsync y herramientas locales, pero el nuevo upload web debe funcionar directamente con Node + FFmpeg.

## Un procesamiento simultáneo
Primero uno. Evita complejidad y permite medir recursos antes de introducir concurrencia.

## Estado en memoria
Inicialmente no persistir jobs en SQLite. Si hace falta, se añadirá posteriormente una tabla de jobs.

## No registrar antes de finalizar
SQLite representa vídeos disponibles. Un vídeo en proceso no pertenece todavía al catálogo.

## Tags como segunda fase
El MVP crea vídeos sin tags. Después se puede reutilizar el catálogo y los casos de uso actuales para introducir tags durante el upload.

## Local primero
El desarrollo y las pruebas deben hacerse primero en local. El despliegue remoto debería cambiar principalmente paths, FFmpeg y límites de recursos, no la arquitectura.

## VideoProcessor como port, FFmpeg como adapter
M1 definió `VideoProcessor`. M2 lo implementa en `FfmpegVideoProcessor`
invocando `ffmpeg` y `ffprobe` con `spawn` (sin `shell`). Las rutas salen de
`FFMPEG_PATH` y `FFPROBE_PATH`.

## Parámetros de conversión tomados del script PowerShell
`tools/convert-hevc-with-thumbnails-and-sync.ps1` es la referencia de flags ya
probados. No forma parte del backend: Node no lo copia ni lo ejecuta.

Conversión:

- `-map 0:v:0 -map 0:a?`
- `-c:v libx264 -crf 20 -preset medium`
- `-c:a aac -b:a 128k`
- `-map_metadata 0`
- `-movflags +faststart`

Thumbnail (del vídeo convertido, como el script):

- `-ss` al `positionRatio` de la duración (0.5 = 50%)
- `-frames:v 1`
- `-vf scale=281:500:force_original_aspect_ratio=increase,crop=281:500`
- `-q:v 2`

El script no añade flags de rotación; el adapter tampoco. FFmpeg aplica su
autorotate por defecto al reencodificar.

FFmpeg 9 rechaza el JPEG del script (`Non full-range YUV is non-standard`).
El adapter añade `-strict unofficial` para que el encoder mjpeg acepte el YUV
de rango limitado y conserve el recorte 281×500. `-pix_fmt yuvj420p` redondearía
el ancho impar a 280. No cambia seek, calidad ni el filtro de escala/recorte.

`ffprobe` usa JSON (`-print_format json`) en lugar del texto del script, para
no depender del idioma de la salida.

`VideoProcessor.convert` siempre convierte. La decisión de cuándo hacerlo
pertenece al use case: solo `hevc` se convierte a H.264. H.264 y el resto de
codecs conservan la copia staged y no llaman a `convert()`.

El layout TagSpaces `.ts/<filename>.jpg` lo aplica M5 al instalar. M2/M3
escriben `thumbnail.jpg` en el workspace temporal.

## ProcessVideoJobUseCase
M3 orquesta un job completo sin HTTP. Dependencias: `VideoProcessor`,
`ProcessingWorkspace`, `ProcessingJobStore` (en memoria).

- Éxito: el workspace se conserva para que M5 instale el resultado.
- Error: `failed` y se descarta el workspace.
- Un segundo job activo se rechaza con `ActiveProcessingJobError` (HTTP 409 en M4).
- `completed.videoId` es el id de biblioteca: el nombre original si ya incluye
  fecha, o el `PXL_YYYYMMDD_HHMMSSmmm` generado desde metadatos cuando el
  selector no entrega esa fecha. M5 instala con ese id.
- `ProcessingWorkspace.stageSource` copia el input a `sourcePath` sin modificar
  el original. Así un H.264 también queda en el workspace.
- HTTP (M4) no copia: `begin()` prepara el workspace, el adapter escribe el
  stream en `sourcePath`, y `processStaged()` continúa el pipeline hasta
  `finalizing`. El CLI `execute()` marca `completed` sin instalar.
- M5 (`CompleteUploadUseCase` / `InstallProcessedUploadUseCase`) instala
  después de `processStaged`: `installing` → ficheros → SQLite → índice →
  `completed`.

## Upload HTTP asíncrono (M6.1)
`POST /api/admin/uploads` ya no espera a FFmpeg. Tras validar y escribir el
fichero en el workspace responde `202` y `BackgroundUploadJobRunner` continúa
con `CompleteUploadUseCase`. Los errores de background marcan el job `failed`,
aplican la compensación de M5 y se registran en logs del servidor; no producen
unhandled rejections. `GET /api/admin/uploads/:jobId` es la fuente de estado
para el cliente. Los jobs siguen en memoria: no hay persistencia ni reanudación
tras un reinicio de Node. No hay cola.

## UI de subida y seguimiento (M6.2)
La administración sube y sigue el vídeo en `/admin/videos/upload`. Al entrar,
consulta `GET /api/admin/uploads/active` y retoma el polling si hay un job
`uploading` o `processing`. El intervalo es 1 s; se detiene en
`completed`/`failed`, en `404` y al desmontar. Un fallo de red en el polling
no marca el job como fallido. Tras completar, **View in Sin tags** abre el
catálogo con `GET /api/search` + `GET /api/tags`, no con refresh del
filesystem. El porcentaje de conversión sale de FFmpeg `-progress`
(`out_time` / duración de ffprobe), se guarda en el job en memoria y se lee
con el polling; no hay WebSockets ni SSE. Un H.264 sin conversión deja
`progress` en `null`. Los jobs siguen sin persistirse en SQLite.

## VideoStore y ThumbnailStore siguen siendo de lectura
No se amplían para escribir temporales ni archivos nuevos. El workspace de un
job es `ProcessingWorkspace`. La instalación definitiva usa el port
`LibraryMediaInstaller` (`FilesystemLibraryMediaInstaller`): solo coloca el
resultado de un upload nuevo. Nunca muta TagSpaces JSON ni ficheros existentes.

## Estado de job como union discriminado
`status` es el ciclo de vida; `phase` es el paso interno de `processing`. Así
`queued` y `cancelled` pueden añadirse después sin reinterpretar los estados
actuales.

## FFmpeg opcional en PATH
`FFMPEG_PATH` y `FFPROBE_PATH` no son obligatorios. Si faltan, se usa `ffmpeg` y
`ffprobe` del PATH. En Windows puede configurarse una ruta a `.exe`.

## Temporales junto a SQLite por defecto
`UPLOAD_TEMP_PATH` es opcional. Si no está, el directorio por defecto es
`upload-temp` al lado de `SQLITE_PATH`, fuera de `LIBRARY_PATH`.

## Límite de upload configurable
`UPLOAD_MAX_BYTES` por defecto es 512 MiB. Se valida en el upload HTTP.

## Instalación en la biblioteca (M5)
M5 es el primer hito que escribe en `LIBRARY_PATH`.

- `videoId` = nombre de biblioteca. Se conserva un nombre sanitizado que ya
  incluye fecha `YYYYMMDD` (p. ej. `PXL_YYYYMMDD_HHMMSSmmm`). Si el selector
  de Android entrega un id MediaStore sin fecha, se genera el nombre canónico
  `PXL_YYYYMMDD_HHMMSSmmm` a partir de `creation_time` de ffprobe. Sin fecha
  fiable en metadatos, se conserva el nombre sanitizado; no se inventa una fecha.
- Vídeo: `LIBRARY_PATH/<videoId>`. Thumbnail: `LIBRARY_PATH/.ts/<videoId>.jpg`.
- Copia con `fs.copyFile(..., COPYFILE_EXCL)`; no se usa shell.
- Si SQLite o el destino ya existen → `409`, sin sobrescribir.
- SQLite (`upsertVideo`) solo después de vídeo + thumbnail instalados.
- Recarga del índice con `reloadVideoIndex`, no con `POST /api/library/refresh`.
- Compensación: borrar solo ficheros creados por este job. Nunca borrar
  preexistentes. Si falla SQLite tras copiar, se eliminan los ficheros nuevos.
  Si falla la compensación, se conserva el workspace y el job queda `failed`.
- El thumbnail instalado es el de M3; no se vuelve a ejecutar FFmpeg.
