# Milestones — SQLite & Tag Editing

## M1 — Migración de TagSpaces a SQLite

**Objetivo:** convertir SQLite en la fuente de verdad de los tags sin cambiar el comportamiento actual de consulta de `media-library`.

### Alcance
- Introducir SQLite en el backend.
- Definir esquema inicial.
- Crear infraestructura de inicialización/migraciones.
- Registrar vídeos existentes.
- Importar tags actuales de los `.ts` de TagSpaces.
- Mantener los `.ts` originales intactos.
- Adaptar la búsqueda para consultar SQLite.
- Mantener y ampliar tests.
- Validar contra la biblioteca real.

### Fuera de alcance
- Edición de tags desde frontend.
- Edición múltiple.
- Eliminación de TagSpaces.
- Cambios importantes en descarga/conversión.
- Nuevos metadatos no necesarios.

### Criterio de finalización
`media-library` devuelve los mismos resultados de búsqueda que antes, pero leyendo los tags desde SQLite.

---

## M2 — Indexación de nuevos vídeos

Detectar vídeos que aparecen en `LIBRARY_PATH` e incorporarlos a SQLite mediante `POST /api/library/refresh`.

Un vídeo nuevo se registra con sus metadatos básicos y sin tags. Los tags existentes no se modifican. El desarrollo y las pruebas de M2 se hacen en local; rsync y el despliegue remoto no forman parte de este milestone.

---

## M3 — API de gestión de tags

Exponer operaciones para obtener, añadir, quitar y reemplazar tags de un vídeo.

**Regla:** si se añade un tag inexistente, se crea automáticamente sin pedir confirmación. El frontend de edición queda fuera de este milestone.

---

## M4 — Edición de tags desde `media-library`

Permitir editar la biblioteca desde cualquier dispositivo.

La interfaz inicial debe mostrar todos los vídeos disponibles.

Se pueden añadir tags existentes o escribir nuevos; los nuevos se crean directamente.

---

## M5 — Edición múltiple

Seleccionar varios vídeos y aplicar cambios de tags simultáneamente.

---

## M6 — Gestión avanzada y retirada de TagSpaces

Posibles funciones:
- renombrar tags;
- fusionar tags;
- eliminar tags;
- detectar tags sin uso;
- mejoras de filtrado/selección;
- retirada definitiva de la dependencia de TagSpaces.

No diseñar en detalle antes de validar los milestones anteriores.

---

## Tag types

Tipos de tag con color, ordenación por tipo y pantalla de configuración.
Detalle en `docs/media-library-tag-types-development/`.
