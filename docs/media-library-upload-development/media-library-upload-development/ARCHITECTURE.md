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
  probe(inputPath: string): Promise<VideoInfo>;
  convert(inputPath: string, outputPath: string): Promise<void>;
  generateThumbnail(inputPath: string, outputPath: string, options?: ThumbnailOptions): Promise<void>;
}
```

Los nombres finales deben adaptarse a la arquitectura actual.

## Compatibilidad

No asumir `/bin/bash`, `/usr/bin/ffmpeg`, PowerShell, WSL ni paths Unix.

Configurar ejecutables mediante entorno, por ejemplo:

```env
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

En Windows puede ser una ruta a `ffmpeg.exe`; en Ubuntu normalmente bastará `ffmpeg` si está en PATH.

## Estados

Como mínimo:

`idle`, `uploading`, `processing`, `generating_thumbnail`, `finalizing`, `completed`, `failed`.

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

MVP: estado del job en memoria; SQLite solo catálogo. Si Node se reinicia durante un job, este puede perderse. Es aceptable inicialmente.

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
