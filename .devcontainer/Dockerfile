# Optimized GitHub Codespaces Development Container
FROM mcr.microsoft.com/devcontainers/javascript-node:18-bullseye

# Install system dependencies for Puppeteer and development tools
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo-gobject2 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=development

# Create application directory
WORKDIR /workspace

# Copy package files for dependency installation
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Create required directories
RUN mkdir -p logs uploads && \
    chown -R node:node logs uploads

# Switch to node user for security
USER node

# Expose application port
EXPOSE 3001