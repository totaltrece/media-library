# Development — Local and Remote

## Objetivo

El mismo código Node debe funcionar primero en local y después en Ubuntu.

### Local

Windows + Node 22 + FFmpeg/FFprobe + SQLite local.

WSL puede seguir utilizándose para rsync y herramientas existentes, pero no debe ser requisito del upload web.

### Remoto

Ubuntu + Node 22 + FFmpeg/FFprobe + SQLite remoto.

## FFmpeg

Preferir `spawn`/`execFile` desde Node frente a ejecutar scripts shell.

Así el flujo es:

`Node → FFmpeg`

y no:

`Node → bash → WSL → script → FFmpeg`.

La única diferencia entre entornos debería ser configuración de ejecutables y paths.

## Prueba manual de M2

Requiere FFmpeg y FFprobe en PATH, o `FFMPEG_PATH` / `FFPROBE_PATH` en `.env`.

Windows:

```powershell
pnpm --filter @media-library/backend ffmpeg-test -- "C:\ruta\al\video.mp4"
pnpm --filter @media-library/backend ffmpeg-test -- "C:\ruta\al\video.mp4" --keep
pnpm --filter @media-library/backend ffmpeg-test -- "C:\ruta\al\h264.mp4" --convert
```

Linux:

```bash
pnpm --filter @media-library/backend ffmpeg-test -- /ruta/al/video.mp4
pnpm --filter @media-library/backend ffmpeg-test -- /ruta/al/video.mp4 --keep
pnpm --filter @media-library/backend ffmpeg-test -- /ruta/al/h264.mp4 --convert
```

El original no se modifica. `--keep` deja `converted.mp4` y `thumbnail.jpg` en
el directorio del job bajo `UPLOAD_TEMP_PATH`.

## Prueba manual de M3

Ejecuta el pipeline completo (job + workspace + probe + conversión + thumbnail).

Windows:

```powershell
pnpm --filter @media-library/backend process-video -- "C:\ruta\al\hevc.mp4"
pnpm --filter @media-library/backend process-video -- "C:\ruta\al\h264.mp4"
pnpm --filter @media-library/backend process-video -- "C:\ruta\al\hevc.mp4" --discard
```

Linux:

```bash
pnpm --filter @media-library/backend process-video -- /ruta/al/hevc.mp4
pnpm --filter @media-library/backend process-video -- /ruta/al/h264.mp4
pnpm --filter @media-library/backend process-video -- /ruta/al/hevc.mp4 --discard
```

El resultado queda en `UPLOAD_TEMP_PATH/<jobId>/`. El original no se modifica.
`--discard` borra el workspace después de un éxito.

## Prueba manual de M6.1

Arrancar el backend y, en Windows, usar `curl.exe` (no el alias `curl` de PowerShell):

```powershell
curl.exe -X POST "http://localhost:3000/api/admin/uploads" `
  -F "video=@C:\Users\Carlos\Documents\baile-hvc\PXL_20260813_214135367.TS.mp4"
```

Debe responder `202` con `jobId` de inmediato. Consultar el estado:

```powershell
curl.exe "http://localhost:3000/api/admin/uploads/<jobId>"
```

Repetir el GET hasta `completed` o `failed`.

Linux:

```bash
curl -X POST "http://localhost:3000/api/admin/uploads" \
  -F "video=@/ruta/al/video.mp4"

curl "http://localhost:3000/api/admin/uploads/<jobId>"
```

Comprobar:

1. POST responde `202` con `status: "uploading"`
2. GET llega a `completed`
3. vídeo en `LIBRARY_PATH/<nombre>.mp4`  
   (ejemplo: `C:\Users\Carlos\Documents\baile\PXL_20260813_214135367.TS.mp4`)
4. thumbnail en `LIBRARY_PATH/.ts/<nombre>.mp4.jpg`
5. `http://localhost:3000/api/video/PXL_20260813_214135367.TS.mp4`
6. `http://localhost:3000/api/thumbnail/PXL_20260813_214135367.TS.mp4`
7. `http://localhost:3000/api/search` incluye el vídeo con `tags: []`
8. `http://localhost:3000/?untagged=1` → Untagged
9. SQLite: `videos` +1, `tags` y `video_tags` sin cambio
10. Refresh library: el vídeo sigue una sola vez y sin tags
11. repetir el mismo upload → HTTP `409` y ficheros intactos

El workspace del job permanece en `UPLOAD_TEMP_PATH/<jobId>/` para inspección.
Si se reinicia Node durante un job, el estado en memoria se pierde.

## Prueba manual de M6.2

Con el backend y el frontend en marcha, abrir `/admin/videos/upload` desde
**Upload video** en la cabecera (también desde un móvil en la misma red).

1. Pulsar **Select video** y elegir un fichero de vídeo de la galería
   o del disco. No usar captura de cámara en la app.
2. Comprobar que el nombre del fichero aparece (puede ocupar varias líneas).
3. Pulsar **Upload video**. Debe ocultarse el selector.
4. Desde otro dispositivo o navegador, abrir `/admin/videos/upload`: debe
   aparecer el mismo job (nombre, fases) sin volver a subir.
5. Si el vídeo es HEVC, **Processing video** muestra un porcentaje real y
   una barra. Al pasar a thumbnail e instalar, el porcentaje desaparece.
6. Al completar: "Video added successfully". **View in Untagged** abre
   `/?untagged=1` con el vídeo nuevo.
7. `/` es el catálogo (**View** en la cabecera): el thumbnail reproduce el
   vídeo y el nombre abre la edición.
8. El refresh de biblioteca está en la cabecera de todas las páginas.
9. Mientras hay un job activo, un segundo intento muestra que ya hay un
   vídeo en proceso (`409` del backend).
10. Un fichero demasiado grande muestra el mensaje de tamaño (`413`).

No usar `POST /api/library/refresh` para ver el vídeo nuevo: la UI recarga
`GET /api/search`.

## Prueba local

1. upload;
2. almacenamiento temporal;
3. probe;
4. conversión;
5. thumbnail;
6. finalización;
7. SQLite;
8. aparición en Admin/Untagged.

No usar rsync durante esta prueba.

## Backfill de `recorded_at`

Primero, solo inspección (no escribe SQLite):

```powershell
pnpm --filter @media-library/backend backfill-recorded-at -- --dry-run
```

Linux:

```bash
pnpm --filter @media-library/backend backfill-recorded-at -- --dry-run
```

Cada vídeo muestra `source`:

- `ffprobe`: metadata del fichero
- `filename-fallback`: `YYYYMMDD` en el nombre (día conocido,
  hora convencional 20:00 Europe/Madrid → UTC)
- `none`: sin fecha válida

No ejecutar el backfill real hasta revisar las fechas detectadas.

## Despliegue remoto

1. actualizar código;
2. instalar FFmpeg/FFprobe;
3. configurar `.env`;
4. crear directorios/permisos;
5. tests/build;
6. reiniciar PM2;
7. upload de prueba;
8. probar desde móvil.

## Compatibilidad

No añadir lógica específica de Linux si existe una solución Node multiplataforma. Sí se permiten valores de configuración diferentes por entorno.
