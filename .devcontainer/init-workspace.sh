#!/bin/bash

# Robust workspace initialization script for GitHub Codespaces
# Handles timing issues with workspace mounting

echo "🔄 Initializing workspace for GitHub Codespaces..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to wait for workspace to be ready
wait_for_workspace() {
    local max_attempts=30
    local attempt=1
    
    echo -e "${BLUE}⏳ Waiting for workspace to be mounted...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if [ -f "/workspaces/turbo-journey/package.json" ]; then
            echo -e "${GREEN}✅ Workspace is ready!${NC}"
            return 0
        fi
        
        if [ $((attempt % 5)) -eq 0 ]; then
            echo -e "${YELLOW}⏳ Still waiting for workspace... (${attempt}/${max_attempts})${NC}"
        fi
        
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}❌ Workspace failed to mount within $((max_attempts * 2)) seconds${NC}"
    return 1
}

# Function to run setup safely
run_setup() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    
    cd /workspaces/turbo-journey || {
        echo -e "${RED}❌ Failed to change to workspace directory${NC}"
        return 1
    }
    
    # Install dependencies
    if npm install; then
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        return 1
    fi
    
    # Setup environment
    echo -e "${BLUE}🔧 Setting up environment...${NC}"
    if npm run setup:env; then
        echo -e "${GREEN}✅ Environment configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Environment setup completed with warnings${NC}"
    fi
    
    # Build project
    echo -e "${BLUE}🔨 Building project...${NC}"
    if npm run build; then
        echo -e "${GREEN}✅ Project built successfully${NC}"
    else
        echo -e "${YELLOW}⚠️  Build completed with warnings${NC}"
    fi
    
    return 0
}

# Function to start services
start_services() {
    echo -e "${BLUE}🐳 Starting services...${NC}"
    
    cd /workspaces/turbo-journey || return 1
    
    if [ -f ".devcontainer/start-services.sh" ]; then
        bash .devcontainer/start-services.sh
    else
        echo -e "${YELLOW}⚠️  Service startup script not found${NC}"
        return 1
    fi
}

# Main execution
main() {
    local operation="$1"
    
    case "$operation" in
        "create")
            echo -e "${BLUE}🚀 Running post-create setup...${NC}"
            if wait_for_workspace; then
                run_setup
            else
                echo -e "${RED}❌ Workspace not ready, skipping automatic setup${NC}"
                echo -e "${YELLOW}💡 Run 'npm install && npm run setup:env && npm run build' manually${NC}"
            fi
            ;;
        "start")
            echo -e "${BLUE}🚀 Running post-start setup...${NC}"
            if wait_for_workspace; then
                start_services
            else
                echo -e "${YELLOW}⚠️  Workspace not ready, services will need to be started manually${NC}"
                echo -e "${YELLOW}💡 Run '.devcontainer/start-services.sh' manually when ready${NC}"
            fi
            ;;
        *)
            echo -e "${RED}❌ Invalid operation. Use 'create' or 'start'${NC}"
            return 1
            ;;
    esac
}

# Run the script
main "$@"