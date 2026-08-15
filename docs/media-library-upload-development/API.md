# API — Upload & Processing

Los nombres definitivos deben adaptarse a las convenciones existentes.

M6.1 hace el upload HTTP asíncrono: `POST` acepta el fichero y responde `202`.
El pipeline de M5 continúa en background. `GET` consulta el estado.
Los jobs siguen en memoria; no hay persistencia ni reanudación tras un reinicio.

La UI de administración consulta `GET /api/admin/uploads/active` al entrar
en `/admin/videos/upload`, envía el multipart sin `Content-Type` manual (el navegador
añade el boundary) y hace polling del `GET` hasta un estado terminal.
Durante la conversión HEVC, `progress` es un porcentaje 0–100 derivado de
FFmpeg `-progress`. No hay WebSockets ni SSE.

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

`videoId` conserva un nombre que ya incluye `YYYYMMDD` (p. ej. `PXL_20260314_200431123.mp4`).
Si el navegador envía un nombre MediaStore de Android sin fecha (`1000141506.mp4`),
el job usa `creation_time` de ffprobe para generar `PXL_YYYYMMDD_HHMMSSmmm.mp4`.
Sin una fecha fiable en metadatos, se conserva el nombre sanitizado.

## Estado

```http
GET /api/admin/uploads/:jobId
```

Mientras procesa:

```json
{
  "jobId": "...",
  "status": "processing",
  "phase": "processing",
  "videoId": "PXL_20260813_214135367.TS.mp4",
  "converted": true,
  "progress": 47,
  "outputs": {
    "source": "source",
    "converted": "converted.mp4",
    "thumbnail": "thumbnail.jpg"
  }
}
```

`progress` es `null` cuando no hay conversión (H.264) o aún no aplica.
Durante FFmpeg está entre `0` y `100`. Al terminar la conversión queda `100`.
No se exponen rutas internas ni salida de FFmpeg.

Al completar:

```json
{
  "jobId": "...",
  "status": "completed",
  "phase": "completed",
  "videoId": "PXL_20260813_214135367.TS.mp4",
  "converted": true,
  "progress": 100,
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
  "progress": null,
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

## Job activo

```http
GET /api/admin/uploads/active
```

Devuelve el mismo cuerpo que `GET /api/admin/uploads/:jobId` si hay un job
con `status` `uploading` o `processing` (incluida la fase `installing`).
Si no hay ninguno, responde `404` (`No active upload job.`).
Los jobs `completed` y `failed` no cuentan como activos.

Este endpoint está registrado antes de `/:jobId` para que `active` no se
interprete como un id.

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
  },
  "jobId": "..."
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
