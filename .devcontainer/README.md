# GitHub Codespaces Development Environment

This devcontainer provides a complete, Codespaces-native development environment for the Personalized Email Generator project using Docker Compose services.

## What's Included

### 🛠️ Development Tools
- **Node.js 20** with npm and development dependencies
- **GitHub CLI** for repository management
- **VS Code extensions** for TypeScript, Prettier, testing, and MongoDB
- **Chromium browser** support for Puppeteer web scraping

### 🗄️ Database Services
- **MongoDB 6.0** - Full-featured database with initialization scripts
- **Redis 7** - High-performance caching and queue management

### 🔌 Port Forwarding
- **3001**: Main application
- **27017**: MongoDB database  
- **6379**: Redis cache

## Getting Started

1. **Open in Codespaces** - Container builds automatically
2. **Wait for setup** - Dependencies install automatically via `postCreateCommand`
3. **Services ready** - MongoDB and Redis start automatically
4. **Start development** - Run `npm run dev`
5. **Access application** - Use forwarded port 3001

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint

# Setup environment (runs automatically)
npm run setup:env
```

## Database Access

### MongoDB
- **Connection**: `mongodb://mongodb:27017/email-generator-dev`
- **Admin User**: `admin` / `password`
- **VS Code Extension**: Use MongoDB extension for GUI access
- **CLI Access**: Connect via VS Code terminal using `mongosh`

### Redis
- **Connection**: `redis://redis:6379`
- **CLI Access**: Use `redis-cli` in terminal
- **VS Code Extension**: Available for Redis management

## Environment Configuration

The devcontainer uses `.env.codespaces` with Docker Compose service networking:

- `MONGODB_URI`: `mongodb://mongodb:27017/email-generator-dev`
- `REDIS_URL`: `redis://redis:6379`
- `PORT`: `3001`

## API Keys (Optional)

For full functionality, add to `.env.codespaces`:

```bash
ANTHROPIC_API_KEY=your-anthropic-key
MISSIVE_API_TOKEN=your-missive-token
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     GitHub Codespaces                   │
│                                                         │
│  ┌─────────────────┐    ┌─────────────────┐            │
│  │   Application   │    │     MongoDB     │            │
│  │  (Node.js 20)   │◄──►│   mongodb:27017 │            │
│  │   Port 3001     │    └─────────────────┘            │
│  └─────────────────┘              │                     │
│           │                       │                     │
│           │              ┌─────────────────┐            │
│           │              │      Redis      │            │
│           └─────────────►│   redis:6379    │            │
│                          └─────────────────┘            │
│  ┌─────────────────┐                                    │
│  │   VS Code IDE   │                                    │
│  │   Extensions    │                                    │
│  │   Workspace     │                                    │
│  └─────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
```

## Service Architecture

- **Docker Compose**: Orchestrates all services with proper networking
- **Workspace Mounting**: Repository mounted to `/workspaces/turbo-journey`
- **Service Networking**: Services communicate via Docker Compose network
- **Automatic Startup**: All services start together with container

## Troubleshooting

### Container Issues
- **Rebuild container**: `Cmd/Ctrl + Shift + P` → "Codespaces: Rebuild Container"
- **Check logs**: View container logs in VS Code terminal

### Database Connection Issues
- **MongoDB status**: `docker-compose ps` to check service status
- **Redis status**: All services should show "Up" status
- **Service logs**: `docker-compose logs mongodb` or `docker-compose logs redis`

### Application Issues
- **Environment check**: `npm run verify:env`
- **Service restart**: Restart Codespaces or rebuild container
- **Port forwarding**: Check VS Code ports panel

## Performance Benefits

- **Native Codespaces integration**: Uses platform conventions and optimizations
- **Docker Compose orchestration**: Reliable service management and networking
- **Cached workspace mounting**: Fast file operations and hot reload
- **Standard base images**: Optimized containers from Microsoft
- **Automatic service startup**: No manual database management needed

This architecture leverages GitHub Codespaces' strengths while providing a complete, reliable development environment for the email generator project.