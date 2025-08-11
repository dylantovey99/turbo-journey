#!/bin/bash

# Database backup script for MongoDB
# Usage: ./scripts/backup.sh [environment]

set -e

# Default environment
ENVIRONMENT=${1:-production}

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="email-generator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if mongodump is available
if ! command -v mongodump &> /dev/null; then
    error "mongodump is not installed. Please install MongoDB tools."
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Set MongoDB URI based on environment
case $ENVIRONMENT in
    development)
        MONGO_URI="mongodb://localhost:27017/$DB_NAME-dev"
        ;;
    staging)
        MONGO_URI="mongodb://localhost:27017/$DB_NAME-staging"
        ;;
    production)
        MONGO_URI="${MONGODB_URI:-mongodb://localhost:27017/$DB_NAME}"
        ;;
    *)
        error "Invalid environment: $ENVIRONMENT"
        ;;
esac

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${ENVIRONMENT}_${DATE}"

log "Starting backup for environment: $ENVIRONMENT"
log "MongoDB URI: $MONGO_URI"
log "Backup location: $BACKUP_FILE"

# Create the backup
log "Creating MongoDB dump..."
mongodump --uri="$MONGO_URI" --out="$BACKUP_FILE"

# Compress the backup
log "Compressing backup..."
tar -czf "${BACKUP_FILE}.tar.gz" -C "$BACKUP_DIR" "$(basename "$BACKUP_FILE")"

# Remove uncompressed directory
rm -rf "$BACKUP_FILE"

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_FILE}.tar.gz" | cut -f1)

success "Backup created successfully!"
log "Backup file: ${BACKUP_FILE}.tar.gz"
log "Backup size: $BACKUP_SIZE"

# Clean up old backups (keep last 10)
log "Cleaning up old backups..."
ls -t "$BACKUP_DIR"/${DB_NAME}_${ENVIRONMENT}_*.tar.gz | tail -n +11 | xargs -r rm -f

success "Backup process completed!"

# List recent backups
log "Recent backups for $ENVIRONMENT:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_${ENVIRONMENT}_*.tar.gz | head -5