#!/bin/bash

# Email Generator Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environments: development, staging, production

set -e

# Default environment
ENVIRONMENT=${1:-production}

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

# Check if environment is valid
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT. Use development, staging, or production."
fi

log "Starting deployment for environment: $ENVIRONMENT"

# Check if required files exist
if [ ! -f "package.json" ]; then
    error "package.json not found. Are you in the project root?"
fi

if [ ! -f "ecosystem.config.js" ]; then
    error "ecosystem.config.js not found. PM2 configuration is required."
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log "PM2 not found. Installing PM2..."
    npm install -g pm2
fi

# Stop existing processes
log "Stopping existing PM2 processes..."
pm2 stop ecosystem.config.js --env $ENVIRONMENT || warning "No existing processes to stop"

# Install dependencies
log "Installing dependencies..."
npm ci --production

# Build the application
log "Building application..."
npm run build

# Create required directories
log "Creating required directories..."
mkdir -p logs uploads

# Set permissions
log "Setting permissions..."
chmod -R 755 logs uploads

# Database migration (if needed)
if [ -f "scripts/migrate.js" ]; then
    log "Running database migrations..."
    node scripts/migrate.js
fi

# Start PM2 processes
log "Starting PM2 processes..."
pm2 start ecosystem.config.js --env $ENVIRONMENT

# Save PM2 configuration
log "Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
log "Setting up PM2 startup script..."
pm2 startup

# Health check
log "Performing health check..."
sleep 10

# Check if the main application is running
if pm2 list | grep -q "email-generator-api.*online"; then
    success "Main application is running"
else
    error "Main application failed to start"
fi

# Check if workers are running
if pm2 list | grep -q "email-queue-worker.*online"; then
    success "Email queue worker is running"
else
    warning "Email queue worker is not running"
fi

if pm2 list | grep -q "scraping-worker.*online"; then
    success "Scraping worker is running"
else
    warning "Scraping worker is not running"
fi

# Test HTTP endpoint
log "Testing HTTP endpoint..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    success "HTTP health check passed"
else
    error "HTTP health check failed"
fi

# Display status
log "Deployment completed! Here's the current status:"
pm2 list
pm2 logs --lines 10

success "Deployment to $ENVIRONMENT completed successfully!"
log "Application is available at: http://localhost:3000"
log "PM2 monitoring: pm2 monit"
log "View logs: pm2 logs"