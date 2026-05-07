#!/bin/bash
#
# Skerry AI - Database Restore Script
# 
# This script restores a database from a backup file.
#
# Usage: ./scripts/restore.sh <backup_file>
#   Example: ./scripts/restore.sh ./backups/skerry_backup_20260507_123456.sql.gz
#
# Requirements:
#   - psql installed (comes with PostgreSQL)
#   - DATABASE_URL environment variable set (or in .env.production)
#

set -e

BACKUP_FILE=$1

# Check if backup file is provided
if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: No backup file specified"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh ./backups/skerry_backup_*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
    exit 1
fi

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Load environment variables if .env.production exists
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    echo "Please set DATABASE_URL or create .env.production with it"
    exit 1
fi

echo "========================================="
echo "Skerry AI - Database Restore"
echo "========================================="
echo "Backup file: $BACKUP_FILE"
echo "Target database: (from DATABASE_URL)"
echo ""
echo "WARNING: This will DESTROY all data in the target database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Starting restore at $(date)..."

# Decompress if gzipped
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup file..."
    TEMP_SQL=$(mktemp)
    gunzip -c "$BACKUP_FILE" > "$TEMP_SQL"
    RESTORE_FILE="$TEMP_SQL"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Restore the database
echo "Restoring database..."
psql "$DATABASE_URL" -f "$RESTORE_FILE"

# Clean up temp file if created
if [ -n "$TEMP_SQL" ] && [ -f "$TEMP_SQL" ]; then
    rm -f "$TEMP_SQL"
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "Restore completed successfully at $(date)"
    echo ""
    echo "Next steps:"
    echo "  1. Verify data integrity"
    echo "  2. Restart the application server"
    echo "  3. Check application health at /api/health"
else
    echo "ERROR: Restore failed"
    exit 1
fi
