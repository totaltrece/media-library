# API — Upload & Processing

Los nombres definitivos deben adaptarse a las convenciones existentes.

M6.1 hace el upload HTTP asíncrono: `POST` acepta el fichero y responde `202`.
El pipeline de M5 continúa en background. `GET` consulta el estado.
Los jobs siguen en memoria; no hay persistencia ni reanudación tras un reinicio.

## Upload

```http
POST /api/admin/uploads
Content-Type: multipart/form-data
```

Campo: `video` (un único fichero).

La petición solo espera a validar el upload y a escribir el fichero en el
workspace del job. No espera a FFmpeg ni a la instalación.

Respuesta de aceptación (`202`):

```json
{
  "jobId": "...",
  "status": "uploading"
}
```

No se exponen rutas absolutas. El estado vivo se consulta con `GET`.

Cuando el job termina, el resultado de M5 sigue siendo el mismo:

- vídeo en `LIBRARY_PATH/<videoId>`
- thumbnail en `LIBRARY_PATH/.ts/<videoId>.jpg`
- fila SQLite sin tags
- índice en memoria actualizado

## Estado

```http
GET /api/admin/uploads/:jobId
```

Mientras procesa:

```json
{
  "jobId": "...",
  "status": "processing",
  "phase": "generating_thumbnail",
  "videoId": "PXL_20260813_214135367.TS.mp4",
  "converted": true,
  "outputs": {
    "source": "source",
    "converted": "converted.mp4",
    "thumbnail": "thumbnail.jpg"
  }
}
```

Al completar:

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

Al fallar (`200` con `status: "failed"`):

```json
{
  "jobId": "...",
  "status": "failed",
  "phase": "failed",
  "videoId": "PXL_20260813_214135367.TS.mp4",
  "converted": null,
  "outputs": null,
  "error": {
    "message": "Video processing failed."
  }
}
```

`status` y `phase` salen de `ProcessingJobState`. Mientras convierte, genera
thumbnail, finaliza o instala, `status` es `processing` y `phase` distingue
el paso (`installing` durante la copia a la biblioteca).

Job inexistente: `404`. No se exponen trazas ni rutas internas.

## Errores de POST

| Código | Caso |
| --- | --- |
| 400 | Fichero ausente, campo incorrecto, nombre o tipo no válido |
| 409 | Ya hay un job activo, o el vídeo ya existe |
| 413 | El fichero supera `UPLOAD_MAX_BYTES` |

Los fallos de FFmpeg o de instalación **no** se devuelven en el `POST`.
Quedan en el job (`failed`) y se consultan con `GET`.

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

Mientras exista un job activo (`uploading` o `processing`, incluida la fase
`installing`), otro upload responde `409 Conflict`.
`queued` / `cancelled` se podrán añadir como `status` nuevos más adelante.
