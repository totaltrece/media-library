# M1 — Migración de TagSpaces a SQLite

## Objetivo

Hacer que SQLite sea la fuente de verdad de los tags manteniendo el funcionamiento actual de `media-library`.

El desarrollo de M1 se realizará y probará completamente en local. El despliegue remoto se hará después de validar el milestone.

## Evolución

Actual:

    vídeo + metadata TagSpaces
             ↓
          indexador
             ↓
        media-library

Objetivo:

    vídeo + metadata TagSpaces
             ↓
          migración
             ↓
           SQLite
             ↓
        media-library

Los `.ts` originales no se modifican ni eliminan durante M1.

## Modelo inicial

Debe ser deliberadamente pequeño:

### videos

Identifica el archivo de vídeo dentro de la biblioteca.

Campo:

- `id` (TEXT, PK): identificador de media ya usado por la API. Es la ruta relativa
  a `LIBRARY_PATH` con `/`. Ejemplo: `bachata/20250630_193642391.TS.mp4`.

No se persisten rutas absolutas, thumbnails ni sidecars de TagSpaces: esos datos
siguen derivándose del `id` y de la biblioteca de archivos.

### tags

Catálogo único de tags.

Campos:

- `id` (INTEGER, PK)
- `name` (TEXT, UNIQUE): título exacto extraído de TagSpaces (`tag.title`)

No se normaliza el caso todavía. El buscador actual compara tags en minúsculas
solo en memoria; SQLite conserva el valor original para no cambiar el
comportamiento.

### video_tags

Relación muchos-a-muchos.

Campos:

- `video_id` → `videos.id`
- `tag_id` → `tags.id`
- `position` (INTEGER): orden original de los tags en el vídeo

### Persistencia

El backend usa el módulo nativo `node:sqlite`. La ruta se configura con
`SQLITE_PATH` y no está hardcodeada. El arranque y `pnpm import-library`
requieren esa variable; no se inventa una ruta por defecto.

Para recrear la base local, basta con borrar el fichero apuntado por
`SQLITE_PATH` y volver a abrir el store.

## Arquitectura

El dominio y la aplicación no deben depender directamente de SQLite.

Seguir la arquitectura existente:

    domain/application
            ↓
          ports
            ↓
       SQLite adapter

El repositorio debe poder utilizarse tanto desde el indexador como desde la futura API.

## Configuración local

- La ruta de SQLite debe ser configurable.
- No hardcodear la ruta.
- Debe existir una variable de entorno.
- La DB local debe poder destruirse/recrearse fácilmente durante pruebas.

## Migración

Crear una operación reproducible que:

1. Descubra los vídeos de la biblioteca.
2. Cree sus registros en `videos`.
3. Lea los `.ts` actuales.
4. Extraiga los títulos de los tags.
5. Cree tags únicos.
6. Cree relaciones `video_tags`.
7. Sea idempotente.
8. No modifique los `.ts`.

Ejecutar en local (no arranca el backend):

```bash
pnpm import-library
```

Requiere `LIBRARY_PATH` y `SQLITE_PATH` en `backend/.env`. El runtime de consulta
lee los tags desde SQLite; los `.ts` de TagSpaces se conservan como backup y
siguen usándose solo en la importación explícita.

## Búsqueda

Conservar exactamente el comportamiento actual.

Si se solicitan varios tags, el vídeo debe coincidir con todos los tags solicitados, como en los tests existentes.

La fuente de los tags pasa a ser SQLite. El package `search` no conoce SQLite:
el composition root carga `LibraryStore.listVideosWithTags()`, lo adapta a
`IndexedVideo[]` y sigue llamando a `searchVideos()`.

## Compatibilidad

Durante M1 se puede conservar lectura de TagSpaces para importar o validar.

No crear nuevas funcionalidades que escriban TagSpaces.

## Validación

- Tests existentes.
- Tests del repositorio SQLite.
- Tests de migración.
- Idempotencia.
- Comparación de resultados de búsqueda.
- Prueba con copia real de la biblioteca.
- Verificar que `.ts` no cambia.

## Despliegue posterior

Cuando M1 esté validado en local:

1. Commit.
2. Desplegar backend.
3. Crear/configurar SQLite en servidor.
4. Configurar variables de entorno, especialmente la ruta de SQLite.
5. Ejecutar migración sobre la biblioteca del servidor.
6. Verificar búsquedas.
7. Mantener `.ts` como respaldo.

No asumir que sólo hace falta cambiar `.env`: verificar durante M1 cualquier requisito adicional de migraciones y permisos del proceso.
