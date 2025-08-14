#!/bin/bash

echo "🚀 Starting development server with dependency checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is ready
check_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}⏳ Waiting for $service_name to be ready...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if eval $check_command >/dev/null 2>&1; then
            echo -e "${GREEN}✅ $service_name is ready!${NC}"
            return 0
        fi
        
        if [ $((attempt % 5)) -eq 0 ]; then
            echo -e "${YELLOW}⏳ Still waiting for $service_name... (${attempt}/${max_attempts})${NC}"
        fi
        
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ $service_name failed to start within $((max_attempts * 2)) seconds${NC}"
    return 1
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
fi

# Set up environment
echo -e "${BLUE}🔧 Setting up environment...${NC}"
npm run setup:env || echo -e "${YELLOW}⚠️  Environment setup completed with warnings${NC}"

# Build the project
echo -e "${BLUE}🔨 Building project...${NC}"
npm run build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

# Start Docker services if they're not running
echo -e "${BLUE}🐳 Starting Docker services...${NC}"

# Check if docker-compose is available
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

# Start services using the devcontainer compose file if in Codespaces, otherwise use main compose file
if [ -n "$CODESPACES" ] || [ -n "$CODESPACE_NAME" ]; then
    COMPOSE_FILE=".devcontainer/docker-compose.yml"
else
    COMPOSE_FILE="docker-compose.dev.yml"
    if [ ! -f "$COMPOSE_FILE" ]; then
        COMPOSE_FILE="docker-compose.yml"
    fi
fi

echo -e "${BLUE}📋 Using compose file: $COMPOSE_FILE${NC}"

# Start MongoDB and Redis
$COMPOSE_CMD -f $COMPOSE_FILE up -d mongodb redis

# Wait for services to be ready
echo -e "${BLUE}🔍 Checking service health...${NC}"

# Check MongoDB
if ! check_service "MongoDB" "mongosh mongodb://localhost:27017/test --eval 'db.runCommand(\"ping\")' --quiet"; then
    echo -e "${RED}❌ MongoDB failed to start. Checking logs...${NC}"
    $COMPOSE_CMD -f $COMPOSE_FILE logs mongodb | tail -10
    exit 1
fi

# Check Redis
if ! check_service "Redis" "redis-cli -h localhost -p 6379 ping"; then
    echo -e "${RED}❌ Redis failed to start. Checking logs...${NC}"
    $COMPOSE_CMD -f $COMPOSE_FILE logs redis | tail -10
    exit 1
fi

# All services are ready, start the main application
echo -e "${GREEN}🎉 All services are ready! Starting application server...${NC}"
echo -e "${BLUE}📍 Application will be available at: http://localhost:3000${NC}"
echo -e "${BLUE}🔧 Health check endpoint: http://localhost:3000/health${NC}"
echo ""
echo -e "${YELLOW}💡 Press Ctrl+C to stop the server${NC}"
echo ""

# Start the development server
npm run dev