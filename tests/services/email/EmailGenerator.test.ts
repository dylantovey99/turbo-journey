import { EmailGenerator } from '@/services/email/EmailGenerator';
import { ClaudeClient } from '@/services/ai/ClaudeClient';
import { ContentAnalyzer } from '@/services/ai/ContentAnalyzer';
import { ProspectModel, CampaignModel, EmailJobModel } from '@/models';
import { JobStatus } from '@/types';

// Mock dependencies
jest.mock('@/services/ai/ClaudeClient');
jest.mock('@/services/ai/ContentAnalyzer');
jest.mock('@/models');

describe('EmailGenerator', () => {
  let emailGenerator: EmailGenerator;

  beforeEach(() => {
    emailGenerator = new EmailGenerator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate an email successfully', async () => {
    // Arrange
    const emailJobId = 'test-job-id';
    const prospectId = 'test-prospect-id';
    const campaignId = 'test-campaign-id';

    const mockEmailJob = {
      _id: emailJobId,
      prospectId: { _id: prospectId, status: 'scraped', website: 'test.com', companyName: 'TestCo', industry: 'testing' },
      campaignId: { _id: campaignId, usps: ['usp1'], tone: 'professional', marketingDocument: 'doc' },
      attempts: 0,
    };

    const mockAnalysis = {
      prospectId,
      campaignId,
      relevantUSPs: ['usp1'],
      personalizationOpportunities: ['opp1'],
      recommendedTone: 'professional',
      confidence: 0.9,
      analyzedAt: new Date(),
      businessContext: { companySize: 'small', growthStage: 'scaling', marketPosition: 'follower', industry: 'testing' },
      painPoints: ['pain1'],
      opportunitySignals: ['sig1'],
      recommendedProofPoints: ['proof1'],
    };

    const mockEmailData = {
      subject: 'Test Subject',
      htmlBody: '<p>Test Body</p>',
      textBody: 'Test Body',
      personalizations: ['pers1'],
    };

    (EmailJobModel.findById as jest.Mock).mockReturnValue({
      populate: jest.fn().mockResolvedValue(mockEmailJob),
    });
    (ContentAnalyzer.prototype.analyzeProspect as jest.Mock).mockResolvedValue(mockAnalysis);
    (ClaudeClient.prototype.generatePersonalizedEmail as jest.Mock).mockResolvedValue(mockEmailData);
    (EmailJobModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
    (ProspectModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({});

    // Act
    const result = await emailGenerator.generateEmail(emailJobId);

    // Assert
    expect(result).toBeDefined();
    expect(result.subject).toBe('Test Subject');
    expect(result.htmlBody).toContain('<p>Test Body</p>');
    expect(EmailJobModel.findByIdAndUpdate).toHaveBeenCalledWith(emailJobId, { status: JobStatus.PROCESSING, attempts: 1 });
    expect(ContentAnalyzer.prototype.analyzeProspect).toHaveBeenCalledWith(prospectId, campaignId);
    expect(ClaudeClient.prototype.generatePersonalizedEmail).toHaveBeenCalledWith(mockEmailJob.prospectId, mockEmailJob.campaignId, mockAnalysis, 'doc');
    expect(EmailJobModel.findByIdAndUpdate).toHaveBeenCalledWith(emailJobId, { status: JobStatus.COMPLETED, generatedEmail: expect.any(Object) });
    expect(ProspectModel.findByIdAndUpdate).toHaveBeenCalledWith(prospectId, { status: 'email_generated' });
  });
});
