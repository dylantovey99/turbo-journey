#!/bin/bash

# Auto-start script for GitHub Codespaces
# This script runs automatically when the devcontainer starts

echo "🔄 Auto-start script running..."

# Check if we're in GitHub Codespaces
if [ -z "$CODESPACES" ] && [ -z "$CODESPACE_NAME" ]; then
    echo "ℹ️  Not in GitHub Codespaces, skipping auto-start"
    exit 0
fi

# Wait a moment for the container to fully initialize
sleep 5

# Check if the application was already built
if [ ! -d "dist" ] || [ ! -f "dist/server.js" ]; then
    echo "🔨 Building application..."
    npm run build || {
        echo "❌ Build failed, will try again later"
        exit 1
    }
fi

# Wait for services to be ready before trying to start the app
echo "⏳ Waiting for services to be ready..."

# Function to check service
check_service_ready() {
    local service=$1
    local check_cmd=$2
    local max_attempts=15
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if eval $check_cmd >/dev/null 2>&1; then
            echo "✅ $service is ready"
            return 0
        fi
        sleep 2
        ((attempt++))
    done
    
    echo "⚠️  $service not ready after ${max_attempts} attempts"
    return 1
}

# Check MongoDB
check_service_ready "MongoDB" "mongosh mongodb://localhost:27017/test --eval 'db.runCommand(\"ping\")' --quiet"

# Check Redis  
check_service_ready "Redis" "redis-cli -h localhost -p 6379 ping"

echo "🎉 Auto-start complete! Services are ready."
echo ""
echo "💡 To start the development server, run:"
echo "   npm run dev"
echo "   npm run dev:full  (includes dependency checks)"
echo ""
echo "🌐 Application will be available at:"
echo "   http://localhost:3000"