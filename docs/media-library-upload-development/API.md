# API — Upload & Processing

Los nombres definitivos deben adaptarse a las convenciones existentes.

M4 añade upload HTTP y consulta de estado. El procesamiento es síncrono: la
petición permanece abierta hasta `completed` o `failed`. M6 podrá hacer el
procesamiento asíncrono reutilizando `GET`.

El resultado **no** se instala en `LIBRARY_PATH` ni se registra en SQLite.

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
  "outputs": {
    "source": "source",
    "converted": "converted.mp4",
    "thumbnail": "thumbnail.jpg"
  }
}
```

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
thumbnail o finaliza, `status` es `processing` y `phase` distingue el paso.

Job inexistente: `404`.

## Error de procesamiento

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

No se exponen trazas ni rutas internas.

## Otros errores

| Código | Caso |
| --- | --- |
| 400 | Fichero ausente, campo incorrecto, nombre o tipo no válido |
| 409 | Ya hay un job activo |
| 413 | El fichero supera `UPLOAD_MAX_BYTES` |

`409`:

```json
{
  "error": {
    "message": "A video processing job is already active."
  }
}
```

## Un único procesamiento

Mientras exista un job activo, otro upload responde `409 Conflict`.
`queued` / `cancelled` se podrán añadir como `status` nuevos más adelante.
