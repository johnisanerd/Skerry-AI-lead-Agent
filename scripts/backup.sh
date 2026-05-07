#!/bin/bash
#
# Skerry AI - Database Backup Script
# 
# This script creates a backup of the Supabase PostgreSQL database
# and stores it locally with timestamp.
#
# Usage: ./scripts/backup.sh
# 
# Requirements:
#   - pg_dump installed (comes with PostgreSQL)
#   - DATABASE_URL environment variable set (or in .env.production)
#

set -e

# Load environment variables if .env.production exists
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
fi

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/skerry_backup_$TIMESTAMP.sql"
RETENTION_DAYS=30  # Keep backups for 30 days

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL is not set"
    echo "Please set DATABASE_URL or create .env.production with it"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)..."

# Extract connection details from DATABASE_URL
# Expected format: postgresql://user:password@host:port/database
DB_URL=$DATABASE_URL

echo "Creating backup: $BACKUP_FILE"

# Run pg_dump
pg_dump "$DB_URL" > "$BACKUP_FILE"

# Check if backup was successful
if [ $? -eq 0 ]; then
    # Compress the backup
    gzip "$BACKUP_FILE"
    echo "Backup completed successfully: ${BACKUP_FILE}.gz"
    
    # Get file size
    FILE_SIZE=$(ls -lh "${BACKUP_FILE}.gz" | awk '{print $5}')
    echo "Backup size: $FILE_SIZE"
else
    echo "ERROR: Backup failed"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Clean up old backups (older than RETENTION_DAYS)
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "skerry_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# List current backups
echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR"/skerry_backup_*.sql.gz 2>/dev/null || echo "No backups found"

echo ""
echo "Backup process completed at $(date)"
