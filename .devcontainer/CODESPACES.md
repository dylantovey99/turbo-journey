# GitHub Codespaces Setup

This directory contains the configuration for running the Personalized Email Generator in GitHub Codespaces.

## Quick Start

1. **Open in Codespaces**: Click "Code" → "Codespaces" → "Create codespace on main"
2. **Wait for Setup**: The container will automatically install dependencies and build the project
3. **Start Development**: Run `npm run dev` when setup completes
4. **Access Application**: Open http://localhost:3000

## Automatic Setup

The devcontainer automatically:
- ✅ Installs Node.js 20 and development tools
- ✅ Starts MongoDB and Redis services
- ✅ Installs npm dependencies
- ✅ Builds the TypeScript project
- ✅ Configures environment for Codespaces

## Manual Setup (if auto-setup fails)

If the automatic setup encounters issues:

```bash
# Install dependencies
npm install

# Setup environment
npm run setup:env

# Build project
npm run build

# Start services (if needed)
bash .devcontainer/start-services.sh

# Start development server
npm run dev
```

## Available Services

- **MongoDB**: `mongodb://localhost:27017/email-generator-dev`
- **Redis**: `redis://localhost:6379`
- **Application**: `http://localhost:3000`

## Scripts

- `npm run dev` - Start development server
- `npm run dev:full` - Start with full service checks
- `npm run build` - Build for production
- `npm run test` - Run tests
- `bash .devcontainer/start-services.sh` - Start/check services

## Troubleshooting

### Services Not Starting
```bash
# Check service status
docker-compose -f .devcontainer/docker-compose.yml ps

# Restart services
docker-compose -f .devcontainer/docker-compose.yml restart mongodb redis

# Check logs
docker-compose -f .devcontainer/docker-compose.yml logs mongodb
docker-compose -f .devcontainer/docker-compose.yml logs redis
```

### Build Issues
```bash
# Clean and rebuild
npm run build:clean
npm run build

# Check TypeScript
npm run typecheck
```

### Environment Issues
```bash
# Reconfigure environment
npm run setup:env

# Check environment
node scripts/verify-environment.js
```

## Health Check

The application includes a health endpoint at `/health` that checks:
- Application status
- MongoDB connectivity
- Redis connectivity

Visit http://localhost:3000/health to verify all services are running.