# GitHub Codespaces Development Environment

This devcontainer configuration provides a complete development environment for the Personalized Email Generator project.

## What's Included

### 🛠️ Development Tools
- **Node.js 18** with npm and development dependencies
- **GitHub CLI** for repository management
- **VS Code extensions** for TypeScript, Prettier, and testing

### 🗄️ Database Services
- **MongoDB 6.0** with MongoDB Express web interface (port 8081)
- **Redis 7** with Redis Commander web interface (port 8082)

### 🔌 Port Forwarding
- **3001**: Main application
- **27017**: MongoDB database
- **6379**: Redis cache
- **8081**: MongoDB Express (admin/admin)
- **8082**: Redis Commander

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

### MongoDB Express
- URL: `http://localhost:8081`
- Username: `admin`
- Password: `admin`

### Redis Commander  
- URL: `http://localhost:8082`
- No authentication required

## Environment Configuration

The devcontainer automatically uses `.env.codespaces` for configuration. Key variables:

- `MONGODB_URI`: `mongodb://mongo:27017/email-generator-dev`
- `REDIS_URL`: `redis://redis:6379`  
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
- Ensure MongoDB service is running: `docker-compose ps`
- Check logs: `docker-compose logs mongo`

### Application Issues
- Check environment variables: `npm run verify:env`
- View application logs in terminal running `npm run dev`

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │    │     MongoDB     │    │      Redis      │
│    Port 3001    │◄──►│   Port 27017    │    │   Port 6379     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │ MongoDB Express │    │ Redis Commander │
         │              │   Port 8081     │    │   Port 8082     │
         │              └─────────────────┘    └─────────────────┘
         │
┌─────────────────┐
│   VS Code IDE   │
│   Extensions    │
└─────────────────┘
```

## Performance Notes

- The devcontainer mounts the workspace with `:cached` for better performance
- `node_modules` and `dist` are excluded from sync to improve file watching
- Hot reload is enabled for TypeScript development