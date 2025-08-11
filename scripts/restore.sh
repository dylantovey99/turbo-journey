#!/bin/bash

# Database restore script for MongoDB
# Usage: ./scripts/restore.sh <backup_file> [environment]

set -e

# Check arguments
if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup_file> [environment]"
    echo "Example: $0 ./backups/email-generator_production_20241201_143022.tar.gz production"
    exit 1
fi

BACKUP_FILE=$1
ENVIRONMENT=${2:-production}
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

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error "Backup file not found: $BACKUP_FILE"
fi

# Check if mongorestore is available
if ! command -v mongorestore &> /dev/null; then
    error "mongorestore is not installed. Please install MongoDB tools."
fi

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

log "Starting restore for environment: $ENVIRONMENT"
log "Backup file: $BACKUP_FILE"
log "MongoDB URI: $MONGO_URI"

# Confirm restore operation
warning "This will REPLACE all data in the $ENVIRONMENT database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log "Restore cancelled."
    exit 0
fi

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Extract backup
log "Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Find the extracted directory
EXTRACTED_DIR=$(find "$TEMP_DIR" -type d -name "${DB_NAME}*" | head -1)

if [ -z "$EXTRACTED_DIR" ]; then
    error "Could not find extracted database directory"
fi

log "Found extracted directory: $EXTRACTED_DIR"

# Drop existing database (if it exists)
log "Dropping existing database..."
mongo "$MONGO_URI" --eval "db.dropDatabase()" || warning "Could not drop database (it may not exist)"

# Restore the backup
log "Restoring database..."
mongorestore --uri="$MONGO_URI" --dir="$EXTRACTED_DIR"

success "Database restore completed successfully!"

# Verify restore
log "Verifying restore..."
COLLECTIONS=$(mongo "$MONGO_URI" --quiet --eval "db.getCollectionNames().join(', ')")
log "Collections found: $COLLECTIONS"

# Count documents in main collections
PROSPECT_COUNT=$(mongo "$MONGO_URI" --quiet --eval "db.prospects.countDocuments()")
CAMPAIGN_COUNT=$(mongo "$MONGO_URI" --quiet --eval "db.campaigns.countDocuments()")
JOB_COUNT=$(mongo "$MONGO_URI" --quiet --eval "db.emailjobs.countDocuments()")

log "Document counts:"
log "  - Prospects: $PROSPECT_COUNT"
log "  - Campaigns: $CAMPAIGN_COUNT"
log "  - Email Jobs: $JOB_COUNT"

success "Restore verification completed!"
log "Database has been restored from: $BACKUP_FILE"