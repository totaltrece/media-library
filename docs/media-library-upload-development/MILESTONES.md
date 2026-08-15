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

## M4 — Upload local
Recibir un único vídeo por HTTP y ejecutar el pipeline de M3.

## M5 — Integración con biblioteca
Tras éxito, mover vídeo/thumbnail a ubicaciones definitivas y crear el vídeo en SQLite sin tags.

## M6 — UI de estado
Mostrar subida, procesamiento, thumbnail, finalización y errores. El estado debe poder consultarse tras recargar.

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
