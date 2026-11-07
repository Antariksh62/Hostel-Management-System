#!/usr/bin/env bash
# =============================================================================
# Hostel Hub — Production Database & Uploads Backup Script
# =============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/hostel-hub}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_DIR="${BACKUP_DIR}/${TIMESTAMP}"
MONGO_URI="${MONGO_URI:-mongodb://127.0.0.1:27017/hostelDB}"
UPLOAD_DIR="${UPLOAD_DIR:-uploads}"

mkdir -p "${TARGET_DIR}"

echo "[$(date)] Starting Hostel Hub backup to ${TARGET_DIR}..."

# 1. MongoDB Database Dump using mongodump with gzip compression
echo "[$(date)] Backing up MongoDB database..."
mongodump --uri="${MONGO_URI}" --gzip --archive="${TARGET_DIR}/mongodb_backup.gz"

# 2. Complaint Media Uploads Archive
if [ -d "${UPLOAD_DIR}" ]; then
  echo "[$(date)] Archiving uploaded complaint media from ${UPLOAD_DIR}..."
  tar -czf "${TARGET_DIR}/media_uploads.tar.gz" -C "${UPLOAD_DIR}" .
else
  echo "[$(date)] Warning: Upload directory ${UPLOAD_DIR} not found, skipping media archive."
fi

# 3. Create SHA256 checksums
cd "${TARGET_DIR}"
sha256sum * > SHA256SUMS

# 4. Retention Policy: Retain daily backups for 30 days
find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true

echo "[$(date)] Backup completed successfully."

