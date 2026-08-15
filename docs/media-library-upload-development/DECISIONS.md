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

El layout TagSpaces `.ts/<filename>.jpg` se aplaza a M5. M2/M3 escriben
`thumbnail.jpg` en el workspace temporal.

## ProcessVideoJobUseCase
M3 orquesta un job completo sin HTTP. Dependencias: `VideoProcessor`,
`ProcessingWorkspace`, `ProcessingJobStore` (en memoria).

- Éxito: el workspace se conserva para que M4/M5 instalen el resultado.
- Error: `failed` y se descarta el workspace.
- Un segundo job activo se rechaza con `ActiveProcessingJobError` (HTTP 409 en M4).
- `completed.videoId` es el nombre original, no un id de catálogo. M5 usará las
  rutas del resultado para instalar y registrar SQLite.
- `ProcessingWorkspace.stageSource` copia el input a `sourcePath` sin modificar
  el original. Así un H.264 también queda en el workspace.

## VideoStore y ThumbnailStore siguen siendo de lectura
No se amplían para escribir temporales ni archivos nuevos. El workspace de un
job es `ProcessingWorkspace`. La biblioteca definitiva se tocará en M5, y solo
para colocar el resultado de un upload, nunca para mutar TagSpaces.

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
`UPLOAD_MAX_BYTES` por defecto es 512 MiB. Se validará de verdad en el upload HTTP (M4).
