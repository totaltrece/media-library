# API — Upload & Processing

Los nombres definitivos deben adaptarse a las convenciones existentes.

## Upload

```http
POST /api/admin/uploads
Content-Type: multipart/form-data
```

Campo: `video`

Respuesta inicial:

```json
{ "jobId": "..." }
```

No mantener la conexión HTTP hasta terminar FFmpeg.

## Estado

```http
GET /api/admin/uploads/:jobId
```

Ejemplo:

```json
{
  "jobId": "...",
  "status": "processing",
  "phase": "generating_thumbnail",
  "progress": null,
  "videoName": "..."
}
```

`progress` puede ser `null` inicialmente.

## Completado

```json
{
  "jobId": "...",
  "status": "completed",
  "videoId": "..."
}
```

## Error

```json
{
  "jobId": "...",
  "status": "failed",
  "error": "..."
}
```

No exponer trazas internas.

## Un único procesamiento

Mientras exista un job activo, otro upload puede responder `409 Conflict`.

## Futuro

El diseño debe poder evolucionar a `queued`, `cancelled` y múltiples jobs sin implementar todavía una cola persistente.
