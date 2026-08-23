# Arquitectura objetivo

## Principio

La biblioteca física y la fuente de verdad de los tags son conceptos distintos.

### Archivos

El ACEMAGIC produce y publica:
- vídeos convertidos;
- thumbnails.

El proceso termina haciendo `rsync` al servidor.

### Datos

El servidor mantiene:
- SQLite;
- relación vídeos/tags;
- catálogo de tags;
- tipos de tag (nombre, color, tipo por defecto).

## Flujo de nuevos vídeos

    ACEMAGIC
       ↓
    descarga
       ↓
    conversión H264
       ↓
    thumbnail 281x500
       ↓
    rsync
       ↓
    servidor
       ↓
    indexación
       ↓
    SQLite
       ↓
    media-library

Un vídeo nuevo empieza sin tags.

## Edición futura

    dispositivo
        ↓
    media-library API
        ↓
      SQLite

Los clientes nunca acceden directamente al fichero SQLite.

## TagSpaces

Durante la transición:
- SQLite es la fuente de verdad.
- Los `.ts` antiguos se conservan como backup.
- No se generan nuevos cambios de tags en TagSpaces.
- La retirada definitiva se deja para M6.

## Local vs remoto

La adquisición de vídeos continúa en el ACEMAGIC.

La gestión de tags será remota para poder editar desde PC, tablet o móvil.

El ACEMAGIC no necesita recibir de vuelta cambios de tags.
