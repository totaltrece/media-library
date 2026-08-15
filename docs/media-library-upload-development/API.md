# API — Upload & Processing

Los nombres definitivos deben adaptarse a las convenciones existentes.

M5 completa el upload HTTP: la petición permanece abierta hasta que el vídeo
está instalado en la biblioteca y registrado en SQLite, o hasta `failed`.
M6 podrá hacer el procesamiento asíncrono reutilizando `GET`.

## Upload

```http
POST /api/admin/uploads
Content-Type: multipart/form-data
```

Campo: `video` (un único fichero).

Respuesta de éxito (`200`):

```json
{
  "jobId": "...",
  "status": "completed",
  "videoId": "PXL_20260813_214135367.TS.mp4",
  "converted": true,
  "installed": true,
  "outputs": {
    "source": "source",
    "converted": "converted.mp4",
    "thumbnail": "thumbnail.jpg"
  }
}
```

`installed: true` significa:

- vídeo en `LIBRARY_PATH/<videoId>`
- thumbnail en `LIBRARY_PATH/.ts/<videoId>.jpg`
- fila SQLite sin tags
- índice en memoria actualizado

`outputs` son nombres relativos dentro de `UPLOAD_TEMP_PATH/<jobId>/`.
`converted` en `outputs` es `null` si el vídeo ya era H.264.

No se exponen rutas absolutas.

## Estado

```http
GET /api/admin/uploads/:jobId
```

```json
{
  "jobId": "...",
  "status": "completed",
  "phase": "completed",
  "videoId": "PXL_20260813_214135367.TS.mp4",
  "converted": true,
  "outputs": {
    "source": "source",
    "converted": "converted.mp4",
    "thumbnail": "thumbnail.jpg"
  }
}
```

`status` y `phase` salen de `ProcessingJobState`. Mientras convierte, genera
thumbnail, finaliza o instala, `status` es `processing` y `phase` distingue
el paso (`installing` durante la copia a la biblioteca).

Job inexistente: `404`.

## Error de procesamiento o instalación

`500` si el job llegó a crearse y falló:

```json
{
  "jobId": "...",
  "status": "failed",
  "error": {
    "message": "Video processing failed."
  }
}
```

Un fallo al copiar a la biblioteca usa el mensaje público
`The video could not be installed.` No se exponen trazas ni rutas internas.

## Otros errores

| Código | Caso |
| --- | --- |
| 400 | Fichero ausente, campo incorrecto, nombre o tipo no válido |
| 409 | Ya hay un job activo, o el vídeo ya existe |
| 413 | El fichero supera `UPLOAD_MAX_BYTES` |

Job activo:

```json
{
  "error": {
    "message": "A video processing job is already active."
  }
}
```

Vídeo existente (SQLite o fichero definitivo):

```json
{
  "error": {
    "message": "A video with this name already exists."
  }
}
```

## Un único procesamiento

Mientras exista un job activo, otro upload responde `409 Conflict`.
`queued` / `cancelled` se podrán añadir como `status` nuevos más adelante.
