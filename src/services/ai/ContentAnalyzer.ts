import { ClaudeClient } from './ClaudeClient';
import { EmailResponseAnalyzer } from './EmailResponseAnalyzer';
import { ProspectModel, CampaignModel } from '@/models';
import { ProspectStatus } from '@/types';
import { logger } from '@/utils/logger';

export interface ProspectAnalysis {
  prospectId: string;
  campaignId: string;
  relevantUSPs: string[];
  personalizationOpportunities: string[];
  recommendedTone: string;
  confidence: number;
  analyzedAt: Date;
  // Enhanced fields for deeper insights
  businessContext: {
    companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    growthStage: 'early' | 'scaling' | 'mature' | 'declining';
    marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
    industry: string;
  };
  painPoints: string[];
  opportunitySignals: string[];
  recommendedProofPoints: string[];
}

export class ContentAnalyzer {
  private claudeClient: ClaudeClient;
  private responseAnalyzer: EmailResponseAnalyzer;

  constructor() {
    this.claudeClient = ClaudeClient.getInstance();
    this.responseAnalyzer = EmailResponseAnalyzer.getInstance();
  }

  public async analyzeProspect(
    prospectId: string,
    campaignId: string
  ): Promise<ProspectAnalysis> {
    try {
      logger.info(`Analyzing prospect: ${prospectId} for campaign: ${campaignId}`);

      // Fetch prospect and campaign data
      const [prospect, campaign] = await Promise.all([
        ProspectModel.findById(prospectId),
        CampaignModel.findById(campaignId)
      ]);

      if (!prospect) {
        throw new Error(`Prospect not found: ${prospectId}`);
      }

      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      // Allow analysis for prospects that are SCRAPED or already ANALYZED
      logger.debug(`ContentAnalyzer: Checking prospect status`, {
        prospectId,
        currentStatus: prospect.status,
        expectedStatuses: [ProspectStatus.SCRAPED, ProspectStatus.ANALYZED],
        hasScrapedData: !!prospect.scrapedData
      });
      
      if (prospect.status !== ProspectStatus.SCRAPED && prospect.status !== ProspectStatus.ANALYZED) {
        throw new Error(`Prospect must be scraped before analysis: ${prospectId} (current status: ${prospect.status})`);
      }

      if (!prospect.scrapedData) {
        // Create minimal scraped data from basic prospect info
        prospect.scrapedData = {
          title: prospect.companyName || 'Unknown Company',
          description: `Company: ${prospect.companyName || 'Unknown'}, Industry: ${prospect.industry || 'Unknown'}, Website: ${prospect.website}`,
          contactInfo: {
            email: prospect.contactEmail
          },
          technologies: [],
          services: [],
          recentNews: []
        };
        
        logger.warn(`Creating minimal scraped data for prospect: ${prospectId}`);
      }

      // Get insights from previous response patterns for similar prospects
      const prospectType = this.determineProspectType(prospect);
      const responseInsights = this.responseAnalyzer.getInsightsForProspectType(prospectType);
      
      // Analyze the prospect against the campaign's marketing document with enhanced data and response insights
      const enhancedProspectData = this.enhanceProspectData(prospect);
      const analysis = await this.claudeClient.analyzeProspectContent(
        enhancedProspectData,
        campaign.marketingDocument,
        responseInsights // Pass response insights to improve analysis
      );

      // Update prospect status only if it's currently SCRAPED
      if (prospect.status === ProspectStatus.SCRAPED) {
        await ProspectModel.findByIdAndUpdate(prospectId, {
          status: ProspectStatus.ANALYZED
        });
      }

      const prospectAnalysis: ProspectAnalysis = {
        prospectId,
        campaignId,
        relevantUSPs: analysis.relevantUSPs,
        personalizationOpportunities: analysis.personalizationOpportunities,
        recommendedTone: analysis.recommendedTone,
        confidence: analysis.confidence,
        analyzedAt: new Date(),
        businessContext: analysis.businessContext,
        painPoints: analysis.painPoints,
        opportunitySignals: analysis.opportunitySignals,
        recommendedProofPoints: analysis.recommendedProofPoints
      };

      logger.info(`Successfully analyzed prospect: ${prospectId}`, {
        confidence: analysis.confidence,
        uspsCount: analysis.relevantUSPs.length,
        personalizationsCount: analysis.personalizationOpportunities.length
      });

      return prospectAnalysis;

    } catch (error) {
      logger.error(`Failed to analyze prospect: ${prospectId}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignId
      });
      throw error;
    }
  }

  public async analyzeProspectWithRetry(
    prospectId: string,
    campaignId: string,
    enhancedProspectData?: any,
    maxRetries: number = 2
  ): Promise<ProspectAnalysis> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Analysis retry attempt ${attempt}/${maxRetries} for prospect: ${prospectId}`);
        
        // Fetch prospect and campaign data
        const [prospect, campaign] = await Promise.all([
          ProspectModel.findById(prospectId),
          CampaignModel.findById(campaignId)
        ]);

        if (!prospect) {
          throw new Error(`Prospect not found: ${prospectId}`);
        }

        if (!campaign) {
          throw new Error(`Campaign not found: ${campaignId}`);
        }

        // Use enhanced data if provided, otherwise enhance the prospect
        const dataToAnalyze = enhancedProspectData || this.enhanceProspectData(prospect);
        
        // Ensure we have some data to analyze
        if (!dataToAnalyze.scrapedData) {
          dataToAnalyze.scrapedData = {
            title: dataToAnalyze.companyName || 'Business',
            description: `Professional ${dataToAnalyze.industry || 'service'} business`,
            services: [],
            technologies: [],
            contactInfo: { email: dataToAnalyze.contactEmail }
          };
        }

        const analysis = await this.claudeClient.analyzeProspectContent(
          dataToAnalyze,
          campaign.marketingDocument
        );

        // Update prospect status
        if (prospect.status === ProspectStatus.SCRAPED) {
          await ProspectModel.findByIdAndUpdate(prospectId, {
            status: ProspectStatus.ANALYZED
          });
        }

        const prospectAnalysis: ProspectAnalysis = {
          prospectId,
          campaignId,
          relevantUSPs: analysis.relevantUSPs,
          personalizationOpportunities: analysis.personalizationOpportunities,
          recommendedTone: analysis.recommendedTone,
          confidence: Math.max(analysis.confidence, 0.6), // Boost confidence for retry success
          analyzedAt: new Date(),
          businessContext: analysis.businessContext,
          painPoints: analysis.painPoints,
          opportunitySignals: analysis.opportunitySignals,
          recommendedProofPoints: analysis.recommendedProofPoints
        };

        logger.info(`Analysis retry successful on attempt ${attempt} for prospect: ${prospectId}`, {
          confidence: prospectAnalysis.confidence
        });

        return prospectAnalysis;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Analysis retry attempt ${attempt} failed for prospect: ${prospectId}`, {
          error: lastError.message,
          remainingAttempts: maxRetries - attempt
        });
        
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    // All retries exhausted
    throw new Error(`Analysis failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  public async analyzeBatch(
    prospectIds: string[],
    campaignId: string,
    batchSize: number = 3
  ): Promise<ProspectAnalysis[]> {
    logger.info(`Starting batch analysis for ${prospectIds.length} prospects`, {
      campaignId,
      batchSize
    });

    const results: ProspectAnalysis[] = [];
    const errors: Array<{ prospectId: string; error: string }> = [];

    for (let i = 0; i < prospectIds.length; i += batchSize) {
      const batch = prospectIds.slice(i, i + batchSize);
      
      logger.info(`Processing analysis batch ${Math.floor(i / batchSize) + 1}`, {
        batch: batch.length,
        remaining: prospectIds.length - i - batch.length
      });

      const promises = batch.map(async (prospectId) => {
        try {
          const analysis = await this.analyzeProspect(prospectId, campaignId);
          return analysis;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ prospectId, error: errorMessage });
          logger.error(`Batch analysis failed for prospect: ${prospectId}`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter(result => result !== null) as ProspectAnalysis[]);

      // Add delay between batches to respect rate limits
      if (i + batchSize < prospectIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Completed batch analysis`, {
      total: prospectIds.length,
      successful: results.length,
      failed: errors.length
    });

    if (errors.length > 0) {
      logger.warn(`Analysis errors encountered:`, { errors });
    }

    return results;
  }

  public async extractCampaignUSPs(campaignId: string): Promise<string[]> {
    try {
      const campaign = await CampaignModel.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign not found: ${campaignId}`);
      }

      const usps = await this.claudeClient.extractMarketingUSPs(campaign.marketingDocument);

      // Update campaign with extracted USPs
      await CampaignModel.findByIdAndUpdate(campaignId, {
        usps: usps
      });

      logger.info(`Extracted USPs for campaign: ${campaignId}`, {
        uspCount: usps.length
      });

      return usps;
    } catch (error) {
      logger.error(`Failed to extract USPs for campaign: ${campaignId}`, error);
      throw error;
    }
  }

  public async getAnalysisStats(campaignId?: string) {
    const matchCondition = campaignId ? { campaignId } : {};
    
    const prospects = await ProspectModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result: Record<string, number> = {};
    prospects.forEach(stat => {
      result[stat._id] = stat.count;
    });

    return {
      pending: result[ProspectStatus.PENDING] || 0,
      scraped: result[ProspectStatus.SCRAPED] || 0,
      analyzed: result[ProspectStatus.ANALYZED] || 0,
      emailGenerated: result[ProspectStatus.EMAIL_GENERATED] || 0,
      draftCreated: result[ProspectStatus.DRAFT_CREATED] || 0,
      failed: result[ProspectStatus.FAILED] || 0,
      total: Object.values(result).reduce((sum, count) => sum + count, 0)
    };
  }

  private enhanceProspectData(prospect: any): any {
    const enhanced = { ...prospect };
    
    if (prospect.scrapedData?.metadata) {
      const metadata = prospect.scrapedData.metadata;
      
      // Extract business intelligence for better analysis
      enhanced.businessIntelligence = {
        teamSize: metadata.businessIntelligence?.teamSize || 'unknown',
        businessMaturity: metadata.businessIntelligence?.businessMaturity || 'unknown',
        professionalLevel: metadata.businessIntelligence?.professionalLevel || 'unknown',
        marketPosition: metadata.competitiveSignals?.marketPosition || 'follower',
        growthSignals: metadata.growthSignals || [],
        seasonalIndicators: metadata.seasonalIndicators || [],
        hasAwards: metadata.businessIntelligence?.awards?.length > 0,
        hasCertifications: metadata.businessIntelligence?.certifications?.length > 0,
        hasClientLogos: metadata.businessIntelligence?.clientLogos > 0,
        hasPricing: metadata.businessIntelligence?.pricingAvailable || false,
        hasBookingSystem: metadata.businessIntelligence?.bookingSystem || false,
        testimonialsCount: metadata.testimonials?.length || 0
      };

      // Enhance industry classification with more specific data
      if (metadata.businessIntelligence) {
        enhanced.detailedIndustryClassification = this.classifyIndustryFromIntelligence(
          prospect.industry,
          metadata.businessIntelligence,
          metadata.competitiveSignals
        );
      }

      // Add competitive positioning insights
      enhanced.competitivePosition = {
        marketPosition: metadata.competitiveSignals?.marketPosition || 'follower',
        uniqueSellingPoints: metadata.competitiveSignals?.uniqueSellingPoints || [],
        competitorAwareness: metadata.competitiveSignals?.competitorMentions?.length > 0
      };
    }

    return enhanced;
  }

  private classifyIndustryFromIntelligence(
    baseIndustry: string,
    businessIntel: any,
    competitiveSignals: any
  ): string {
    let classification = baseIndustry || 'creative services';
    
    // Refine classification based on business intelligence
    if (businessIntel.professionalLevel === 'premium') {
      classification += ' (premium tier)';
    } else if (businessIntel.professionalLevel === 'professional') {
      classification += ' (professional tier)';
    }

    if (businessIntel.teamSize === 'solo') {
      classification += ' - solo practitioner';
    } else if (businessIntel.teamSize === 'large') {
      classification += ' - established business';
    }

    if (competitiveSignals?.marketPosition === 'leader') {
      classification += ' - market leader';
    } else if (competitiveSignals?.marketPosition === 'niche') {
      classification += ' - niche specialist';
    }

    return classification;
  }

  public async getProspectsReadyForAnalysis(
    campaignId: string,
    limit: number = 50
  ): Promise<string[]> {
    const prospects = await ProspectModel
      .find({ 
        status: { $in: [ProspectStatus.SCRAPED, ProspectStatus.ANALYZED] },
        scrapedData: { $ne: null }
      })
      .select('_id')
      .limit(limit)
      .lean();

    return prospects.map(p => p._id.toString());
  }

  /**
   * Determine prospect type for response learning
   */
  private determineProspectType(prospect: any): string {
    const industry = prospect.industry?.toLowerCase() || '';
    const services = prospect.scrapedData?.services || [];
    
    if (industry.includes('photography') || services.some((s: string) => s.toLowerCase().includes('photo'))) {
      if (services.some((s: string) => s.toLowerCase().includes('wedding'))) {
        return 'wedding_photographer';
      } else if (services.some((s: string) => s.toLowerCase().includes('portrait'))) {
        return 'portrait_photographer';
      } else {
        return 'photographer_general';
      }
    } else if (industry.includes('event') || industry.includes('festival')) {
      return 'event_organizer';
    } else {
      return 'creative_professional';
    }
  }
}