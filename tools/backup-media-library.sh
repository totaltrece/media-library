#!/bin/bash

set -u

# ============================================================
# Media Library - Backup desde servidor remoto
#
# Fuente de verdad:
#   Servidor: /mnt/storage/media-library
#
# Destinos:
#   PC:
#     C:\Users\Carlos\Documents\baile
#
#   Disco externo (si D: está disponible):
#     D:\baile
#
# Opposite of tools/sync-baile.sh (local videos -> server).
# This script pulls videos, thumbnails, and SQLite from the server.
#
# No se utiliza --delete:
# los archivos que existan solamente en los backups NO se borran.
# ============================================================

# ------------------------------------------------------------
# CONFIGURACIÓN
# ------------------------------------------------------------

SERVER="media-server"
REMOTE_BASE="/mnt/storage/media-library"

LOCAL_BASE="/mnt/c/Users/Carlos/Documents/baile"

# En WSL, D: normalmente aparece como /mnt/d
EXTERNAL_BASE="/mnt/d/baile"

# ------------------------------------------------------------
# COLORES / MENSAJES
# ------------------------------------------------------------

info() {
    echo
    echo "----------------------------------------"
    echo "$1"
    echo "----------------------------------------"
}

error() {
    echo
    echo "ERROR: $1"
}

# ------------------------------------------------------------
# COMPROBACIONES
# ------------------------------------------------------------

info "Comprobando entorno"

if ! command -v rsync >/dev/null 2>&1; then
    error "rsync no está instalado."
    exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
    error "ssh no está disponible."
    exit 1
fi

if [ ! -d "/mnt/c" ]; then
    error "No parece que estemos ejecutando en WSL (/mnt/c no existe)."
    exit 1
fi

mkdir -p "$LOCAL_BASE"
mkdir -p "$LOCAL_BASE/.ts"
mkdir -p "$LOCAL_BASE/db"

echo "Servidor:       $SERVER"
echo "Origen remoto:  $REMOTE_BASE"
echo "Destino local:  $LOCAL_BASE"

# ------------------------------------------------------------
# COMPROBAR CONEXIÓN AL SERVIDOR
# ------------------------------------------------------------

info "Comprobando conexión con el servidor"

if ! ssh "$SERVER" "test -d '$REMOTE_BASE/videos'"; then
    error "No se puede acceder a $REMOTE_BASE/videos en el servidor."
    exit 1
fi

echo "Conexión OK."

# ------------------------------------------------------------
# VÍDEOS -> PC
# ------------------------------------------------------------

info "Sincronizando vídeos -> PC"

if ! rsync -avh --info=progress2 \
    "$SERVER:$REMOTE_BASE/videos/" \
    "$LOCAL_BASE/"; then

    error "Falló la sincronización de vídeos hacia el PC."
    exit 1
fi

echo "Vídeos sincronizados correctamente."

# ------------------------------------------------------------
# THUMBNAILS -> PC
# ------------------------------------------------------------

info "Sincronizando thumbnails -> PC"

if ! rsync -avh --info=progress2 \
    "$SERVER:$REMOTE_BASE/videos/.ts/" \
    "$LOCAL_BASE/.ts/"; then

    error "Falló la sincronización de thumbnails hacia el PC."
    exit 1
fi

echo "Thumbnails sincronizadas correctamente."

# ------------------------------------------------------------
# SQLITE -> PC
#
# Se descarga primero a un archivo temporal.
# Solo cuando la descarga termina correctamente se sustituye
# la copia local.
# ------------------------------------------------------------

info "Sincronizando SQLite -> PC"

SQLITE_TMP="$LOCAL_BASE/db/library.sqlite.tmp"
SQLITE_LOCAL="$LOCAL_BASE/db/library.sqlite"

rm -f "$SQLITE_TMP"

if ! rsync -avh \
    "$SERVER:$REMOTE_BASE/db/library.sqlite" \
    "$SQLITE_TMP"; then

    rm -f "$SQLITE_TMP"
    error "Falló la descarga de SQLite."
    exit 1
fi

if ! mv -f "$SQLITE_TMP" "$SQLITE_LOCAL"; then
    rm -f "$SQLITE_TMP"
    error "No se pudo sustituir la SQLite local."
    exit 1
fi

echo "SQLite actualizada correctamente."

# ------------------------------------------------------------
# DISCO EXTERNO D:
# ------------------------------------------------------------

if [ -d "/mnt/d" ]; then

    info "Disco externo D: detectado"

    mkdir -p "$EXTERNAL_BASE"
    mkdir -p "$EXTERNAL_BASE/.ts"
    mkdir -p "$EXTERNAL_BASE/db"

    echo "Destino externo: $EXTERNAL_BASE"

    # --------------------------------------------------------
    # VÍDEOS -> D:
    # --------------------------------------------------------

    info "Sincronizando vídeos -> D:"

    if ! rsync -avh --info=progress2 \
        "$SERVER:$REMOTE_BASE/videos/" \
        "$EXTERNAL_BASE/"; then

        error "Falló la sincronización de vídeos hacia D:."
        exit 1
    fi

    echo "Vídeos sincronizados en D:."

    # --------------------------------------------------------
    # THUMBNAILS -> D:
    # --------------------------------------------------------

    info "Sincronizando thumbnails -> D:"

    if ! rsync -avh --info=progress2 \
        "$SERVER:$REMOTE_BASE/videos/.ts/" \
        "$EXTERNAL_BASE/.ts/"; then

        error "Falló la sincronización de thumbnails hacia D:."
        exit 1
    fi

    echo "Thumbnails sincronizadas en D:."

    # --------------------------------------------------------
    # SQLITE -> D:
    # --------------------------------------------------------

    info "Sincronizando SQLite -> D:"

    SQLITE_EXTERNAL_TMP="$EXTERNAL_BASE/db/library.sqlite.tmp"
    SQLITE_EXTERNAL="$EXTERNAL_BASE/db/library.sqlite"

    rm -f "$SQLITE_EXTERNAL_TMP"

    if ! rsync -avh \
        "$SERVER:$REMOTE_BASE/db/library.sqlite" \
        "$SQLITE_EXTERNAL_TMP"; then

        rm -f "$SQLITE_EXTERNAL_TMP"
        error "Falló la descarga de SQLite hacia D:."
        exit 1
    fi

    if ! mv -f "$SQLITE_EXTERNAL_TMP" "$SQLITE_EXTERNAL"; then
        rm -f "$SQLITE_EXTERNAL_TMP"
        error "No se pudo sustituir la SQLite de D:."
        exit 1
    fi

    echo "SQLite actualizada en D:."

else

    info "Disco externo D: no disponible"

    echo "Se omite la copia externa."
    echo "La copia principal del PC ya ha terminado correctamente."

fi

# ------------------------------------------------------------
# RESUMEN
# ------------------------------------------------------------

info "BACKUP COMPLETADO"

echo "Servidor:        $SERVER"
echo
echo "PC:"
echo "  Vídeos:        $LOCAL_BASE"
echo "  Thumbnails:    $LOCAL_BASE/.ts"
echo "  SQLite:        $LOCAL_BASE/db/library.sqlite"

if [ -d "/mnt/d" ]; then
    echo
    echo "Disco externo:"
    echo "  Vídeos:        $EXTERNAL_BASE"
    echo "  Thumbnails:    $EXTERNAL_BASE/.ts"
    echo "  SQLite:        $EXTERNAL_BASE/db/library.sqlite"
else
    echo
    echo "Disco externo:   no disponible (omitido)"
fi

echo
echo "No se han eliminado archivos de los destinos."
echo
