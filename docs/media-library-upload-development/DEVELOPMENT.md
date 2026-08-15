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
