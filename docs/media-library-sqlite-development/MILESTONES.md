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

Detectar vídeos publicados mediante `rsync` e incorporarlos automáticamente a SQLite.

Un vídeo nuevo aparece con sus metadatos básicos y sin tags.

---

## M3 — API de gestión de tags

Exponer operaciones para obtener, crear, añadir y quitar tags.

**Regla:** si se añade un tag inexistente, se crea automáticamente sin pedir confirmación.

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
