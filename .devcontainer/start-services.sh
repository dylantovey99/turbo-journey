#!/bin/bash

echo "🚀 Starting services for GitHub Codespaces..."

# Wait for Docker services to be ready
echo "⏳ Waiting for MongoDB and Redis to be ready..."

# Function to check if MongoDB is ready
check_mongodb() {
    docker-compose -f .devcontainer/docker-compose.yml exec -T mongodb mongosh --eval "db.runCommand('ping')" >/dev/null 2>&1
}

# Function to check if Redis is ready
check_redis() {
    docker-compose -f .devcontainer/docker-compose.yml exec -T redis redis-cli ping >/dev/null 2>&1
}

# Start services if they're not running
if ! docker-compose -f .devcontainer/docker-compose.yml ps mongodb | grep -q "Up"; then
    echo "🔄 Starting MongoDB..."
    docker-compose -f .devcontainer/docker-compose.yml up -d mongodb
fi

if ! docker-compose -f .devcontainer/docker-compose.yml ps redis | grep -q "Up"; then
    echo "🔄 Starting Redis..."
    docker-compose -f .devcontainer/docker-compose.yml up -d redis
fi

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
for i in {1..30}; do
    if check_mongodb && check_redis; then
        echo "✅ All services are ready!"
        break
    fi
    echo "⏳ Services not ready yet, waiting... ($i/30)"
    sleep 2
done

# Verify services are accessible
echo "🔍 Verifying service connectivity..."

# Test MongoDB connection
if check_mongodb; then
    echo "✅ MongoDB is accessible"
else
    echo "⚠️  MongoDB is not accessible"
fi

# Test Redis connection
if check_redis; then
    echo "✅ Redis is accessible"
else
    echo "⚠️  Redis is not accessible"
fi

echo "🎉 Service startup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Run 'npm run dev' to start the development server"
echo "  2. The application will be available at http://localhost:3000"
echo ""
echo "🔧 Available services:"
echo "  - MongoDB: mongodb://localhost:27017/email-generator-dev"
echo "  - Redis: redis://localhost:6379"