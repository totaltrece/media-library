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

## Prueba manual de M4

Arrancar el backend y, en Windows, usar `curl.exe` (no el alias `curl` de PowerShell):

```powershell
curl.exe -X POST "http://localhost:3000/api/admin/uploads" `
  -F "video=@C:\Users\Carlos\Documents\baile-hvc\PXL_20260813_214135367.TS.mp4"

curl.exe "http://localhost:3000/api/admin/uploads/<jobId>"
```

Linux:

```bash
curl -X POST "http://localhost:3000/api/admin/uploads" \
  -F "video=@/ruta/al/video.mp4"

curl "http://localhost:3000/api/admin/uploads/<jobId>"
```

Comprobar que el resultado está en `UPLOAD_TEMP_PATH/<jobId>/` y que
`LIBRARY_PATH` y SQLite no cambian.

## Prueba local

1. upload;
2. almacenamiento temporal;
3. probe;
4. conversión;
5. thumbnail;
6. finalización;
7. SQLite;
8. aparición en Admin/Sin tags.

No usar rsync durante esta prueba.

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
