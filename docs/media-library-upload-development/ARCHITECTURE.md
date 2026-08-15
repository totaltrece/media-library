# Architecture — Upload & Processing

## Responsabilidades

### Frontend
Selecciona vídeo, inicia upload, muestra estado y consulta resultado. No procesa vídeo.

### Backend Node
Recibe upload, gestiona temporales, crea/ejecuta jobs, invoca FFmpeg/FFprobe, controla estados, mueve archivos finales y registra SQLite.

### FFmpeg / FFprobe
Herramientas externas invocadas por Node. No se debe depender de comandos shell específicos del sistema.

### Filesystem
Separar temporales de biblioteca definitiva. Las rutas deben derivarse de configuración existente.

### SQLite
Catálogo de vídeos/tags. Un vídeo nuevo solo se registra cuando todo el procesamiento ha terminado correctamente.

## Port conceptual

```ts
interface VideoProcessor {
  probe(inputPath: string): Promise<VideoProbeResult>;
  convert(inputPath: string, outputPath: string, options?: VideoConvertOptions): Promise<void>;
  generateThumbnail(
    inputPath: string,
    outputPath: string,
    options?: Partial<ThumbnailGenerationOptions>,
  ): Promise<void>;
}
```

Los nombres en código viven en `backend/src/ports/video-processor.ts`.
Las rutas son de filesystem, no media ids del catálogo.

El adapter es `FfmpegVideoProcessor`. Invoca los binarios configurados con
`child_process.spawn` y argumentos separados. No usa bash, PowerShell, WSL ni
pipelines de shell.

`VideoStore` y `ThumbnailStore` siguen siendo acceso de solo lectura a la
biblioteca. El workspace temporal de un job es un port aparte:
`ProcessingWorkspace`, implementado por `FilesystemProcessingWorkspace` bajo
`UPLOAD_TEMP_PATH`.

## Use case de procesamiento (M3)

`ProcessVideoJobUseCase` orquesta un job a través de los ports:

`ProcessingJobStore` → `ProcessingWorkspace` → `VideoProcessor`

No importa FFmpeg ni el filesystem concreto. Flujo:

1. Rechaza si ya hay un job activo.
2. Crea el job (`idle` → `uploading`) y prepara el workspace.
3. Copia el vídeo de entrada a `sourcePath` (`stageSource`). El original no se modifica.
4. `processing`: probe; convierte solo si el codec es `hevc`.
5. `generating_thumbnail`: thumbnail del vídeo de salida (convertido o source).
6. `finalizing` → `completed`. El resultado permanece en el workspace.

M3 no escribe en `LIBRARY_PATH` ni en SQLite. M4 añade el upload HTTP y
reutiliza este use case (`begin` → escribir `source` → `processStaged`).
`processStaged` deja el job en `finalizing`. M5 instala vídeo/thumbnail,
registra SQLite y marca `completed`.

En error: `failed`, se descarta el workspace y se conserva el mensaje.

## Compatibilidad

No asumir `/bin/bash`, `/usr/bin/ffmpeg`, PowerShell, WSL ni paths Unix.

Configurar ejecutables mediante entorno, por ejemplo:

```env
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

En Windows puede ser una ruta a `ffmpeg.exe`; en Ubuntu normalmente bastará `ffmpeg` si está en PATH:

```env
# Windows
FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
FFPROBE_PATH=C:\ffmpeg\bin\ffprobe.exe

# Ubuntu
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

FFmpeg es una dependencia externa del sistema. El mismo código Node funciona en
ambos entornos si los binarios están disponibles.

## Prueba manual de M2

Sin upload HTTP. Desde la raíz del monorepo:

```bash
pnpm --filter @media-library/backend ffmpeg-test -- "<ruta-al-video>"
```

Opciones: `--convert` (fuerza la conversión), `--skip-convert`, `--keep`
(deja el workspace temporal). El archivo original no se modifica.

## Prueba manual de M3

Sin upload HTTP. Desde la raíz del monorepo:

```bash
pnpm --filter @media-library/backend process-video -- "<ruta-al-video>"
```

El workspace queda en `UPLOAD_TEMP_PATH/<jobId>/` (`source`, `converted.mp4`,
`thumbnail.jpg`). `--discard` lo elimina tras un éxito. El original no se modifica.

## Upload HTTP asíncrono (M6.1)

`POST /api/admin/uploads` recibe `multipart/form-data` (campo `video`), valida,
crea el job, escribe el fichero en `sourcePath` y responde `202` con `jobId`.
`BackgroundUploadJobRunner` ejecuta `CompleteUploadUseCase` en background
(pipeline M3 + instalación M5). `GET /api/admin/uploads/:jobId` consulta el
estado. `GET /api/admin/uploads/active` devuelve el job activo (`uploading` o
`processing`) o `404`. Durante `convert()`, FFmpeg usa `-progress pipe:1` y el
job guarda `progress` (0–100) en memoria.

Los jobs siguen en `InMemoryProcessingJobStore`. Si Node se reinicia con un
job activo, ese job se pierde; no se reanuda. No hay cola.

## UI de subida (M6.2)

La administración comparte cabecera entre `/` (**View**),
`/admin/videos/upload` (**Upload video**), `/admin/videos` (**Admin videos**)
y `/admin/tags` (**Admin tags**), más el refresh de biblioteca.

`/admin/videos/upload` es la página que recupera y muestra el upload activo. Al
entrar consulta `GET /api/admin/uploads/active`. Si hay un job activo,
muestra las fases y continúa el polling de `GET /api/admin/uploads/:jobId`
cada segundo (mismo composable que un upload iniciado en esa sesión). Si no
hay job activo, muestra el selector de subida. Un job activo oculta el
selector. `/admin/videos` y `/` no muestran esta zona.

Durante la conversión HEVC, la fase **Procesando vídeo** muestra el
porcentaje real (`progress`) y una barra corta. Al pasar a
`generating_thumbnail` e `installing` el porcentaje desaparece. Un H.264
sin conversión no muestra progreso de FFmpeg.

Al completar, **View in Sin tags** vuelve a `/admin/videos?untagged=1`. El
catálogo recarga `GET /api/search` y `GET /api/tags` (no
`POST /api/library/refresh`). El icono de refresh de biblioteca está en la
cabecera compartida de todas las páginas.

Ubicaciones definitivas tras `completed`:

- vídeo: `LIBRARY_PATH/<videoId>`
- thumbnail: `LIBRARY_PATH/.ts/<videoId>.jpg`

`videoId` es el nombre de biblioteca. Si el fichero subido ya incluye una fecha
`YYYYMMDD` (incluido `PXL_YYYYMMDD_HHMMSSmmm`), se conserva el nombre sanitizado.
Si Chrome/Android entrega un nombre MediaStore sin fecha (`1000141506.mp4`), el
pipeline lee `creation_time` con ffprobe y genera el nombre canónico
`PXL_YYYYMMDD_HHMMSSmmm.mp4` en la zona horaria local del servidor. Si los
metadatos no tienen una fecha fiable, se conserva el nombre sanitizado; no se
inventa una fecha.
No se sobrescriben ficheros ni filas existentes. No se escribe JSON sidecar.
No se usa `POST /api/library/refresh` internamente.

## Estados

Como mínimo:

`idle`, `uploading`, `processing`, `generating_thumbnail`, `finalizing`, `installing`, `completed`, `failed`.

En código, el job usa un union discriminado (`ProcessingJobState`):

- `status` es el ciclo de vida: `idle` | `uploading` | `processing` | `completed` | `failed`.
- `phase` detalla el paso mientras `status` es `processing`: `processing` | `generating_thumbnail` | `finalizing` | `installing`.

`queued` y `cancelled` se podrán añadir como nuevos `status` sin cambiar los
existentes. El MVP rechaza un segundo job activo; no hay cola todavía.

## Un único job

MVP: máximo un procesamiento activo. Un segundo upload se rechaza claramente. No introducir todavía una cola distribuida ni procesamiento paralelo.

## Atomicidad

Solo registrar el vídeo en SQLite después de:
1. upload completo;
2. conversión completa;
3. thumbnail completa;
4. archivos finales colocados.

Si falla la instalación, compensar solo los ficheros **nuevos** de este job.
No borrar nunca un vídeo o thumbnail que ya existía. Conservar el workspace
temporal para diagnóstico. Si la compensación también falla, el job queda
`failed` y el workspace se conserva.

## Persistencia

MVP: estado del job en memoria (`ProcessingJobStore` / `InMemoryProcessingJobStore`);
SQLite solo catálogo. M6.1 no persiste ni reanuda jobs. Si Node se reinicia
durante un job activo, el trabajo en curso se pierde y el workspace temporal
puede quedar huérfano. Es aceptable hasta una persistencia posterior.

## Seguridad

Validar vídeo, limitar tamaño, no confiar solo en extensión, usar nombres temporales seguros y evitar path traversal.

## Thumbnail

Reutilizar el comportamiento actual:
- 281×500;
- frame por defecto al 50%;
- futura regeneración en otro instante.

## SQLite

Al finalizar:

`upsertVideo(mediaId)` → tags vacíos.

No crear una segunda fuente de verdad.
