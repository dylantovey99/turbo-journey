# Missive API Integration Guide

This guide provides comprehensive information for integrating with the Missive API, including best practices, authentication patterns, and common implementation strategies.

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Available Endpoints](#available-endpoints)
5. [Webhooks](#webhooks)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices)
8. [Code Examples](#code-examples)

## API Overview

The Missive API is a REST API that enables:
- Enriching conversations with external content
- Automating tasks like draft creation and contact synchronization
- Integrating with external services (GitHub, Stripe, Rollbar, etc.)
- Building custom UI integrations via iFrame

### Base URL
```
https://public.missiveapp.com/v1/
```

### Requirements
- Missive organization on the **Productive plan**
- Valid API token generated from Missive preferences

## Authentication

### API Token Generation
1. Navigate to Missive preferences
2. Generate an API token
3. Store securely (never commit to version control)

### Request Headers
```javascript
{
  'Authorization': 'Bearer missive_pat-26pApm_QTmyhLLbA...FwoFGmJ6x-6fikpQ',
  'Content-Type': 'application/json' // Required for POST requests
}
```

### Environment Variables
```bash
MISSIVE_API_TOKEN=missive_pat-your-token-here
MISSIVE_API_BASE_URL=https://public.missiveapp.com/v1
```

## Rate Limiting

### Limits
- **Concurrent requests**: 5 at any time
- **Per minute**: 300 requests (5 requests/second)
- **Per 15 minutes**: 900 requests (1 request/second average)

### Rate Limit Headers
When limits are exceeded, the API returns HTTP 429 with these headers:
- `Retry-After`: Seconds to wait before next request
- `X-RateLimit-Limit`: Current rate limit ceiling
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Rate limit reset time (UTC epoch seconds)

### Recommended Patterns
1. **Continuous querying**: Maximum 1 request per second
2. **Burst patterns**:
   - 900 requests over 3 minutes, every 15 minutes
   - 600 requests over 2 minutes, every 10 minutes
   - 300 requests over 1 minute, every 5 minutes

## Available Endpoints

The API provides endpoints for:
- **Conversations**: Enrich with external content
- **Drafts**: Create and send automated emails
- **Contacts**: Synchronize contact information
- **Tasks**: Automate workflow operations

### Resource IDs
- Find resource IDs in API settings under "Resource IDs" tab
- Required for most resource interactions

## Webhooks

### Configuration
1. Create a rule in Missive settings
2. Select "Webhook" as the action
3. Configure endpoint URL
4. Validate endpoint receives POST requests

### Payload Structure
```json
{
  "rule": {
    "id": "rule_id",
    "name": "Rule Name"
  },
  "conversation": {
    "id": "conversation_id",
    "subject": "Email Subject",
    "assignees": [],
    "authors": []
  },
  "latest_message": {
    // Message details
  }
}
```

### Security
- Optional signature validation via `X-Hook-Signature` header
- Uses SHA-256 HMAC for request verification
- Implement timing-attack-resistant comparison

### Error Handling
- Retries failed requests up to 5 times over 8 minutes
- Automatically disables rule after 50 consecutive failures

## Error Handling

### HTTP Status Codes
- `200/201`: Success
- `429`: Rate limit exceeded
- `401`: Authentication failed
- `404`: Resource not found
- `500`: Server error

### Error Response Format
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

## Best Practices

### 1. Authentication Security
- Store API tokens in environment variables
- Use secure credential management systems
- Rotate tokens regularly
- Never commit tokens to version control

### 2. Rate Limiting Strategy
```javascript
class MissiveClient {
  constructor(token) {
    this.token = token;
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minInterval = 1000; // 1 second between requests
  }

  async makeRequest(endpoint, options = {}) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
    return this.executeRequest(endpoint, options);
  }
}
```

### 3. Error Handling with Retries
```javascript
async function makeRequestWithRetry(endpoint, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, options);
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        await new Promise(resolve => 
          setTimeout(resolve, (retryAfter || 60) * 1000)
        );
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}
```

### 4. Webhook Security
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

### 5. Configuration Management
```javascript
const config = {
  missive: {
    apiToken: process.env.MISSIVE_API_TOKEN,
    baseUrl: process.env.MISSIVE_API_BASE_URL || 'https://public.missiveapp.com/v1',
    webhookSecret: process.env.MISSIVE_WEBHOOK_SECRET,
    rateLimit: {
      requestsPerSecond: 1,
      burstSize: 5
    }
  }
};
```

## Code Examples

### Basic API Client Setup
```javascript
class MissiveAPIClient {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseUrl = 'https://public.missiveapp.com/v1';
    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  async get(endpoint) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }

  async post(endpoint, data) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }
}
```

### Express.js Webhook Endpoint
```javascript
const express = require('express');
const crypto = require('crypto');

app.post('/webhook/missive', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.headers['x-hook-signature'];
  const payload = req.body;
  
  if (!verifyWebhookSignature(payload, signature, process.env.MISSIVE_WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  const data = JSON.parse(payload.toString());
  
  // Process webhook data
  console.log('Received webhook:', data.conversation.subject);
  
  res.status(200).send('OK');
});
```

### Rate-Limited Request Queue
```javascript
class RateLimitedQueue {
  constructor(requestsPerSecond = 1) {
    this.queue = [];
    this.processing = false;
    this.interval = 1000 / requestsPerSecond;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { requestFn, resolve, reject } = this.queue.shift();
      
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.interval));
      }
    }
    
    this.processing = false;
  }
}
```

## Integration Checklist

- [ ] API token generated and securely stored
- [ ] Rate limiting implemented
- [ ] Error handling with retries
- [ ] Webhook signature verification (if using webhooks)
- [ ] Logging and monitoring setup
- [ ] Resource ID mapping documented
- [ ] Environment-specific configuration
- [ ] Security audit completed
- [ ] Documentation updated

## Support and Resources

- [Missive API Documentation](https://learn.missiveapp.com/api-documentation/overview)
- [Getting Started Guide](https://learn.missiveapp.com/api-documentation/getting-started)
- [Rate Limits Documentation](https://learn.missiveapp.com/api-documentation/rate-limits)
- [Webhook Setup Guide](https://learn.missiveapp.com/api-documentation/webhooks)

For detailed implementation questions, contact Missive support.