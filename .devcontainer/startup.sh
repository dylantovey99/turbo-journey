#!/bin/bash

# GitHub Codespaces Database Startup Script
echo "🚀 Starting database services..."

# Start MongoDB in background
echo "📦 Starting MongoDB..."
sudo mkdir -p /data/db
sudo chown -R $(whoami) /data/db
mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db

# Start Redis in background  
echo "🔄 Starting Redis..."
sudo redis-server /etc/redis/redis.conf &

# Wait a moment for services to start
sleep 3

# Check if services are running
echo "🔍 Checking service status..."

if pgrep -x "mongod" > /dev/null; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB failed to start"
fi

if pgrep -x "redis-server" > /dev/null; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
fi

echo "🎉 Database startup complete!"