# Development container for GitHub Codespaces
FROM node:18-bullseye

# Install system dependencies for Puppeteer and development tools
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
        chromium \
        fonts-liberation \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libatspi2.0-0 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libwayland-client0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxrandr2 \
        libxss1 \
        libxtst6 \
        ca-certificates \
        git \
        curl \
        wget \
        vim \
        mongodb-clients \
        redis-tools \
    && rm -rf /var/lib/apt/lists/*

# Set up workspace
WORKDIR /workspace

# Configure git for container
RUN git config --global --add safe.directory /workspace

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=development

# Create node user for development
RUN groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

# Change ownership of workspace
RUN chown -R node:node /workspace

# Switch to node user
USER node

# Set up shell environment
RUN echo 'export PATH=$PATH:/workspace/node_modules/.bin' >> ~/.bashrc