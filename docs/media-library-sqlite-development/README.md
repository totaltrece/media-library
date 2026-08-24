# Media Library — SQLite & Tag Editing

Objetivo: pasar de TagSpaces como fuente de verdad de los tags a SQLite gestionado por el backend de `media-library`, manteniendo el comportamiento actual de consulta y búsqueda.

La biblioteca física continuará viviendo inicialmente en el ACEMAGIC y se publicará mediante `rsync` al servidor. Los vídeos y thumbnails son archivos; los tags serán datos gestionados por SQLite en el servidor.

## Orden
1. M1 — Migración TagSpaces → SQLite
2. M2 — Indexación de nuevos vídeos
3. M3 — API de gestión de tags
4. M4 — Edición de tags desde `media-library`
5. M5 — Edición múltiple
6. M6 — Gestión avanzada y retirada de TagSpaces
7. Tag types — tipos con color, UI y configuración (`docs/media-library-tag-types-development/`)
8. Auth — login admin, roles `admin`/`view` (`docs/media-library-auth-development/`)

M1 se desarrolla y valida primero en local. Después se despliega al servidor y se configura la ruta de SQLite mediante variables de entorno.
