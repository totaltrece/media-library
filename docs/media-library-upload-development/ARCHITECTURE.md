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
  convert(inputPath: string, outputPath: string): Promise<void>;
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

M3 no escribe en `LIBRARY_PATH` ni en SQLite. M4 añadirá el upload HTTP.
M5 instalará vídeo/thumbnail en la biblioteca y registrará el catálogo.

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

## Estados

Como mínimo:

`idle`, `uploading`, `processing`, `generating_thumbnail`, `finalizing`, `completed`, `failed`.

En código, el job usa un union discriminado (`ProcessingJobState`):

- `status` es el ciclo de vida: `idle` | `uploading` | `processing` | `completed` | `failed`.
- `phase` detalla el paso mientras `status` es `processing`: `processing` | `generating_thumbnail` | `finalizing`.

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

Si falla, limpiar temporales y no registrar el vídeo.

## Persistencia

MVP: estado del job en memoria (`ProcessingJobStore` / `InMemoryProcessingJobStore`);
SQLite solo catálogo. Si Node se reinicia durante un job, este puede perderse. Es aceptable inicialmente.

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
