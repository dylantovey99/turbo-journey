# Deployment Guide

This guide covers deploying the Personalized Email Generator to various cloud platforms.

## Prerequisites

Before deploying, ensure you have:

1. **MongoDB Database** (MongoDB Atlas recommended for production)
2. **Redis Cache** (Redis Cloud or AWS ElastiCache)
3. **Anthropic API Key** for Claude AI functionality
4. **Missive API Token** for email integration
5. **Environment Variables** configured (see `.env.production` template)

## Platform-Specific Deployment

### Railway

Railway is the recommended platform for easy deployment with automatic builds.

1. **Connect Repository**
   ```bash
   # Railway will automatically detect the configuration from railway.toml
   ```

2. **Environment Variables**
   Set these in Railway dashboard:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/email-generator
   REDIS_URL=rediss://username:password@host:6380
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   MISSIVE_API_TOKEN=missive_pat-your-token-here
   JWT_SECRET=your-secure-jwt-secret-32-chars-min
   ```

3. **Add Services**
   - MongoDB: Use Railway's MongoDB add-on or external MongoDB Atlas
   - Redis: Use Railway's Redis add-on or external Redis Cloud

4. **Deploy**
   Railway will automatically build and deploy on git push.

### Netlify

Netlify deployment uses serverless functions for API routes.

1. **Environment Variables**
   Set in Netlify dashboard or `netlify.toml`:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/email-generator
   REDIS_URL=rediss://username:password@host:6380
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   MISSIVE_API_TOKEN=missive_pat-your-token-here
   ```

2. **Serverless Functions**
   API routes are handled by Netlify Functions (configured in `netlify.toml`)

3. **Build Settings**
   - Build command: `npm ci && npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`

### GitHub Codespaces

Perfect for development and testing environments.

1. **Open in Codespaces**
   Click "Code" → "Codespaces" → "Create codespace on main"

2. **Automatic Setup**
   The devcontainer will automatically:
   - Install dependencies
   - Set up MongoDB and Redis containers
   - Configure development environment
   - Build the project

3. **Environment Configuration**
   Update `.env` file with your API keys:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Render

1. **Create Web Service**
   - Connect your GitHub repository
   - Build command: `npm ci && npm run build`
   - Start command: `npm start`

2. **Environment Variables**
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/email-generator
   REDIS_URL=rediss://username:password@host:6380
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   MISSIVE_API_TOKEN=missive_pat-your-token-here
   ```

3. **Add Services**
   - PostgreSQL: Render's managed PostgreSQL (if switching from MongoDB)
   - Redis: Render's managed Redis

### Heroku

1. **Create App**
   ```bash
   heroku create your-app-name
   ```

2. **Add Buildpacks**
   ```bash
   heroku buildpacks:add heroku/nodejs
   heroku buildpacks:add jontewks/puppeteer
   ```

3. **Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/email-generator
   heroku config:set REDIS_URL=rediss://username:password@host:6380
   heroku config:set ANTHROPIC_API_KEY=sk-ant-your-key-here
   heroku config:set MISSIVE_API_TOKEN=missive_pat-your-token-here
   heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

## Required Environment Variables

### Critical Variables (Required)
- `NODE_ENV=production`
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secure random string (min 32 characters)

### API Keys (Required for full functionality)
- `ANTHROPIC_API_KEY` - Claude AI API key
- `MISSIVE_API_TOKEN` - Missive integration token

### Optional Configuration
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)
- `SCRAPING_TIMEOUT` - Web scraping timeout (default: 30000ms)
- `CLAUDE_MAX_TOKENS` - Max tokens per Claude request (default: 2000)

## Database Setup

### MongoDB Atlas
1. Create cluster at https://cloud.mongodb.com
2. Create database user
3. Whitelist IP addresses or use 0.0.0.0/0 for all IPs
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/email-generator`

### Redis Cloud
1. Create database at https://redis.com/try-free/
2. Get connection string: `rediss://username:password@host:6380`

## Post-Deployment Checklist

1. **Health Check**: Visit `/health` endpoint
2. **Environment Validation**: Check logs for validation warnings
3. **Database Connection**: Verify MongoDB and Redis connectivity
4. **API Functionality**: Test email generation with sample data
5. **Monitoring**: Set up logging and error tracking
6. **Security**: Ensure all secrets are properly configured

## Troubleshooting

### Common Issues

1. **Module Resolution Errors**
   - Ensure TypeScript path aliases are resolved correctly
   - Check that `module-alias` is properly configured

2. **Database Connection Timeouts**
   - Verify connection strings and credentials
   - Check network connectivity and firewall rules
   - Ensure IP whitelist includes deployment platform IPs

3. **Puppeteer Issues**
   - Set `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
   - Configure `PUPPETEER_EXECUTABLE_PATH` for the platform
   - Install required system dependencies

4. **Memory Issues**
   - Monitor memory usage and adjust plan if needed
   - Optimize scraping operations and connection pooling

5. **API Rate Limits**
   - Configure appropriate rate limits for external APIs
   - Implement exponential backoff for retries

### Debug Commands

```bash
# Check environment validation
curl https://your-app.com/health

# View application logs
heroku logs --tail  # For Heroku
railway logs        # For Railway

# Test database connections
# MongoDB
mongosh "mongodb+srv://cluster.mongodb.net/email-generator" --username your-username

# Redis
redis-cli -u redis://your-redis-url ping
```

## Performance Optimization

1. **Database Indexing**: Ensure proper indexes on frequently queried fields
2. **Connection Pooling**: Configure appropriate pool sizes for your load
3. **Caching**: Utilize Redis for caching frequently accessed data
4. **Rate Limiting**: Implement appropriate rate limits to prevent abuse
5. **Monitoring**: Set up application performance monitoring (APM)

For more detailed configuration options, see the `.env.production` template and platform-specific documentation.