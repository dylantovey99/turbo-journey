#!/bin/bash

# GitHub Codespaces Database Startup Script
echo "🚀 Starting database services..."

# Ensure MongoDB data directory exists with proper permissions
echo "📦 Setting up MongoDB..."
sudo mkdir -p /data/db
sudo chown -R mongodb:mongodb /data/db
sudo chmod 755 /data/db

# Start MongoDB as a service
echo "📦 Starting MongoDB..."
if sudo systemctl start mongod 2>/dev/null || sudo mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db; then
    echo "✅ MongoDB startup initiated"
else
    echo "⚠️ MongoDB startup may have issues - attempting alternative start"
    sudo -u mongodb mongod --fork --logpath /var/log/mongodb.log --dbpath /data/db &
fi

# Start Redis
echo "🔄 Starting Redis..."
if sudo systemctl start redis-server 2>/dev/null || sudo redis-server /etc/redis/redis.conf --daemonize yes; then
    echo "✅ Redis startup initiated"
else
    echo "⚠️ Starting Redis manually"
    sudo redis-server /etc/redis/redis.conf &
fi

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 5

# Check if services are running
echo "🔍 Checking service status..."

if pgrep -f "mongod" > /dev/null; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB is not running"
fi

if pgrep -f "redis-server" > /dev/null; then
    echo "✅ Redis is running"
else
    echo "❌ Redis is not running"
fi

echo "🎉 Database startup complete!"