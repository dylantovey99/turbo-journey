# Optimized GitHub Codespaces Development Container
FROM mcr.microsoft.com/devcontainers/javascript-node:20-bullseye

# Install system dependencies for Puppeteer, MongoDB, and Redis
RUN apt-get update && apt-get install -y \
    # Puppeteer dependencies
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
    # Database dependencies
    wget \
    gnupg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install MongoDB
RUN wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add - \
    && echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/debian bullseye/mongodb-org/6.0 main" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list \
    && apt-get update \
    && apt-get install -y mongodb-org \
    && rm -rf /var/lib/apt/lists/*

# Install Redis
RUN apt-get update && apt-get install -y redis-server \
    && rm -rf /var/lib/apt/lists/*

# Configure MongoDB
RUN mkdir -p /data/db \
    && chown -R node:node /data/db

# Configure Redis  
RUN sed -i 's/^daemonize yes/daemonize no/' /etc/redis/redis.conf \
    && sed -i 's/^bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=development

# Create application directory
WORKDIR /workspace

# Ensure proper permissions for workspace
RUN chown -R node:node /workspace

# Switch to node user for development
USER node

# Expose application port
EXPOSE 3001