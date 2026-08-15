# Media Library — Upload & Server Processing Development

Siguiente gran hito de media-library: subir vídeos desde móvil/PC y procesarlos en el backend Node.

Documentos:
- `MILESTONES.md` — hitos.
- `ARCHITECTURE.md` — arquitectura.
- `DEVELOPMENT.md` — desarrollo local/remoto.
- `API.md` — contrato previsto.
- `OPERATIONS.md` — operación en Ubuntu.
- `DECISIONS.md` — decisiones arquitectónicas.

Orden:
1. M1 Arquitectura y contratos
2. M2 Adapter FFmpeg multiplataforma
3. M3 Upload local
4. M4 Procesamiento local
5. M5 Integración SQLite
6. M6 UI de estado
7. M7 Despliegue remoto
8. M8 Tags durante upload
9. M9 Cola, si hace falta
10. M10 Concurrencia, solo si se justifica

Regla: desarrollar primero en local y después desplegar en remoto. El backend web no debe depender de WSL.
