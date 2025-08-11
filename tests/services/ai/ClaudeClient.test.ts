import { ClaudeClient } from '@/services/ai/ClaudeClient';

// Mock Anthropic
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate
    }
  }))
}));

describe('ClaudeClient', () => {
  let claudeClient: ClaudeClient;

  beforeEach(() => {
    claudeClient = ClaudeClient.getInstance();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ClaudeClient.getInstance();
      const instance2 = ClaudeClient.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('Message Creation', () => {
    it('should create message successfully', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Test response'
        }],
        model: 'claude-3-sonnet-20240229',
        role: 'assistant',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5
        }
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ];

      const result = await claudeClient.createMessage(messages);

      expect(result).toBe('Test response');
      expect(mockCreate).toHaveBeenCalledWith({
        model: expect.any(String),
        messages,
        max_tokens: expect.any(Number),
        temperature: expect.any(Number)
      });
    });

    it('should handle custom options', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: 'Custom response'
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ];

      const options = {
        model: 'claude-3-haiku-20240307',
        maxTokens: 1000,
        temperature: 0.5
      };

      await claudeClient.createMessage(messages, options);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        messages,
        max_tokens: 1000,
        temperature: 0.5
      });
    });

    it('should throw error when no content in response', async () => {
      const mockResponse = {
        content: [],
        model: 'claude-3-sonnet-20240229',
        role: 'assistant',
        stop_reason: 'end_turn'
      };

      mockCreate.mockResolvedValue(mockResponse);

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ];

      await expect(
        claudeClient.createMessage(messages)
      ).rejects.toThrow('No content in Claude response');
    });

    it('should handle API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const messages = [
        { role: 'user' as const, content: 'Test message' }
      ];

      await expect(
        claudeClient.createMessage(messages)
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('Prospect Content Analysis', () => {
    it('should analyze prospect content successfully', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            relevantUSPs: ['USP 1', 'USP 2'],
            personalizationOpportunities: ['Opportunity 1'],
            recommendedTone: 'professional',
            confidence: 0.8
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const prospectData = {
        companyName: 'Test Company',
        website: 'https://test.com',
        scrapedData: {
          description: 'Test description',
          services: ['Service 1', 'Service 2'],
          technologies: ['React', 'Node.js']
        },
        industry: 'Technology'
      };

      const marketingDocument = 'Our company provides amazing solutions...';

      const result = await claudeClient.analyzeProspectContent(prospectData, marketingDocument);

      expect(result.relevantUSPs).toEqual(['USP 1', 'USP 2']);
      expect(result.personalizationOpportunities).toEqual(['Opportunity 1']);
      expect(result.recommendedTone).toBe('professional');
      expect(result.confidence).toBe(0.8);
    });

    it('should validate analysis response structure', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            relevantUSPs: ['USP 1'],
            // Missing personalizationOpportunities
            recommendedTone: 'professional',
            confidence: 0.8
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const prospectData = { website: 'https://test.com' };
      const marketingDocument = 'Test document';

      await expect(
        claudeClient.analyzeProspectContent(prospectData, marketingDocument)
      ).rejects.toThrow('Invalid analysis response structure');
    });
  });

  describe('Email Generation', () => {
    it('should generate personalized email successfully', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            subject: 'Personalized subject',
            htmlBody: '<p>HTML email body</p>',
            textBody: 'Text email body',
            personalizations: ['Personal touch 1']
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const prospectData = {
        companyName: 'Test Company',
        contactName: 'John Doe',
        website: 'https://test.com',
        industry: 'Technology'
      };

      const campaignData = {
        name: 'Test Campaign',
        tone: 'professional'
      };

      const analysis = {
        relevantUSPs: ['USP 1', 'USP 2'],
        personalizationOpportunities: ['Opportunity 1'],
        recommendedTone: 'professional'
      };

      const result = await claudeClient.generatePersonalizedEmail(
        prospectData,
        campaignData,
        analysis
      );

      expect(result.subject).toBe('Personalized subject');
      expect(result.htmlBody).toBe('<p>HTML email body</p>');
      expect(result.textBody).toBe('Text email body');
      expect(result.personalizations).toEqual(['Personal touch 1']);
    });

    it('should validate email response structure', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            subject: 'Test subject',
            htmlBody: '<p>HTML body</p>',
            // Missing textBody and personalizations
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      await expect(
        claudeClient.generatePersonalizedEmail({}, {}, {})
      ).rejects.toThrow('Invalid email response structure');
    });
  });

  describe('Marketing USP Extraction', () => {
    it('should extract USPs from marketing document', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            usps: [
              'Increase productivity by 40%',
              'Reduce costs by 30%',
              '24/7 customer support'
            ]
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const marketingDocument = 'We help companies increase productivity...';

      const result = await claudeClient.extractMarketingUSPs(marketingDocument);

      expect(result).toEqual([
        'Increase productivity by 40%',
        'Reduce costs by 30%',
        '24/7 customer support'
      ]);
    });

    it('should handle empty USP response', async () => {
      const mockResponse = {
        content: [{
          type: 'text',
          text: JSON.stringify({
            // Missing usps field
          })
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await claudeClient.extractMarketingUSPs('Test document');

      expect(result).toEqual([]);
    });
  });
});