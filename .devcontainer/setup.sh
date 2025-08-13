#!/bin/bash

# Development environment setup script for GitHub Codespaces

echo "🚀 Setting up Personalized Email Generator development environment..."

# Copy environment template if .env doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file - please update with your API keys"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Create uploads directory
mkdir -p uploads logs

echo "✅ Development environment setup complete!"
echo ""
echo "📚 Available commands:"
echo "  npm run dev       - Start development server"
echo "  npm run build     - Build for production"
echo "  npm test          - Run tests"
echo "  npm run lint      - Run linter"
echo ""
echo "🌐 Application will be available at:"
echo "  Development: http://localhost:3001"
echo "  Production:  http://localhost:3000"
echo ""
echo "🔧 Services:"
echo "  MongoDB: mongodb://localhost:27017/email-generator"
echo "  Redis:   redis://localhost:6379"
echo ""
echo "⚙️  Don't forget to configure your environment variables in .env:"
echo "  - ANTHROPIC_API_KEY for AI functionality"
echo "  - MISSIVE_API_TOKEN for email functionality"
echo "  - MONGODB_URI for production database"
echo "  - REDIS_URL for production cache"