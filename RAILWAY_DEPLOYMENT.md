# Railway Deployment Guide 🚂

## Quick Deployment Overview

Railway is now the recommended deployment platform for this application. This guide will get you deployed in under 15 minutes.

## 🎯 Prerequisites Setup

### 1. MongoDB Atlas (Free Tier)
1. Visit [MongoDB Atlas](https://cloud.mongodb.com)
2. Create free account and cluster
3. Click "Connect" → "Connect your application"
4. Copy connection string: `mongodb+srv://username:password@cluster.mongodb.net/email-generator`

### 2. Redis Cloud (Free Tier)
1. Visit [Redis Cloud](https://redis.com/try-free/)
2. Create free account and database
3. Get connection URL: `redis://default:password@host:port`

### 3. API Keys
- **Anthropic API Key**: Get from [Anthropic Console](https://console.anthropic.com)
- **Missive API Token**: Get from Missive settings (requires Productive plan)

## 🚀 Railway Deployment Steps

### Step 1: Connect Repository
1. Visit [Railway](https://railway.app)
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `turbo-journey` repository
5. Railway will automatically detect the configuration

### Step 2: Configure Environment Variables

In Railway dashboard, go to **Variables** and add:

#### **Required Variables**
```bash
# Database
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/email-generator?retryWrites=true&w=majority

# Cache
REDIS_URL=redis://default:your-password@your-host:your-port

# AI Service
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Email Integration
MISSIVE_API_TOKEN=missive_pat-your-token-here

# Security
JWT_SECRET=your-secure-32-character-random-string-here
```

#### **Optional Configuration Variables**
```bash
# Organization
ORGANIZATION_DOMAINS=yourdomain.com
ORGANIZATION_NAME=Your Company Name
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=Your Company Name

# Missive Configuration
MISSIVE_WEBHOOK_SECRET=your-webhook-secret
MISSIVE_DEFAULT_ACCOUNT_ID=your-account-id

# Rate Limiting (defaults are good)
SCRAPING_DELAY_MS=3000
CLAUDE_RATE_LIMIT_PER_MINUTE=30
MISSIVE_RATE_LIMIT_PER_SECOND=1
```

### Step 3: Deploy
1. Railway will automatically deploy when you push to main branch
2. Watch the build logs in Railway dashboard
3. Deployment typically takes 3-5 minutes

### Step 4: Access Your Application
1. Railway will provide a public URL (e.g., `https://your-app.up.railway.app`)
2. Visit your URL to confirm it's working
3. Test the health endpoint: `https://your-app.up.railway.app/health`

## ✅ Post-Deployment Checklist

### Health Check
```bash
curl https://your-app.up.railway.app/health
```
Should return:
```json
{
  "status": "healthy",
  "services": {
    "database": true,
    "redis": true
  }
}
```

### Test API Endpoints
```bash
# Test webhook endpoint
curl https://your-app.up.railway.app/api/webhooks/missive/health

# Test main dashboard
curl https://your-app.up.railway.app/
```

### Configure Custom Domain (Optional)
1. In Railway dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records as shown
4. SSL certificates are automatic

## 🔧 Environment Variable Reference

### **Critical Settings**
| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://...` |
| `REDIS_URL` | Redis connection URL | `redis://default:...` |
| `ANTHROPIC_API_KEY` | Claude AI API key | `sk-ant-...` |
| `MISSIVE_API_TOKEN` | Missive API token | `missive_pat-...` |
| `JWT_SECRET` | Secure random string (32+ chars) | Generated securely |

### **Auto-Configured by Railway**
- `PORT` - Application port
- `NODE_ENV` - Set to "production"
- `PUPPETEER_*` - Chrome browser settings

## 🚨 Troubleshooting

### Build Failures
```bash
# Check build logs in Railway dashboard
# Common issues:
# 1. Missing environment variables
# 2. TypeScript compilation errors
# 3. Missing dependencies
```

### Health Check Failures
```bash
# Check if services are accessible
curl https://your-app.up.railway.app/health

# Common issues:
# 1. Invalid MongoDB URI
# 2. Redis connection timeout
# 3. Network security settings
```

### Performance Issues
```bash
# Monitor in Railway dashboard
# Scale up resources if needed:
# Settings → Resources → Increase memory/CPU
```

## 📊 Monitoring

Railway provides built-in monitoring:
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Application and system logs
- **Uptime**: Availability monitoring
- **Alerts**: Configure email notifications

## 💰 Cost Optimization

**Free Tier Limits:**
- Railway: $5 credit per month (plenty for development)
- MongoDB Atlas: 512MB storage
- Redis Cloud: 30MB cache

**Production Scaling:**
- Railway: ~$5-20/month depending on usage
- MongoDB: ~$9/month for M2 cluster
- Redis: ~$7/month for 250MB

## 🔄 CI/CD

Railway automatically deploys when you:
1. Push to main branch
2. Build passes successfully  
3. Health checks pass

For manual deployments:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway deploy
```

## 🛡️ Security Best Practices

1. **Environment Variables**: Never commit secrets to git
2. **JWT Secret**: Use a cryptographically secure random string
3. **Database**: Use strong passwords and connection encryption
4. **API Keys**: Rotate periodically and monitor usage
5. **Domains**: Use HTTPS only (Railway provides this automatically)

## 📞 Support

- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- MongoDB Support: Atlas console
- Redis Support: Redis Cloud console
- Application Issues: Check Railway logs and health endpoints

---

**Deployment Time: ~10-15 minutes** | **Monthly Cost: ~$15-35** | **Uptime: 99.9%+**