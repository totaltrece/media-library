#!/bin/bash

set -u

# ============================================================
# Media Library - Backup desde servidor remoto
#
# Fuente de verdad:
#   Servidor: /mnt/storage/media-library
#
# Destinos:
#   PC vídeos:
#     C:\Users\Carlos\Documents\baile
#   PC SQLite (same file as SQLITE_PATH in backend/.env):
#     C:\Users\Carlos\Documents\proyectos\media-library\data\library.sqlite
#
#   Disco externo (si D: está disponible):
#     D:\baile
#     D:\baile\db\library.sqlite
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
EXTERNAL_SQLITE="$EXTERNAL_BASE/db/library.sqlite"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
ENV_FILE="$REPO_ROOT/backend/.env"
SQLITE_DOWNLOAD="/tmp/media-library-library.sqlite"

# Video folders must not receive the catalog file. SQLite is copied separately
# into SQLITE_PATH (app) and D:\baile\db (external backup).
VIDEO_RSYNC_EXCLUDES=(--exclude='db/' --exclude='*.sqlite')

windows_to_wsl_path() {
    local path="$1"

    path="${path%$'\r'}"
    path="${path#\"}"
    path="${path%\"}"
    path="${path#\'}"
    path="${path%\'}"

    if [[ "$path" =~ ^[A-Za-z]:[\\/] ]]; then
        local drive
        drive=$(echo "${path:0:1}" | tr '[:upper:]' '[:lower:]')
        local rest="${path:2}"
        rest="${rest//\\//}"
        rest="${rest#/}"
        echo "/mnt/${drive}/${rest}"
        return
    fi

    echo "$path"
}

read_env_value() {
    local name="$1"
    local file="$2"
    local line value

    if [ ! -f "$file" ]; then
        return
    fi

    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        case "$line" in
            "${name}="*)
                value="${line#${name}=}"
                value="${value#\"}"
                value="${value%\"}"
                value="${value#\'}"
                value="${value%\'}"
                echo "$value"
                return
                ;;
        esac
    done < "$file"
}

copy_sqlite_into_place() {
    local src="$1"
    local dest="$2"

    mkdir -p "$(dirname "$dest")"
    rm -f "${dest}-wal" "${dest}-shm"

    if [ -e "$dest" ]; then
        rm -f "$dest" || true
    fi

    if [ ! -e "$dest" ] && cp -f "$src" "$dest"; then
        return 0
    fi

    if rsync -a --inplace "$src" "$dest"; then
        return 0
    fi

    error "No se pudo escribir $dest (fichero bloqueado o sin permiso en el disco Windows)."
    return 1
}

SQLITE_WINDOWS=$(read_env_value SQLITE_PATH "$ENV_FILE")

if [ -n "${SQLITE_WINDOWS:-}" ]; then
    SQLITE_LOCAL=$(windows_to_wsl_path "$SQLITE_WINDOWS")
else
    SQLITE_LOCAL="$REPO_ROOT/data/library.sqlite"
fi

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
mkdir -p "$(dirname "$SQLITE_LOCAL")"

echo "Servidor:       $SERVER"
echo "Origen remoto:  $REMOTE_BASE"
echo "Vídeos local:   $LOCAL_BASE"
echo "SQLite app:     $SQLITE_LOCAL"

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
# VÃDEOS -> PC
# ------------------------------------------------------------

info "Sincronizando vídeos -> PC"

if ! rsync -avh --info=progress2 \
    "${VIDEO_RSYNC_EXCLUDES[@]}" \
    "$SERVER:$REMOTE_BASE/videos/" \
    "$LOCAL_BASE/"; then

    error "Falló la sincronización de vídeos hacia el PC."
    exit 1
fi

echo "vídeos sincronizados correctamente."

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

rm -f "$SQLITE_DOWNLOAD"

if ! rsync -avh \
    "$SERVER:$REMOTE_BASE/db/library.sqlite" \
    "$SQLITE_DOWNLOAD"; then

    rm -f "$SQLITE_DOWNLOAD"
    error "Falló la descarga de SQLite."
    exit 1
fi

if ! copy_sqlite_into_place "$SQLITE_DOWNLOAD" "$SQLITE_LOCAL"; then
    rm -f "$SQLITE_DOWNLOAD"
    error "No se pudo sustituir la SQLite local ($SQLITE_LOCAL)."
    echo "Cierra la app si está usando ese fichero y vuelve a ejecutar el backup."
    exit 1
fi

echo "SQLite actualizada en $SQLITE_LOCAL."

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
    # VÃDEOS -> D:
    # --------------------------------------------------------

    info "Sincronizando vídeos -> D:"

    if ! rsync -avh --info=progress2 \
        --temp-dir=/tmp \
        "${VIDEO_RSYNC_EXCLUDES[@]}" \
        "$SERVER:$REMOTE_BASE/videos/" \
        "$EXTERNAL_BASE/"; then

        error "Falló la sincronización de vídeos hacia D:."
        exit 1
    fi

    echo "vídeos sincronizados en D:."

    # --------------------------------------------------------
    # THUMBNAILS -> D:
    # --------------------------------------------------------

    info "Sincronizando thumbnails -> D:"

    if ! rsync -avh --info=progress2 \
        --temp-dir=/tmp \
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

    if ! copy_sqlite_into_place "$SQLITE_DOWNLOAD" "$EXTERNAL_SQLITE"; then
        rm -f "$SQLITE_DOWNLOAD"
        error "No se pudo sustituir la SQLite de D: ($EXTERNAL_SQLITE)."
        echo "Cierra el Explorador u otro programa que tenga abierto library.sqlite en D:."
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
echo "  vídeos:        $LOCAL_BASE"
echo "  Thumbnails:    $LOCAL_BASE/.ts"
echo "  SQLite:        $SQLITE_LOCAL"

if [ -d "/mnt/d" ]; then
    echo
    echo "Disco externo:"
    echo "  vídeos:        $EXTERNAL_BASE"
    echo "  Thumbnails:    $EXTERNAL_BASE/.ts"
    echo "  SQLite:        $EXTERNAL_SQLITE"
else
    echo
    echo "Disco externo:   no disponible (omitido)"
fi

echo
echo "No se han eliminado archivos de los destinos."
echo

rm -f "$SQLITE_DOWNLOAD"
