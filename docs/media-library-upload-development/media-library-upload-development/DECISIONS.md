# Architecture Decisions

## Node como backend
No crear un backend separado para procesamiento. Simplifica despliegue y permite compartir SQLite, filesystem y configuración.

## FFmpeg externo
Usar FFmpeg como proceso externo. Es compatible con Windows y Ubuntu y coincide con el flujo actual.

## No depender de WSL
WSL seguirá sirviendo para rsync y herramientas locales, pero el nuevo upload web debe funcionar directamente con Node + FFmpeg.

## Un procesamiento simultáneo
Primero uno. Evita complejidad y permite medir recursos antes de introducir concurrencia.

## Estado en memoria
Inicialmente no persistir jobs en SQLite. Si hace falta, se añadirá posteriormente una tabla de jobs.

## No registrar antes de finalizar
SQLite representa vídeos disponibles. Un vídeo en proceso no pertenece todavía al catálogo.

## Tags como segunda fase
El MVP crea vídeos sin tags. Después se puede reutilizar el catálogo y los casos de uso actuales para introducir tags durante el upload.

## Local primero
El desarrollo y las pruebas deben hacerse primero en local. El despliegue remoto debería cambiar principalmente paths, FFmpeg y límites de recursos, no la arquitectura.
