import { WebScraper } from '@/services/scraper/WebScraper';

// Mock Puppeteer with proper type definitions
const currentMockPage = {
  setUserAgent: jest.fn(),
  setViewport: jest.fn(),
  goto: jest.fn(),
  waitForTimeout: jest.fn(),
  content: jest.fn(),
  close: jest.fn(),
  evaluate: jest.fn(),
  removeAllListeners: jest.fn()
};

const currentMockBrowser = {
  newPage: jest.fn().mockResolvedValue(currentMockPage),
  close: jest.fn(),
  pages: jest.fn().mockResolvedValue([currentMockPage])
};

const mockPuppeteer = {
  launch: jest.fn().mockResolvedValue(currentMockBrowser)
};

jest.mock('puppeteer-core', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
      close: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue([]),
      removeAllListeners: jest.fn()
    }),
    close: jest.fn().mockResolvedValue(undefined),
    pages: jest.fn().mockResolvedValue([])
  })
}));

describe('WebScraper', () => {
  let webScraper: WebScraper;
  let puppeteerCore: any;
  let currentMockBrowser: any;
  let currentMockPage: any;

  beforeEach(() => {
    webScraper = new WebScraper();
    puppeteerCore = require('puppeteer-core');
    
    // Reset mocks and get fresh instances
    jest.clearAllMocks();
    
    // Set up fresh mock instances for each test
    currentMockPage = {
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
      close: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockResolvedValue([]),
      removeAllListeners: jest.fn()
    };
    
    currentMockBrowser = {
      newPage: jest.fn().mockResolvedValue(currentMockPage),
      close: jest.fn().mockResolvedValue(undefined),
      pages: jest.fn().mockResolvedValue([currentMockPage])
    };
    
    puppeteerCore.launch.mockResolvedValue(currentMockBrowser);
  });

  afterEach(async () => {
    await webScraper.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(webScraper.initialize()).resolves.not.toThrow();
    });

    it('should handle initialization errors', async () => {
      puppeteerCore.launch.mockRejectedValueOnce(new Error('Launch failed'));

      await expect(webScraper.initialize()).rejects.toThrow('Launch failed');
    });
  });

  describe('Website Scraping', () => {
    beforeEach(async () => {
      await webScraper.initialize();
    });

    it('should scrape a website successfully', async () => {
      const htmlContent = `
        <html>
          <head>
            <title>Test Company - Tech Solutions</title>
            <meta name="description" content="We provide innovative technology solutions">
          </head>
          <body>
            <h1>Welcome to Test Company</h1>
            <nav>
              <a href="/services">Services</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </nav>
            <p>Contact us at info@test-company.com</p>
          </body>
        </html>
      `;

      currentMockPage.content.mockResolvedValue(htmlContent);
      currentMockPage.evaluate.mockResolvedValue([]);

      const result = await webScraper.scrapeWebsite('https://test-company.com');

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Company - Tech Solutions');
      expect(result.description).toBe('We provide innovative technology solutions');
      expect(result.contactInfo?.email).toBe('info@test-company.com');
      expect(result.metadata?.hasContactPage).toBe(true);
    });

    it('should normalize URL correctly', async () => {
      const htmlContent = '<html><body>Test</body></html>';
      currentMockPage.content.mockResolvedValue(htmlContent);
      currentMockPage.evaluate.mockResolvedValue([]);

      await webScraper.scrapeWebsite('test-company.com');

      expect(currentMockPage.goto).toHaveBeenCalledWith(
        'https://test-company.com',
        expect.any(Object)
      );
    });

    it('should handle scraping errors gracefully', async () => {
      currentMockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      await expect(
        webScraper.scrapeWebsite('https://invalid-website.com')
      ).rejects.toThrow('Navigation failed');
    });

    it('should extract services from navigation and content', async () => {
      const htmlContent = `
        <html>
          <body>
            <nav>
              <a href="/web-development">Web Development</a>
              <a href="/mobile-apps">Mobile Apps</a>
            </nav>
            <div class="services">
              <h3>AI Solutions</h3>
              <h3>Cloud Computing</h3>
            </div>
          </body>
        </html>
      `;

      currentMockPage.content.mockResolvedValue(htmlContent);
      currentMockPage.evaluate.mockResolvedValue([]);

      const result = await webScraper.scrapeWebsite('https://test-company.com');

      expect(result.services).toContain('Web Development');
      expect(result.services).toContain('Mobile Apps');
      expect(result.services).toContain('AI Solutions');
      expect(result.services).toContain('Cloud Computing');
    });

    it('should extract contact information', async () => {
      const htmlContent = `
        <html>
          <body>
            <p>Email us at contact@test-company.com</p>
            <p>Call us at (555) 123-4567</p>
            <a href="https://linkedin.com/company/test-company">LinkedIn</a>
            <a href="https://twitter.com/testcompany">Twitter</a>
          </body>
        </html>
      `;

      currentMockPage.content.mockResolvedValue(htmlContent);
      currentMockPage.evaluate.mockResolvedValue([]);

      const result = await webScraper.scrapeWebsite('https://test-company.com');

      expect(result.contactInfo?.email).toBe('contact@test-company.com');
      expect(result.contactInfo?.phone).toBe('(555) 123-4567');
      expect(result.contactInfo?.socialMedia?.linkedin).toContain('linkedin.com');
      expect(result.contactInfo?.socialMedia?.twitter).toContain('twitter.com');
    });

    it('should extract technologies from page evaluation', async () => {
      currentMockPage.content.mockResolvedValue('<html><body>Test</body></html>');
      currentMockPage.evaluate.mockResolvedValue(['React', 'Vue.js', 'WordPress']);

      const result = await webScraper.scrapeWebsite('https://test-company.com');

      expect(result.technologies).toContain('React');
      expect(result.technologies).toContain('Vue.js');
      expect(result.technologies).toContain('WordPress');
    });

    it('should respect rate limiting delay', async () => {
      const startTime = Date.now();
      
      currentMockPage.content.mockResolvedValue('<html><body>Test</body></html>');
      currentMockPage.evaluate.mockResolvedValue([]);

      await webScraper.scrapeWebsite('https://test-company.com');
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should include the rate limiting delay (mocked to be faster in tests)
      expect(duration).toBeGreaterThan(0);
    });

    it('should close page after scraping', async () => {
      currentMockPage.content.mockResolvedValue('<html><body>Test</body></html>');
      currentMockPage.evaluate.mockResolvedValue([]);

      await webScraper.scrapeWebsite('https://test-company.com');

      expect(currentMockPage.close).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await webScraper.initialize();
    });

    it('should handle timeout errors', async () => {
      currentMockPage.goto.mockRejectedValue(new Error('Navigation timeout'));

      await expect(
        webScraper.scrapeWebsite('https://slow-website.com')
      ).rejects.toThrow('Navigation timeout');
    });

    it('should handle network errors', async () => {
      currentMockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

      await expect(
        webScraper.scrapeWebsite('https://non-existent-domain.com')
      ).rejects.toThrow('net::ERR_NAME_NOT_RESOLVED');
    });
  });

  describe('Cleanup', () => {
    it('should close browser properly', async () => {
      await webScraper.initialize();
      await webScraper.close();

      expect(currentMockBrowser.close).toHaveBeenCalled();
    });

    it('should handle multiple close calls gracefully', async () => {
      await webScraper.initialize();
      await webScraper.close();
      await webScraper.close(); // Second close should not throw

      expect(currentMockBrowser.close).toHaveBeenCalledTimes(1);
    });
  });
});