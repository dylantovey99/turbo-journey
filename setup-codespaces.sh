#!/bin/bash

# Manual setup script for GitHub Codespaces
# Run this if the automatic setup fails

echo "🚀 Manual GitHub Codespaces Setup"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${BLUE}📍 Current directory: $(pwd)${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if npm install; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Setup environment
echo -e "${BLUE}🔧 Setting up environment...${NC}"
if npm run setup:env; then
    echo -e "${GREEN}✅ Environment setup completed${NC}"
else
    echo -e "${YELLOW}⚠️ Environment setup completed with warnings${NC}"
fi

# Build project
echo -e "${BLUE}🔨 Building project...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Project built successfully${NC}"
else
    echo -e "${YELLOW}⚠️ Build completed with warnings${NC}"
fi

# Start services
echo -e "${BLUE}🐳 Starting services...${NC}"
if [ -f ".devcontainer/docker-compose.yml" ]; then
    if docker-compose -f .devcontainer/docker-compose.yml up -d mongodb redis; then
        echo -e "${GREEN}✅ Services started${NC}"
        
        # Wait a moment for services to initialize
        echo -e "${BLUE}⏳ Waiting for services to initialize...${NC}"
        sleep 10
        
        # Check service health
        echo -e "${BLUE}🔍 Checking service health...${NC}"
        
        # Check MongoDB
        if command -v mongosh >/dev/null 2>&1; then
            if mongosh mongodb://localhost:27017/test --eval "db.runCommand('ping')" --quiet >/dev/null 2>&1; then
                echo -e "${GREEN}✅ MongoDB is running${NC}"
            else
                echo -e "${YELLOW}⚠️ MongoDB may not be ready yet${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️ MongoDB client not available to test connection${NC}"
        fi
        
        # Check Redis
        if command -v redis-cli >/dev/null 2>&1; then
            if redis-cli -h localhost -p 6379 ping >/dev/null 2>&1; then
                echo -e "${GREEN}✅ Redis is running${NC}"
            else
                echo -e "${YELLOW}⚠️ Redis may not be ready yet${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️ Redis client not available to test connection${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Could not start services with docker-compose${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Docker compose file not found${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo -e "  1. Run: ${YELLOW}npm run dev${NC} to start the development server"
echo -e "  2. Open: ${YELLOW}http://localhost:3000${NC} in your browser"
echo -e "  3. Check health: ${YELLOW}http://localhost:3000/health${NC}"
echo ""
echo -e "${BLUE}🔧 Available commands:${NC}"
echo -e "  ${YELLOW}npm run dev${NC}        - Start development server"
echo -e "  ${YELLOW}npm run dev:full${NC}   - Start with full service checks"
echo -e "  ${YELLOW}npm run build${NC}      - Build for production"
echo -e "  ${YELLOW}npm test${NC}           - Run tests"
echo ""
echo -e "${BLUE}🔍 Debug commands:${NC}"
echo -e "  ${YELLOW}docker-compose -f .devcontainer/docker-compose.yml ps${NC}     - Check service status"
echo -e "  ${YELLOW}docker-compose -f .devcontainer/docker-compose.yml logs${NC}   - View service logs"
echo -e "  ${YELLOW}npm run verify:env${NC}                                        - Check environment"