# Milestones — Upload & Server Processing

## Objetivo

Permitir:

`móvil/PC → upload → procesamiento Node/FFmpeg → H.264 → thumbnail 281×500 → filesystem → SQLite → Admin/Sin tags`

El procesamiento debe continuar aunque se cierre el navegador.

## M1 — Arquitectura y contratos
Puertos, estados, configuración y límites definidos en el backend.
Sin upload HTTP, sin adapter FFmpeg y sin cambios en el flujo actual.

## M2 — Procesador multiplataforma
Implementado: adapter FFmpeg/FFprobe mediante `spawn` (sin shell), workspace
temporal de filesystem y CLI `ffmpeg-test` para pruebas locales.
Sin upload HTTP, sin jobs reales y sin cambios en el flujo actual.

## M3 — Pipeline de procesamiento
Implementado: `ProcessVideoJobUseCase` orquesta job, workspace, probe,
conversión HEVC y thumbnail. CLI `process-video` para prueba local.
Sin upload HTTP, sin SQLite de jobs y sin escritura en `LIBRARY_PATH`.

## M4 — Upload HTTP
Implementado: `POST /api/admin/uploads` y `GET /api/admin/uploads/:jobId`.
El upload multipart ejecuta el pipeline de M3 de forma síncrona.
El resultado permanece en el workspace temporal. Sin instalación en
`LIBRARY_PATH` ni escritura en SQLite.

## M5 — Integración con biblioteca
Implementado: tras un procesamiento correcto, el vídeo y el thumbnail se
instalan en `LIBRARY_PATH` / `.ts/`, se registra `upsertVideo` sin tags y se
recarga el índice. Un id o fichero existente se rechaza con `409`.
Sin cola, sin UI de upload y sin persistencia de jobs.

## M6.1 — Upload HTTP asíncrono
Implementado: `POST /api/admin/uploads` responde `202` tras persistir el
fichero; el pipeline de M5 continúa en background. `GET` consulta el estado.
Jobs en memoria; un reinicio pierde jobs activos. Sin cola y sin
reanudación.

## M6.2 — UI de subida y seguimiento
Implementado: página `/admin/videos/upload`, enlazada desde la cabecera
compartida (**Upload video**). `POST` multipart, polling de
`GET /api/admin/uploads/:jobId`, fases visibles, un solo upload activo y
vuelta al catálogo en Sin tags. Cabecera compartida con View / Upload video /
Admin videos / Admin tags y refresh. Sin cola, sin porcentaje de FFmpeg y sin
captura de cámara.

## M6 — UI de estado
La presentación de fases y errores está en M6.2. Recargar la página no
restaura un job en curso: el estado sigue en memoria y el `409` activo no
incluye `jobId` por defecto.

## M7 — MVP remoto
Instalar/configurar FFmpeg en Ubuntu, desplegar el mismo backend y probar desde móvil/PC.

## M8 — Tags durante upload
Opcional: seleccionar tags existentes y crear nuevos durante el upload.

## M9 — Cola
Opcional: varios vídeos pendientes, pero un solo worker inicialmente.

## M10 — Concurrencia
Solo si el uso real lo justifica.

### Criterio de finalización del MVP

Un vídeo grabado con el móvil puede subirse al servidor, procesarse completamente, generar thumbnail, entrar en SQLite y aparecer en `Admin → Vídeos → Sin tags`, sin intervención manual.
