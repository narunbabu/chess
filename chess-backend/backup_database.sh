#!/bin/bash

# Database Backup Script for Hostinger MySQL Database
# Creates a timestamped backup of the entire database

# Database credentials
DB_HOST="mysql.hostinger.in"
DB_PORT="3306"
DB_DATABASE="u441069787_togata"
DB_USERNAME="u441069787_togata"
DB_PASSWORD="Arun@123"

# Backup directory and filename
BACKUP_DIR="./database/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_DATABASE}_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔄 Starting database backup..."
echo "Database: ${DB_DATABASE}"
echo "Host: ${DB_HOST}"
echo "Backup file: ${BACKUP_FILE}"

# Perform the backup
mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USERNAME}" \
  --password="${DB_PASSWORD}" \
  --databases "${DB_DATABASE}" \
  --single-transaction \
  --quick \
  --lock-tables=false \
  --routines \
  --triggers \
  --events \
  > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
  # Compress the backup
  echo "📦 Compressing backup..."
  gzip "$BACKUP_FILE"

  COMPRESSED_FILE="${BACKUP_FILE}.gz"
  FILE_SIZE=$(ls -lh "$COMPRESSED_FILE" | awk '{print $5}')

  echo ""
  echo "✅ Backup completed successfully!"
  echo "📁 File: ${COMPRESSED_FILE}"
  echo "📊 Size: ${FILE_SIZE}"
  echo ""
  echo "To restore this backup:"
  echo "  gunzip ${COMPRESSED_FILE}"
  echo "  mysql -h ${DB_HOST} -u ${DB_USERNAME} -p ${DB_DATABASE} < ${BACKUP_FILE}"
else
  echo ""
  echo "❌ Backup failed!"
  echo "Please check:"
  echo "  - Database credentials are correct"
  echo "  - You have network access to ${DB_HOST}"
  echo "  - mysqldump is installed on your system"
  exit 1
fi
