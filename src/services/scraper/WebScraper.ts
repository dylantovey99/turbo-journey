import puppeteer, { Browser, Page } from 'puppeteer-core';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { ScrapedData, ContactInfo } from '@/types';
import * as cheerio from 'cheerio';
import axios from 'axios';

export enum ScrapingErrorType {
  TIMEOUT = 'timeout',
  BOT_DETECTION = 'bot_detection',
  NETWORK_ERROR = 'network_error',
  PARSING_ERROR = 'parsing_error',
  BROWSER_ERROR = 'browser_error',
  UNKNOWN = 'unknown'
}

export class ScrapingError extends Error {
  constructor(
    message: string,
    public type: ScrapingErrorType,
    public statusCode?: number,
    public retryable: boolean = true,
    public retryDelay?: number,
    public maxRetries?: number
  ) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class WebScraper {
  private browser: Browser | null = null;
  private isInitialized: boolean = false;
  private pagePool: Page[] = [];
  private maxPages: number = 5;

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const browserConfig = await this.detectBrowserConfiguration();
      
      this.browser = await puppeteer.launch({
        headless: true,
        args: browserConfig.args,
        executablePath: browserConfig.executablePath,
        timeout: config.scraping.timeout
      });

      // Set up process exit handlers for cleanup
      process.on('SIGINT', () => this.gracefulShutdown());
      process.on('SIGTERM', () => this.gracefulShutdown());
      process.on('uncaughtException', () => this.gracefulShutdown());
      
      this.isInitialized = true;
      logger.info('WebScraper initialized successfully', {
        executablePath: browserConfig.executablePath,
        platform: browserConfig.platform,
        isCloudDeployment: config.server.isCloudDeployment
      });
    } catch (error) {
      logger.error('Failed to initialize Puppeteer browser:', error);
      
      // Try HTTP fallback verification
      const httpTestResult = await this.testHttpFallback();
      if (httpTestResult.success) {
        logger.info('HTTP fallback verified, will use for scraping');
        this.isInitialized = true;
        this.browser = null;
      } else {
        logger.error('Both Puppeteer and HTTP fallback failed. Scraping will be unavailable.');
        throw new Error(`Scraping initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async detectBrowserConfiguration(): Promise<{
    executablePath?: string;
    args: string[];
    platform: string;
  }> {
    const platform = process.platform;
    const isCloudDeployment = config.server.isCloudDeployment;
    
    // Base arguments for all environments
    const baseArgs = [
      '--window-size=1920x1080',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ];

    // Cloud deployment arguments
    const cloudArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--run-all-compositor-stages-before-draw',
      '--memory-pressure-off',
      '--no-first-run',
      '--no-zygote'
    ];

    // Try to detect browser executable paths
    const executablePaths = this.getPossibleExecutablePaths(platform);
    let executablePath: string | undefined = process.env.PUPPETEER_EXECUTABLE_PATH;
    
    // If no explicit path is configured, try to detect
    if (!executablePath && isCloudDeployment) {
      for (const path of executablePaths) {
        if (await this.isExecutableAvailable(path)) {
          executablePath = path;
          logger.info(`Detected browser at: ${path}`);
          break;
        }
      }
      
      // Fallback to common cloud deployment path
      if (!executablePath) {
        executablePath = '/usr/bin/chromium-browser';
      }
    }

    return {
      executablePath,
      args: isCloudDeployment ? [...baseArgs, ...cloudArgs] : baseArgs,
      platform
    };
  }

  private getPossibleExecutablePaths(platform: string): string[] {
    const paths: Record<string, string[]> = {
      linux: [
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome-unstable',
        '/snap/bin/chromium',
        '/opt/google/chrome/chrome',
        '/opt/chromium.org/chromium/chromium'
      ],
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium'
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe'
      ]
    };

    return paths[platform] || paths.linux; // Default to linux paths
  }

  private async isExecutableAvailable(path: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async testHttpFallback(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.get('https://httpbin.org/get', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebScraper/1.0)'
        }
      });
      
      return { success: response.status === 200 };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private async gracefulShutdown(): Promise<void> {
    try {
      await this.close();
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
    }
  }

  public async scrapeWebsite(website: string, retryCount: number = 0): Promise<ScrapedData> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const normalizedUrl = this.normalizeUrl(website);

    // Use HTTP fallback if Puppeteer is not available
    if (!this.browser) {
      return this.scrapeWithHttp(normalizedUrl, retryCount);
    }

    let page: Page | null = null;

    try {
      page = await this.browser.newPage();
      
      await page.setUserAgent(config.scraping.userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Set timeout for navigation
      await page.goto(normalizedUrl, {
        waitUntil: 'networkidle2',
        timeout: config.scraping.timeout
      });

      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get page content
      const content = await page.content();
      const $ = cheerio.load(content);

      // Extract basic page information
      const title = $('title').text().trim() || 
                   $('h1').first().text().trim() || 
                   $('[role="banner"] h1').text().trim();

      const description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content') ||
                         $('p').first().text().trim().substring(0, 300);

      // Extract services and technologies
      const services = this.extractServices($);
      const technologies = await this.extractTechnologies(page);
      
      // Extract contact information
      const contactInfo = this.extractContactInfo($);
      
      // Extract recent news or blog posts
      const recentNews = this.extractRecentNews($);

      // Enhanced business intelligence metadata
      const businessIntelligence = this.extractBusinessIntelligence($, normalizedUrl);
      const growthSignals = this.extractGrowthSignals($);
      const competitiveSignals = this.extractCompetitiveSignals($);

      const metadata = {
        url: normalizedUrl,
        scrapedAt: new Date().toISOString(),
        pageTitle: title,
        hasContactPage: $('a[href*="contact"]').length > 0,
        hasAboutPage: $('a[href*="about"]').length > 0,
        hasBlog: $('a[href*="blog"], a[href*="news"]').length > 0,
        socialLinks: this.extractSocialLinks($),
        images: this.extractImages($, normalizedUrl),
        businessIntelligence,
        growthSignals,
        competitiveSignals,
        seasonalIndicators: this.extractSeasonalIndicators($),
        testimonials: this.extractTestimonials($)
      };

      const scrapedData: ScrapedData = {
        title,
        description,
        services,
        technologies,
        recentNews,
        contactInfo,
        metadata
      };

      logger.info(`Successfully scraped website: ${website}`, {
        title: title.substring(0, 50),
        servicesCount: services.length,
        technologiesCount: technologies.length,
        retryCount
      });

      return scrapedData;

    } catch (error) {
      const scrapingError = this.categorizeError(error, normalizedUrl);
      
      logger.error(`Failed to scrape website: ${website}`, {
        error: scrapingError.message,
        errorType: scrapingError.type,
        statusCode: scrapingError.statusCode,
        retryable: scrapingError.retryable,
        retryCount,
        url: normalizedUrl
      });
      
      // Enhanced retry logic with backoff
      if (scrapingError.retryable && retryCount < (scrapingError.maxRetries || 2)) {
        const delay = scrapingError.retryDelay || 5000;
        const jitteredDelay = delay + Math.random() * 2000; // Add jitter
        
        logger.info(`Retrying scrape after ${jitteredDelay}ms: ${website}`, {
          attempt: retryCount + 2,
          errorType: scrapingError.type
        });
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        return this.scrapeWebsite(website, retryCount + 1);
      }
      
      throw scrapingError;
    } finally {
      if (page) {
        try {
          // Clear all listeners and close page properly
          page.removeAllListeners();
          await page.close();
        } catch (error) {
          logger.warn('Error closing page:', error);
        }
      }
      
      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, config.rateLimits.scrapingDelayMs));
    }
  }

  private normalizeUrl(website: string): string {
    let url = website.trim().toLowerCase();
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    return url;
  }

  private extractServices($: cheerio.Root): string[] {
    const services: string[] = [];
    const serviceKeywords = [
      'service', 'solution', 'offering', 'product', 'capability',
      'expertise', 'specialization', 'consulting', 'development'
    ];

    // Look for services in navigation, headings, and specific sections
    $('nav a, h2, h3, .service, .services, .offering, .product').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 3 && text.length < 100) {
        services.push(text);
      }
    });

    // Look for lists that might contain services
    $('ul li, ol li').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 5 && text.length < 100) {
        const lowerText = text.toLowerCase();
        if (serviceKeywords.some(keyword => lowerText.includes(keyword))) {
          services.push(text);
        }
      }
    });

    // Remove duplicates and filter
    return [...new Set(services)]
      .filter(service => service.length > 3)
      .slice(0, 20);
  }

  private async extractTechnologies(page: Page): Promise<string[]> {
    const technologies: string[] = [];

    try {
      // Check for common technology indicators in the page
      const techIndicators = await page.evaluate(() => {
        const indicators: string[] = [];
        const doc = (globalThis as any).document;
        
        // Check for framework/library mentions in script tags
        const scripts = Array.from(doc.querySelectorAll('script[src]'));
        scripts.forEach((script: any) => {
          const src = script.getAttribute('src') || '';
          if (src.includes('react')) indicators.push('React');
          if (src.includes('vue')) indicators.push('Vue.js');
          if (src.includes('angular')) indicators.push('Angular');
          if (src.includes('jquery')) indicators.push('jQuery');
          if (src.includes('bootstrap')) indicators.push('Bootstrap');
        });

        // Check for meta tags
        const generator = doc.querySelector('meta[name="generator"]');
        if (generator) {
          indicators.push(generator.getAttribute('content') || '');
        }

        // Check for common CMS/platform indicators
        if (doc.querySelector('link[href*="wp-content"]')) indicators.push('WordPress');
        if (doc.querySelector('[data-drupal]')) indicators.push('Drupal');
        if (doc.querySelector('.shopify')) indicators.push('Shopify');

        return indicators;
      });

      technologies.push(...techIndicators);

    } catch (error) {
      logger.warn('Failed to extract technologies:', error);
    }

    return [...new Set(technologies)]
      .filter(tech => tech.length > 0)
      .slice(0, 15);
  }

  private extractContactInfo($: cheerio.Root): ContactInfo {
    const contactInfo: ContactInfo = {};

    // Extract email addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const pageText = $.html();
    const emails = pageText.match(emailRegex) || [];
    if (emails.length > 0) {
      contactInfo.email = emails[0];
    }

    // Extract phone numbers
    const phoneRegex = /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const phones = pageText.match(phoneRegex) || [];
    if (phones.length > 0) {
      contactInfo.phone = phones[0];
    }

    // Extract social media links
    const socialMedia: Record<string, string> = {};
    $('a[href*="linkedin.com"]').each((_, elem) => {
      socialMedia.linkedin = $(elem).attr('href') || '';
    });
    $('a[href*="twitter.com"], a[href*="x.com"]').each((_, elem) => {
      socialMedia.twitter = $(elem).attr('href') || '';
    });
    $('a[href*="facebook.com"]').each((_, elem) => {
      socialMedia.facebook = $(elem).attr('href') || '';
    });

    if (Object.keys(socialMedia).length > 0) {
      contactInfo.socialMedia = socialMedia;
    }

    return contactInfo;
  }

  private extractRecentNews($: cheerio.Root): string[] {
    const news: string[] = [];

    // Look for news, blog posts, or announcements
    $('.news, .blog, .post, .announcement, article').each((_, elem) => {
      const title = $(elem).find('h1, h2, h3, .title').first().text().trim();
      if (title.length > 10 && title.length < 200) {
        news.push(title);
      }
    });

    return news.slice(0, 10);
  }

  private extractSocialLinks($: cheerio.Root): Record<string, string> {
    const social: Record<string, string> = {};
    
    $('a[href*="linkedin.com"]').first().each((_, elem) => {
      social.linkedin = $(elem).attr('href') || '';
    });
    
    $('a[href*="twitter.com"], a[href*="x.com"]').first().each((_, elem) => {
      social.twitter = $(elem).attr('href') || '';
    });
    
    return social;
  }

  private extractImages($: cheerio.Root, baseUrl: string): string[] {
    const images: string[] = [];
    
    $('img[src]').slice(0, 5).each((_, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const absoluteUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
        images.push(absoluteUrl);
      }
    });
    
    return images;
  }

  private async scrapeWithHttp(url: string, retryCount: number = 0): Promise<ScrapedData> {
    logger.info('Using HTTP fallback for scraping:', { url, retryCount });
    
    try {
      
      const response = await axios.get(url, {
        timeout: config.scraping.timeout,
        headers: {
          'User-Agent': config.scraping.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
      });

      const $ = cheerio.load(response.data);
      
      // Extract basic information
      const title = $('title').text().trim() || '';
      const metaDescription = $('meta[name="description"]').attr('content') || '';
      const headings = this.extractHeadings($);
      const contentText = this.extractMainContent($);
      const contactInfo = this.extractContactInfo($);
      
      // Simplified technology detection for HTTP mode
      const technologies: string[] = [];
      const generator = $('meta[name="generator"]').attr('content');
      if (generator) technologies.push(generator);
      
      if (response.data.includes('wp-content')) technologies.push('WordPress');
      if (response.data.includes('shopify')) technologies.push('Shopify');
      if (response.data.includes('wix')) technologies.push('Wix');

      const scrapedData: ScrapedData = {
        title,
        description: metaDescription,
        services: this.extractServices($),
        technologies: technologies.slice(0, 5),
        recentNews: this.extractRecentNews($),
        contactInfo,
        metadata: {
          url,
          scrapedAt: new Date().toISOString(),
          pageTitle: title,
          hasContactPage: $('a[href*="contact"]').length > 0,
          hasAboutPage: $('a[href*="about"]').length > 0,
          hasBlog: $('a[href*="blog"], a[href*="news"]').length > 0,
          socialLinks: this.extractSocialLinks($),
          images: [], // Skip images in HTTP mode
          headings,
          content: contentText || metaDescription || title,
          responseTime: 0,
          httpStatus: response.status,
          retryCount
        }
      };

      logger.info('HTTP scraping completed successfully', {
        url,
        title: title.substring(0, 50),
        contentLength: contentText.length,
        technologies: technologies.length,
        retryCount
      });

      return scrapedData;
      
    } catch (error) {
      const scrapingError = this.categorizeError(error, url);
      
      logger.error('HTTP scraping failed:', { 
        url, 
        error: scrapingError.message,
        errorType: scrapingError.type,
        retryable: scrapingError.retryable,
        retryCount
      });
      
      // Enhanced retry logic for HTTP mode
      if (scrapingError.retryable && retryCount < (scrapingError.maxRetries || 2)) {
        const delay = scrapingError.retryDelay || 5000;
        const jitteredDelay = delay + Math.random() * 2000;
        
        logger.info(`Retrying HTTP scrape after ${jitteredDelay}ms: ${url}`, {
          attempt: retryCount + 2,
          errorType: scrapingError.type
        });
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
        return this.scrapeWithHttp(url, retryCount + 1);
      }
      
      // Only throw error if not retryable or max retries exceeded
      throw scrapingError;
    }
  }

  private extractHeadings($: cheerio.Root): string[] {
    const headings: string[] = [];
    
    // Extract h1-h6 headings
    $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 3 && text.length < 200) {
        headings.push(text);
      }
    });
    
    return headings.slice(0, 10); // Limit to first 10 headings
  }

  private categorizeError(error: any): ScrapingError {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = error.response?.status || error.statusCode;
    
    // Timeout errors - retryable with exponential backoff
    if (message.includes('timeout') || message.includes('Navigation timeout') || 
        message.includes('ERR_NETWORK_TIMEOUT')) {
      return new ScrapingError(message, ScrapingErrorType.TIMEOUT, statusCode, true, 5000, 3);
    }
    
    // Bot detection patterns - not retryable or require long delays
    if (message.includes('403') || message.includes('Forbidden') || 
        message.includes('Access Denied') || message.includes('blocked') ||
        message.includes('Cloudflare') || message.includes('captcha') ||
        statusCode === 403 || statusCode === 429) {
      return new ScrapingError(message, ScrapingErrorType.BOT_DETECTION, statusCode, false, 60000, 1);
    }
    
    // Network errors - retryable with moderate delay
    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED') || 
        message.includes('ECONNRESET') || message.includes('network') || 
        error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ||
        statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return new ScrapingError(message, ScrapingErrorType.NETWORK_ERROR, statusCode, true, 10000, 3);
    }
    
    // Browser errors - retryable with short delay
    if (message.includes('browser') || message.includes('page') || 
        message.includes('Target closed') || message.includes('Protocol error') ||
        message.includes('Session closed') || message.includes('Connection closed')) {
      return new ScrapingError(message, ScrapingErrorType.BROWSER_ERROR, statusCode, true, 3000, 2);
    }
    
    // Parsing errors - not retryable
    if (message.includes('parse') || message.includes('invalid') || 
        message.includes('malformed') || statusCode === 400) {
      return new ScrapingError(message, ScrapingErrorType.PARSING_ERROR, statusCode, false, 0, 0);
    }
    
    // Server errors - retryable with moderate delay
    if (statusCode >= 500 && statusCode < 600) {
      return new ScrapingError(message, ScrapingErrorType.NETWORK_ERROR, statusCode, true, 15000, 2);
    }
    
    return new ScrapingError(message, ScrapingErrorType.UNKNOWN, statusCode, true, 5000, 2);
  }

  private extractMainContent($: cheerio.Root): string {
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '#content',
      '.post-content',
      '.entry-content',
      'article',
      '.article-body'
    ];
    
    let content = '';
    
    // Try to find main content using common selectors
    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length > 0) {
        content = element.text().trim();
        if (content.length > 100) {
          break;
        }
      }
    }
    
    // Fallback: extract text from paragraphs
    if (content.length < 100) {
      const paragraphs: string[] = [];
      $('p').each((_, elem) => {
        const text = $(elem).text().trim();
        if (text.length > 20) {
          paragraphs.push(text);
        }
      });
      content = paragraphs.slice(0, 5).join(' ');
    }
    
    // Final fallback: get body text
    if (content.length < 50) {
      content = $('body').text().trim().substring(0, 1000);
    }
    
    return content;
  }

  private extractBusinessIntelligence($: cheerio.Root): Record<string, any> {
    const intelligence: Record<string, any> = {};

    // Company size indicators
    intelligence.teamSize = this.estimateTeamSize($);
    intelligence.businessMaturity = this.assessBusinessMaturity($);
    intelligence.professionalLevel = this.assessProfessionalLevel($);
    
    // Revenue/pricing indicators
    intelligence.pricingAvailable = $('*:contains("pricing"), *:contains("price"), *:contains("rates")').length > 0;
    intelligence.bookingSystem = $('*:contains("book"), *:contains("schedule"), *:contains("appointment")').length > 0;
    
    // Market position indicators
    intelligence.awards = this.extractAwards($);
    intelligence.certifications = this.extractCertifications($);
    intelligence.clientLogos = this.extractClientLogos($);

    return intelligence;
  }

  private extractGrowthSignals($: cheerio.Root): string[] {
    const signals: string[] = [];

    // Look for expansion indicators
    if ($('*:contains("new"), *:contains("launching"), *:contains("expanding")').length > 0) {
      signals.push('business expansion');
    }
    
    if ($('*:contains("hiring"), *:contains("join our team"), *:contains("careers")').length > 0) {
      signals.push('team growth');
    }
    
    if ($('*:contains("now offering"), *:contains("new service"), *:contains("additional")').length > 0) {
      signals.push('service expansion');
    }
    
    if ($('*:contains("recently"), *:contains("latest"), *:contains("2024")').length > 5) {
      signals.push('active updates');
    }
    
    if ($('*:contains("award"), *:contains("featured"), *:contains("recognized")').length > 0) {
      signals.push('industry recognition');
    }

    return signals;
  }

  private extractCompetitiveSignals($: cheerio.Root): Record<string, any> {
    const competitive: Record<string, any> = {};

    // Look for differentiation language
    competitive.uniqueSellingPoints = this.extractUSPLanguage($);
    competitive.competitorMentions = this.extractCompetitorReferences($);
    competitive.marketPosition = this.assessMarketPosition($);
    
    return competitive;
  }

  private extractSeasonalIndicators($: cheerio.Root): string[] {
    const indicators: string[] = [];
    const pageText = $.html().toLowerCase();

    // Seasonal business patterns
    const seasonalKeywords = {
      wedding: ['wedding season', 'summer weddings', 'fall weddings', 'bridal'],
      holiday: ['holiday', 'christmas', 'seasonal', 'winter'],
      festival: ['summer festival', 'fall events', 'spring celebration'],
      market: ['farmers market', 'holiday market', 'seasonal market']
    };

    for (const [type, keywords] of Object.entries(seasonalKeywords)) {
      for (const keyword of keywords) {
        if (pageText.includes(keyword)) {
          indicators.push(`${type}_seasonal`);
          break;
        }
      }
    }

    return indicators;
  }

  private extractTestimonials($: cheerio.Root): Array<{text: string; author?: string}> {
    const testimonials: Array<{text: string; author?: string}> = [];

    // Look for testimonial sections
    $('.testimonial, .review, .quote, [class*="testimonial"], [class*="review"]').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 20 && text.length < 500) {
        testimonials.push({ text });
      }
    });

    // Look for quoted text that might be testimonials
    $('blockquote, .quote').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 20 && text.length < 300) {
        testimonials.push({ text });
      }
    });

    return testimonials.slice(0, 5);
  }

  private estimateTeamSize($: cheerio.Root): 'solo' | 'small' | 'medium' | 'large' {
    const teamIndicators = $('*:contains("our team"), *:contains("staff"), *:contains("we"), .team, .staff').length;
    const aboutPageContent = $('*:contains("about us"), *:contains("about me")').text().toLowerCase();
    
    if (aboutPageContent.includes('i am') || aboutPageContent.includes('my business') || teamIndicators === 0) {
      return 'solo';
    } else if (teamIndicators < 3) {
      return 'small';
    } else if (teamIndicators < 8) {
      return 'medium';
    }
    return 'large';
  }

  private assessBusinessMaturity($: cheerio.Root): 'startup' | 'established' | 'mature' {
    const pageText = $.html().toLowerCase();
    const establishedIndicators = [
      'since', 'established', 'founded', 'years of experience', 'decade'
    ].filter(indicator => pageText.includes(indicator)).length;

    if (establishedIndicators >= 2) return 'mature';
    if (establishedIndicators >= 1) return 'established';
    return 'startup';
  }

  private assessProfessionalLevel($: cheerio.Root): 'hobbyist' | 'professional' | 'premium' {
    const professionalIndicators = [
      'professional', 'award', 'certified', 'licensed', 'studio', 'commercial'
    ];
    const premiumIndicators = [
      'luxury', 'exclusive', 'premium', 'elite', 'high-end', 'bespoke'
    ];
    
    const pageText = $.html().toLowerCase();
    const professionalCount = professionalIndicators.filter(i => pageText.includes(i)).length;
    const premiumCount = premiumIndicators.filter(i => pageText.includes(i)).length;

    if (premiumCount >= 2) return 'premium';
    if (professionalCount >= 3) return 'professional';
    return 'hobbyist';
  }

  private extractAwards($: cheerio.Root): string[] {
    const awards: string[] = [];
    
    $('*:contains("award"), *:contains("winner"), *:contains("recognized")').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 10 && text.length < 200) {
        awards.push(text);
      }
    });

    return awards.slice(0, 3);
  }

  private extractCertifications($: cheerio.Root): string[] {
    const certifications: string[] = [];
    
    $('*:contains("certified"), *:contains("licensed"), *:contains("accredited")').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 10 && text.length < 150) {
        certifications.push(text);
      }
    });

    return certifications.slice(0, 3);
  }

  private extractClientLogos($: cheerio.Root): number {
    return $('img[alt*="client"], img[alt*="logo"], .client-logo, .client img').length;
  }

  private extractUSPLanguage($: cheerio.Root): string[] {
    const uspKeywords = [
      'unique', 'exclusive', 'only', 'first', 'leading', 'award-winning',
      'specialized', 'expert', 'premium', 'custom', 'personalized'
    ];
    
    const usps: string[] = [];
    const pageText = $.html().toLowerCase();
    
    for (const keyword of uspKeywords) {
      if (pageText.includes(keyword)) {
        usps.push(keyword);
      }
    }

    return usps;
  }

  private extractCompetitorReferences($: cheerio.Root): string[] {
    const competitorKeywords = [
      'unlike others', 'different from', 'compared to', 'better than',
      'while others', 'not like other'
    ];
    
    const references: string[] = [];
    const pageText = $.html().toLowerCase();
    
    for (const keyword of competitorKeywords) {
      if (pageText.includes(keyword)) {
        references.push(keyword);
      }
    }

    return references;
  }

  private assessMarketPosition($: cheerio.Root): 'leader' | 'challenger' | 'follower' | 'niche' {
    const leadershipKeywords = ['leading', 'top', 'best', 'premier', 'number one'];
    const nicheBeywords = ['specialized', 'boutique', 'custom', 'artisan', 'bespoke'];
    
    const pageText = $.html().toLowerCase();
    const leadershipCount = leadershipKeywords.filter(k => pageText.includes(k)).length;
    const nicheCount = nicheBeywords.filter(k => pageText.includes(k)).length;

    if (leadershipCount >= 2) return 'leader';
    if (nicheCount >= 2) return 'niche';
    if (pageText.includes('competitive') || pageText.includes('alternative')) return 'challenger';
    return 'follower';
  }

  public async close(): Promise<void> {
    try {
      // Close all pages first
      if (this.browser) {
        const pages = await this.browser.pages();
        await Promise.all(pages.map(page => 
          page.close().catch(error => 
            logger.warn('Error closing page during shutdown:', error)
          )
        ));
        
        // Close browser
        await this.browser.close();
        this.browser = null;
      }
      
      // Clear page pool
      this.pagePool = [];
      this.isInitialized = false;
      
      logger.info('WebScraper closed successfully');
    } catch (error) {
      logger.error('Error during WebScraper shutdown:', error);
      // Force cleanup
      this.browser = null;
      this.pagePool = [];
      this.isInitialized = false;
    }
  }
}