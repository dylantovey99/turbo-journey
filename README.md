# Personalized Email Generator

An AI-powered system that scrapes prospect websites, analyzes content against marketing documents, generates personalized emails using Claude AI, and creates drafts in Missive for professional outreach at scale.

## 🚀 Features

- **Website Scraping**: Automated extraction of company information, services, and technologies
- **AI Content Analysis**: Claude AI-powered analysis to match prospects with relevant selling points
- **Personalized Email Generation**: AI-generated emails tailored to each prospect's business
- **Advanced Subject Line Optimization**: A/B testing framework with 5 psychological styles
- **Psychological Trigger Integration**: 7 trigger types for enhanced conversion rates
- **Business Intelligence Extraction**: Comprehensive prospect analysis with 8+ categories
- **Conversion Tracking**: Real-time analytics for opens, clicks, replies with statistical significance
- **Missive Integration**: Automatic draft creation in Missive for streamlined outreach
- **Bulk Processing**: CSV import for processing hundreds of prospects simultaneously
- **Real-time Dashboard**: Web interface for monitoring campaigns and system status
- **Queue Management**: Robust job processing with Redis and BullMQ
- **Rate Limiting**: Respectful API usage with built-in rate limiting

## 🏗️ Architecture

### Core Components

1. **Web Scraping Service** (Puppeteer)
   - Extracts company data from prospect websites
   - Respects rate limits and includes retry logic
   - Captures services, technologies, contact info, and recent news

2. **Content Analysis Engine** (Claude AI)
   - Analyzes scraped data against marketing documents
   - Identifies relevant USPs and personalization opportunities
   - Recommends email tone and messaging approach

3. **Email Generation Service** (Claude AI)
   - Creates personalized email content for each prospect
   - Generates both HTML and text versions
   - Includes confidence scoring for quality control

4. **Subject Line Optimization Engine**
   - A/B testing framework with 5 psychological styles
   - Industry-specific templates for photography, festivals, and markets
   - Performance tracking with historical data optimization
   - Spam filter validation and mobile optimization

5. **Psychological Trigger Service**
   - 7 trigger types: social-proof, authority, scarcity, reciprocity, commitment, liking, consensus
   - Creative professional appropriateness with intensity levels
   - Industry-specific trigger profiles and content generation
   - Natural integration without seeming sales-heavy

6. **Business Intelligence Service**
   - Comprehensive prospect analysis with 8+ business intelligence categories
   - Professional level detection (hobbyist, professional, premium)
   - Market position assessment and growth signal identification
   - Technology profile and pain point identification

7. **Conversion Tracking System**
   - Real-time analytics for opens, clicks, replies with timestamps
   - Statistical significance testing for A/B tests
   - Performance insights by industry, timing, and personalization
   - Optimization recommendations and campaign analysis

8. **Missive Integration**
   - Creates drafts directly in Missive accounts
   - Handles authentication and rate limiting
   - Supports batch processing for multiple emails

9. **Queue System** (Redis + BullMQ)
   - Manages background job processing
   - Handles retries and error recovery
   - Supports concurrent processing with rate limits

## 📦 Installation

### 🚀 Quick Start with GitHub Codespaces (Recommended)

The fastest way to get started is using GitHub Codespaces - everything is configured automatically!

1. **Open in Codespaces**: Click "Code" → "Codespaces" → "Create codespace on main"
2. **Wait for setup**: Automatic installation and build process (~2-3 minutes)
3. **Start developing**: Run `npm run dev` when setup completes
4. **Access app**: Open http://localhost:3000

**If automatic setup fails in Codespaces**, run:
```bash
bash setup-codespaces.sh
```

### Prerequisites (Local Development)

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB database
- Redis server
- Claude AI (Anthropic) API key
- Missive API token (Productive plan required)

### Local Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd personalized-email-generator
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Start the application**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Required Environment Variables

```env
# Database
MONGODB_URI=mongodb://localhost:27017/email-generator
REDIS_URL=redis://localhost:6379

# API Keys
MISSIVE_API_TOKEN=missive_pat-your-token-here
ANTHROPIC_API_KEY=sk-ant-your-claude-key-here

# Email Configuration
DEFAULT_FROM_EMAIL=your-email@company.com
DEFAULT_FROM_NAME=Your Company Name
MISSIVE_DEFAULT_ACCOUNT_ID=your-account-id

# Rate Limiting (optional)
SCRAPING_DELAY_MS=2000
MISSIVE_RATE_LIMIT_PER_SECOND=1
CLAUDE_RATE_LIMIT_PER_MINUTE=60
```

## 🎯 Usage

### 1. Access the Dashboard

Navigate to `http://localhost:3000` to access the web dashboard.

### 2. Create a Campaign

1. Go to the Campaigns tab
2. Click "Create Campaign"
3. Provide:
   - Campaign name
   - Marketing document (your value proposition)
   - Missive account ID
   - Email tone preference

### 3. Add Prospects

**Single Prospect**:
1. Go to Prospects tab
2. Click "Add Prospect"
3. Enter website and contact details

**Bulk Import**:
1. Go to Bulk Import tab
2. Download the CSV template
3. Fill with prospect data
4. Upload and associate with a campaign

### 4. Process Campaign

1. Go to Campaigns tab
2. Click "Start" on your campaign
3. Monitor progress in real-time
4. View generated drafts in Missive

## 📊 API Endpoints

### Prospects
- `GET /api/v1/prospects` - List all prospects
- `POST /api/v1/prospects` - Create new prospect
- `POST /api/v1/prospects/:id/scrape` - Scrape prospect website

### Campaigns
- `GET /api/v1/campaigns` - List all campaigns
- `POST /api/v1/campaigns` - Create new campaign
- `POST /api/v1/campaigns/:id/start` - Start campaign processing
- `GET /api/v1/campaigns/:id/progress` - Get campaign progress

### Bulk Processing
- `POST /api/v1/bulk/import` - Upload CSV file
- `GET /api/v1/bulk/jobs/:id` - Get import job status
- `GET /api/v1/bulk/template` - Download CSV template

### System
- `GET /api/v1/status` - System status
- `GET /api/v1/health/detailed` - Health check
- `GET /api/v1/docs` - API documentation

## 🔄 Workflow

1. **Import Prospects**: Upload CSV or manually add prospects
2. **Create Campaign**: Define marketing message and target audience
3. **Scraping Phase**: System scrapes all prospect websites
4. **Analysis Phase**: AI analyzes prospects against campaign
5. **Generation Phase**: AI creates personalized emails
6. **Draft Creation**: Emails become drafts in Missive
7. **Review & Send**: Review drafts in Missive and send

## 📈 Monitoring

### Dashboard Metrics
- Total prospects processed
- Active campaigns
- Emails generated
- Drafts created
- Conversion tracking analytics
- A/B test performance
- Subject line optimization results
- Psychological trigger effectiveness
- System health status

### Queue Status
- Jobs waiting, active, completed, failed
- Processing rates and error rates
- Retry attempts and success rates

### Logs
- Application logs in `logs/` directory
- Daily rotation with compression
- Error tracking and debugging info

## 🛡️ Security & Best Practices

### Rate Limiting
- **Scraping**: 2-second delays between requests
- **Missive API**: 1 request per second maximum
- **Claude AI API**: 60 requests per minute limit

### Data Privacy
- No sensitive data stored unnecessarily
- Secure API key management
- Input validation on all endpoints

### Error Handling
- Comprehensive retry logic
- Graceful degradation
- Detailed error logging

## 🔧 Development

### Scripts
```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm test             # Run tests
```

### Project Structure
```
src/
├── config/          # Configuration management
├── models/          # Database models (MongoDB)
├── routes/          # API route handlers
├── services/        # Business logic services
│   ├── ai/         # Claude AI integration & optimization
│   │   ├── BusinessIntelligenceService.ts
│   │   ├── ClaudeClient.ts
│   │   ├── ConversionTracker.ts
│   │   ├── PsychologicalTriggerService.ts
│   │   └── SubjectLineService.ts
│   ├── analytics/  # Performance analytics
│   ├── email/      # Email generation & optimization
│   ├── missive/    # Missive API client
│   ├── queue/      # Job queue management
│   ├── scraper/    # Web scraping
│   └── workflow/   # Workflow orchestration
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## 🐛 Troubleshooting

### Common Issues

**Scraping Failures**:
- Check website accessibility
- Verify user agent settings
- Review rate limiting configuration

**Claude AI API Errors**:
- Verify API key validity
- Check rate limits and quotas
- Review prompt length and formatting

**Missive Integration Issues**:
- Confirm Productive plan subscription
- Verify API token permissions
- Check account ID configuration

**Queue Problems**:
- Ensure Redis server is running
- Check worker process status
- Review job failure logs

### Logs and Debugging

- Application logs: `logs/application-YYYY-MM-DD.log`
- Error logs: `logs/error-YYYY-MM-DD.log`
- Debug mode: Set `LOG_LEVEL=debug` in environment

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs
3. Create an issue with detailed information

---

**Built with**: Node.js, TypeScript, Claude AI (Anthropic), Puppeteer, MongoDB, Redis, Express.js