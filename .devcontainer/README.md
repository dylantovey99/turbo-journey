# GitHub Codespaces Development Environment

This devcontainer configuration provides a streamlined, reliable development environment for the Personalized Email Generator project using a single-container approach optimized for Codespaces.

## What's Included

### 🛠️ Development Tools
- **Node.js 20** with npm and development dependencies
- **GitHub CLI** for repository management
- **VS Code extensions** for TypeScript, Prettier, and testing
- **Chromium browser** for Puppeteer web scraping

### 🗄️ Database Services (Self-Contained)
- **MongoDB 6.0** installed and auto-started on localhost:27017
- **Redis 7** installed and auto-started on localhost:6379

### 🔌 Port Forwarding
- **3001**: Main application
- **27017**: MongoDB database
- **6379**: Redis cache

## Getting Started

1. **Wait for container to build** - This may take a few minutes on first launch
2. **Automatic setup** - The initialization script will:
   - Wait for workspace files to be mounted
   - Install npm dependencies automatically
   - Start MongoDB and Redis services
   - Configure the development environment
3. **Start development server** - Run `npm run dev`
4. **Access the application** at the forwarded port 3001

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Setup environment
npm run setup:env

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Database Access

### MongoDB
- **Connection**: `mongodb://localhost:27017/email-generator-dev`
- **CLI Access**: Use `mongosh` command in terminal
- **GUI Access**: Use VS Code MongoDB extension or external client

### Redis
- **Connection**: `redis://localhost:6379`
- **CLI Access**: Use `redis-cli` command in terminal
- **GUI Access**: Use VS Code Redis extension or external client

## Environment Configuration

The devcontainer automatically uses `.env.codespaces` for configuration. Key variables:

- `MONGODB_URI`: `mongodb://localhost:27017/email-generator-dev`
- `REDIS_URL`: `redis://localhost:6379`  
- `PORT`: `3001`

## Optional API Keys

For full functionality, add these to `.env.codespaces`:

```bash
ANTHROPIC_API_KEY=your-anthropic-key
MISSIVE_API_TOKEN=your-missive-token
```

## Troubleshooting

### Container Build Issues
- Check Docker logs in VS Code terminal
- Rebuild container: `Cmd/Ctrl + Shift + P` → "Codespaces: Rebuild Container"

### Database Connection Issues
- Check MongoDB status: `pgrep mongod`
- Check Redis status: `pgrep redis-server`
- Restart services: `bash .devcontainer/startup.sh`
- View MongoDB logs: `tail -f /var/log/mongodb.log`

### Application Issues
- Check environment variables: `npm run verify:env`
- View application logs in terminal running `npm run dev`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GitHub Codespaces                   │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │   Application   │    │     MongoDB     │            │
│  │    Port 3001    │◄──►│ localhost:27017 │            │
│  └─────────────────┘    └─────────────────┘            │
│           │                       │                     │
│           │              ┌─────────────────┐            │
│           │              │      Redis      │            │
│           └─────────────►│ localhost:6379  │            │
│                          └─────────────────┘            │
│  ┌─────────────────┐                                    │
│  │   VS Code IDE   │                                    │
│  │   Extensions    │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

## Performance Notes

- **Single container approach**: Faster build and startup times
- **Self-contained databases**: MongoDB and Redis installed directly in container
- **Automatic startup**: Databases start automatically with container
- **Efficient file mounting**: Direct workspace access without volume complexity
- **Reduced resource usage**: Better performance in Codespaces environment