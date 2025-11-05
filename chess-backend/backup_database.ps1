# Database Backup Script for Hostinger MySQL Database (PowerShell)
# Creates a timestamped backup of the entire database

# Database credentials
$DB_HOST = "mysql.hostinger.in"
$DB_PORT = "3306"
$DB_DATABASE = "u441069787_togata"
$DB_USERNAME = "u441069787_togata"
$DB_PASSWORD = "Arun@123"

# Backup directory and filename
$BACKUP_DIR = "./database/backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR/backup_${DB_DATABASE}_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
New-Item -ItemType Directory -Force -Path $BACKUP_DIR | Out-Null

Write-Host "🔄 Starting database backup..." -ForegroundColor Cyan
Write-Host "Database: $DB_DATABASE"
Write-Host "Host: $DB_HOST"
Write-Host "Backup file: $BACKUP_FILE"
Write-Host ""

# Perform the backup using mysqldump
$mysqldumpPath = "mysqldump" # Assumes mysqldump is in PATH

try {
    & $mysqldumpPath `
      --host=$DB_HOST `
      --port=$DB_PORT `
      --user=$DB_USERNAME `
      --password=$DB_PASSWORD `
      --databases $DB_DATABASE `
      --single-transaction `
      --quick `
      --lock-tables=false `
      --routines `
      --triggers `
      --events `
      --result-file=$BACKUP_FILE

    if ($LASTEXITCODE -eq 0) {
        # Compress the backup using 7-Zip or built-in compression
        Write-Host "📦 Compressing backup..." -ForegroundColor Cyan

        Compress-Archive -Path $BACKUP_FILE -DestinationPath "$BACKUP_FILE.zip" -Force
        Remove-Item $BACKUP_FILE # Remove uncompressed file

        $COMPRESSED_FILE = "$BACKUP_FILE.zip"
        $FILE_SIZE = (Get-Item $COMPRESSED_FILE).Length / 1MB
        $FILE_SIZE_STR = "{0:N2} MB" -f $FILE_SIZE

        Write-Host ""
        Write-Host "✅ Backup completed successfully!" -ForegroundColor Green
        Write-Host "📁 File: $COMPRESSED_FILE"
        Write-Host "📊 Size: $FILE_SIZE_STR"
        Write-Host ""
        Write-Host "To restore this backup:" -ForegroundColor Yellow
        Write-Host "  Expand-Archive $COMPRESSED_FILE -DestinationPath ."
        Write-Host "  mysql -h $DB_HOST -u $DB_USERNAME -p $DB_DATABASE < $BACKUP_FILE"
    } else {
        throw "mysqldump failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host ""
    Write-Host "❌ Backup failed!" -ForegroundColor Red
    Write-Host "Error: $_"
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  - Database credentials are correct"
    Write-Host "  - You have network access to $DB_HOST"
    Write-Host "  - mysqldump is installed on your system"
    Write-Host "  - MySQL client tools are in your PATH"
    exit 1
}
