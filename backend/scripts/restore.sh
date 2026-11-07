#!/usr/bin/env bash
# =============================================================================
# Hostel Hub — Production Database & Uploads Restoration Script
# =============================================================================
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <path_to_backup_directory>"
    echo "Example: $0 /var/backups/hostel-hub/20261107_010000"
    exit 1
fi

BACKUP_PATH="$1"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/hostelDB}"
UPLOAD_DIR="${UPLOAD_DIR:-uploads}"

if [ ! -d "${BACKUP_PATH}" ]; then
    echo "Error: Backup directory ${BACKUP_PATH} does not exist."
    exit 1
fi

echo "[$(date)] Starting restoration from ${BACKUP_PATH}..."

# 1. Restore MongoDB Database (with --drop to ensure clean state)
if [ -f "${BACKUP_PATH}/mongodb_backup.gz" ]; then
    echo "[$(date)] Restoring MongoDB collections..."
    mongorestore --uri="${MONGO_URI}" --gzip --archive="${BACKUP_PATH}/mongodb_backup.gz" --drop
    echo "[$(date)] MongoDB restoration completed."
else
    echo "Error: mongodb_backup.gz not found in ${BACKUP_PATH}."
    exit 1
fi

# 2. Restore Media Uploads
if [ -f "${BACKUP_PATH}/media_uploads.tar.gz" ]; then
    echo "[$(date)] Restoring media uploads to ${UPLOAD_DIR}..."
    mkdir -p "${UPLOAD_DIR}"
    tar -xzf "${BACKUP_PATH}/media_uploads.tar.gz" -C "${UPLOAD_DIR}"
    echo "[$(date)] Media uploads restoration completed."
fi

echo "[$(date)] Restoration finished successfully."

