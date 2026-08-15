# Milestones — Upload & Server Processing

## Objetivo

Permitir:

`móvil/PC → upload → procesamiento Node/FFmpeg → H.264 → thumbnail 281×500 → filesystem → SQLite → Admin/Sin tags`

El procesamiento debe continuar aunque se cierre el navegador.

## M1 — Arquitectura y contratos
Definir puertos, estados, configuración, directorios temporales y límites. Sin cambiar todavía el flujo de subida.

## M2 — Procesador multiplataforma
Integrar FFmpeg/FFprobe mediante procesos del sistema, sin scripts shell específicos de Linux/Windows.

## M3 — Upload local
Recibir un único vídeo y almacenarlo temporalmente.

## M4 — Procesamiento local
Upload → conversión → thumbnail → resultado, todavía sin catálogo definitivo.

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
