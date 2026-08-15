# Operations — Server

Ubuntu debe disponer de:
- Node.js 22
- FFmpeg
- FFprobe
- permisos de escritura en biblioteca y temporales.

Comprobar:

```bash
node --version
ffmpeg -version
ffprobe -version
```

Los directorios temporales deben configurarse, no codificarse en duro.

PM2 mantiene el backend Node; no crear inicialmente otro daemon para FFmpeg.

La conversión consume CPU, RAM y disco. El MVP limita a un único procesamiento.

Si Node se reinicia durante un job, este puede quedar incompleto; no debe quedar un vídeo parcial registrado en SQLite.

El endpoint debe vivir bajo `/api/admin/...` para facilitar su futura protección mediante autenticación.
