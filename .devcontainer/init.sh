#!/bin/bash

# GitHub Codespaces Initialization Script
echo "🚀 Initializing development environment..."

# Wait for workspace to be properly mounted
echo "⏳ Waiting for workspace files..."
timeout=30
counter=0
while [ ! -f "package.json" ] && [ $counter -lt $timeout ]; do
    echo "   Waiting for package.json... ($counter/$timeout)"
    sleep 1
    counter=$((counter + 1))
done

if [ ! -f "package.json" ]; then
    echo "❌ package.json not found after $timeout seconds"
    echo "   Current directory: $(pwd)"
    echo "   Files available: $(ls -la)"
    exit 1
fi

echo "✅ Workspace files detected"

# Install dependencies
echo "📦 Installing npm dependencies..."
if npm install; then
    echo "✅ npm install completed successfully"
else
    echo "❌ npm install failed"
    exit 1
fi

# Start database services
echo "🔄 Starting database services..."
if bash .devcontainer/startup.sh; then
    echo "✅ Database services started"
else
    echo "⚠️ Database services may have issues - continuing anyway"
fi

# Setup environment
echo "🔧 Setting up environment..."
if npm run setup:env; then
    echo "✅ Environment setup completed"
else
    echo "⚠️ Environment setup had issues - continuing anyway"
fi

echo "🎉 Development environment ready!"
echo ""
echo "📊 Quick Status Check:"
echo "   Node.js: $(node --version)"
echo "   npm: $(npm --version)"
echo "   Workspace: $(pwd)"
echo "   MongoDB: $(pgrep -f mongod > /dev/null && echo 'Running' || echo 'Not running')"
echo "   Redis: $(pgrep -f redis-server > /dev/null && echo 'Running' || echo 'Not running')"
echo ""
echo "🚀 Ready to start development with: npm run dev"