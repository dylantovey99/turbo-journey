# GitHub Codespaces Development Environment

This devcontainer configuration provides a streamlined, reliable development environment for the Personalized Email Generator project using a single-container approach optimized for Codespaces.

## What's Included

### 🛠️ Development Tools
- **Node.js 18** with npm and development dependencies
- **GitHub CLI** for repository management
- **VS Code extensions** for TypeScript, Prettier, and testing
- **Chromium browser** for Puppeteer web scraping

### 🗄️ Database Services (via Codespaces Features)
- **MongoDB 6.0** running on localhost:27017
- **Redis 7** running on localhost:6379

### 🔌 Port Forwarding
- **3001**: Main application
- **27017**: MongoDB database
- **6379**: Redis cache

## Getting Started

1. **Wait for container to build** - This may take a few minutes on first launch
2. **Install dependencies** - Run `npm install` if not already done
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
- Check MongoDB status: `sudo systemctl status mongodb`
- Check Redis status: `sudo systemctl status redis`
- Restart services if needed: `sudo systemctl restart mongodb redis`

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
- **Codespaces features**: Optimized MongoDB and Redis installations
- **Efficient file mounting**: Direct workspace access without volume complexity
- **Reduced resource usage**: Better performance in Codespaces environment