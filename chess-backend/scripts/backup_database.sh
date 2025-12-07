#!/bin/bash

# Chess99 Academy Database Backup Script
# Critical for academy transformation compliance
# Usage: ./scripts/backup_database.sh [backup_type]

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/database/backups"
DB_PATH="$PROJECT_ROOT/database/database.sqlite"
DATE_FORMAT=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$PROJECT_ROOT/storage/logs/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if database exists
check_database() {
    if [ ! -f "$DB_PATH" ]; then
        log_message "ERROR: Database file not found at $DB_PATH"
        exit 1
    fi
}

# Function to get database size
get_db_size() {
    if [ -f "$DB_PATH" ]; then
        stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# Function to verify database integrity
verify_database() {
    log_message "Verifying database integrity..."

    # Check if database is accessible
    if ! php "$PROJECT_ROOT/artisan" tinker --execute="DB::select('SELECT count(*) as count FROM users');" > /dev/null 2>&1; then
        log_message "ERROR: Database integrity check failed"
        return 1
    fi

    log_message "Database integrity check passed"
    return 0
}

# Function to create backup
create_backup() {
    local backup_type=${1:-"regular"}
    local backup_file="$BACKUP_DIR/chess_web_backup_${backup_type}_${DATE_FORMAT}.sqlite"

    log_message "Starting ${backup_type} database backup..."
    log_message "Database path: $DB_PATH"
    log_message "Backup file: $backup_file"

    # Check database exists
    check_database

    # Get original database size
    original_size=$(get_db_size)
    log_message "Original database size: $original_size bytes"

    # Create backup copy
    if cp "$DB_PATH" "$backup_file"; then
        backup_size=$(get_db_size "$backup_file")
        log_message "Backup created successfully: $backup_file"
        log_message "Backup size: $backup_size bytes"

        # Verify backup integrity
        if verify_database; then
            log_message "Backup verified and ready"

            # Create compressed version for long-term storage
            if command -v gzip >/dev/null 2>&1; then
                gzip -c "$backup_file" > "${backup_file}.gz"
                log_message "Compressed backup created: ${backup_file}.gz"
            fi

            return 0
        else
            log_message "ERROR: Backup verification failed"
            rm -f "$backup_file" "${backup_file}.gz"
            return 1
        fi
    else
        log_message "ERROR: Failed to create backup copy"
        return 1
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    local keep_days=${1:-30}

    log_message "Cleaning up backups older than $keep_days days..."

    # Remove old uncompressed backups
    find "$BACKUP_DIR" -name "chess_web_backup_*.sqlite" -type f -mtime +$keep_days -delete

    # Remove old compressed backups
    find "$BACKUP_DIR" -name "chess_web_backup_*.sqlite.gz" -type f -mtime +$keep_days -delete

    # Keep at least 5 most recent backups regardless of age
    cd "$BACKUP_DIR"
    ls -t chess_web_backup_*.sqlite.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
    ls -t chess_web_backup_*.sqlite 2>/dev/null | tail -n +6 | xargs -r rm -f

    log_message "Cleanup completed"
}

# Function to list available backups
list_backups() {
    log_message "Available database backups:"

    if [ -d "$BACKUP_DIR" ]; then
        ls -lah "$BACKUP_DIR"/chess_web_backup_*.sqlite* 2>/dev/null || log_message "No backups found"
    else
        log_message "Backup directory not found"
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"

    if [ -z "$backup_file" ]; then
        log_message "ERROR: Backup file path required"
        echo "Usage: $0 restore <backup_file_path>"
        exit 1
    fi

    if [ ! -f "$backup_file" ]; then
        log_message "ERROR: Backup file not found: $backup_file"
        exit 1
    fi

    log_message "Restoring database from: $backup_file"

    # Create backup of current database before restore
    local emergency_backup="$BACKUP_DIR/emergency_backup_before_restore_$(date +%Y%m%d_%H%M%S).sqlite"
    if [ -f "$DB_PATH" ]; then
        cp "$DB_PATH" "$emergency_backup"
        log_message "Emergency backup created: $emergency_backup"
    fi

    # Copy backup to database location
    if cp "$backup_file" "$DB_PATH"; then
        log_message "Database restored successfully"

        # Run Laravel migrations to ensure schema is up to date
        log_message "Running database migrations..."
        php "$PROJECT_ROOT/artisan" migrate --force

        log_message "Restore completed successfully"
    else
        log_message "ERROR: Failed to restore database"
        exit 1
    fi
}

# Main script execution
main() {
    local action=${1:-"backup"}
    local backup_type=${2:-"regular"}

    log_message "=== Chess99 Academy Database Backup Script ==="
    log_message "Action: $action"
    log_message "Project Root: $PROJECT_ROOT"

    case "$action" in
        "backup")
            if create_backup "$backup_type"; then
                cleanup_old_backups
                list_backups
                log_message "Backup process completed successfully"
                exit 0
            else
                log_message "ERROR: Backup process failed"
                exit 1
            fi
            ;;
        "critical")
            if create_backup "critical"; then
                # Keep critical backups for 90 days
                cleanup_old_backups 90
                log_message "Critical backup completed"
                exit 0
            else
                log_message "ERROR: Critical backup failed"
                exit 1
            fi
            ;;
        "migrate")
            # Backup before migration
            log_message "Creating pre-migration backup..."
            if create_backup "pre_migration"; then
                log_message "Pre-migration backup created successfully"
                exit 0
            else
                log_message "ERROR: Pre-migration backup failed"
                exit 1
            fi
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups "${2:-30}"
            ;;
        *)
            echo "Usage: $0 {backup|critical|migrate|restore|list|cleanup} [options]"
            echo ""
            echo "Actions:"
            echo "  backup     - Create regular backup"
            echo "  critical   - Create critical backup (before major changes)"
            echo "  migrate    - Create backup before migration"
            echo "  restore    - Restore from backup file"
            echo "  list       - List available backups"
            echo "  cleanup    - Clean up old backups"
            echo ""
            echo "Examples:"
            echo "  $0 backup"
            echo "  $0 critical"
            echo "  $0 restore /path/to/backup.sqlite"
            echo "  $0 cleanup 60"
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"