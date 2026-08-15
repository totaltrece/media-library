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

## VideoProcessor como port, FFmpeg como adapter posterior
M1 define `VideoProcessor` sin adapter. M2 lo implementará invocando ejecutables
con `execFile`/`spawn`, usando `FFMPEG_PATH` y `FFPROBE_PATH`.

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
`UPLOAD_MAX_BYTES` por defecto es 512 MiB. Se validará de verdad en M3.
