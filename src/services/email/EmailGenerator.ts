import { ClaudeClient } from '@/services/ai/ClaudeClient';
import { ContentAnalyzer, ProspectAnalysis } from '@/services/ai/ContentAnalyzer';
import { PsychologicalTriggerService } from '@/services/ai/PsychologicalTriggerService';
import { ConversionTracker } from '@/services/ai/ConversionTracker';
import { SubjectLineService } from '@/services/email/SubjectLineService';
import { ConversationStyleService } from '@/services/ai/ConversationStyleService';
import { ProspectModel, CampaignModel, EmailJobModel } from '@/models';
import { JobStatus, GeneratedEmail } from '@/types';
import { logger } from '@/utils/logger';

export class EmailGenerator {
  private claudeClient: ClaudeClient;
  private contentAnalyzer: ContentAnalyzer;
  private psychologicalTriggerService: PsychologicalTriggerService;
  private conversionTracker: ConversionTracker;
  private subjectLineService: SubjectLineService;
  private conversationStyleService: ConversationStyleService;

  constructor() {
    this.claudeClient = ClaudeClient.getInstance();
    this.contentAnalyzer = new ContentAnalyzer();
    this.psychologicalTriggerService = PsychologicalTriggerService.getInstance();
    this.conversionTracker = ConversionTracker.getInstance();
    this.subjectLineService = SubjectLineService.getInstance();
    this.conversationStyleService = ConversationStyleService.getInstance();
  }

  public async generateEmail(emailJobId: string): Promise<GeneratedEmail> {
    try {
      logger.info(`Generating email for job: ${emailJobId}`);

      const emailJob = await EmailJobModel.findById(emailJobId)
        .populate('prospectId')
        .populate('campaignId');

      if (!emailJob) {
        throw new Error(`Email job not found: ${emailJobId}`);
      }

      const prospect = emailJob.prospectId as any;
      const campaign = emailJob.campaignId as any;

      if (!prospect || !campaign) {
        throw new Error('Invalid prospect or campaign data');
      }

      // Update job status to processing
      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        status: JobStatus.PROCESSING,
        attempts: emailJob.attempts + 1
      });

      // ALWAYS run ContentAnalyzer for maximum personalization - no shortcuts
      let analysis: ProspectAnalysis;
      
      logger.info(`Running ContentAnalyzer for maximum personalization for job: ${emailJobId}`);
      
      try {
        // Always analyze for fresh, personalized insights
        analysis = await this.contentAnalyzer.analyzeProspect(
          prospect._id.toString(),
          campaign._id.toString()
        );
        
        logger.info(`ContentAnalyzer successful for job: ${emailJobId}`, {
          confidence: analysis.confidence,
          personalizationOpportunities: analysis.personalizationOpportunities.length,
          relevantUSPs: analysis.relevantUSPs.length
        });
        
      } catch (error) {
        logger.error(`ContentAnalyzer failed, this will result in generic content for job: ${emailJobId}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          prospectStatus: prospect.status
        });
        
        // Create prospect-specific analysis even in fallback
        analysis = this.createProspectSpecificAnalysis(prospect, campaign);
      }

      // Generate psychological triggers for the prospect
      const psychologicalTriggers = await this.psychologicalTriggerService.generateTriggersForProspect(
        prospect,
        campaign,
        analysis
      );

      logger.info(`Generated ${psychologicalTriggers.length} psychological triggers`, {
        jobId: emailJobId,
        triggers: psychologicalTriggers.map(t => t.type)
      });

      // Generate varied subject line options
      const subjectLineVariants = await this.subjectLineService.generateSubjectLineVariants(
        prospect,
        analysis,
        campaign
      );

      // Select the optimal subject line
      const selectedSubject = await this.subjectLineService.selectOptimalSubjectLine(
        subjectLineVariants,
        [] // No test results yet for new variants
      );

      logger.info(`Generated ${subjectLineVariants.length} subject line variants, selected: ${selectedSubject.style}`, {
        jobId: emailJobId,
        selectedSubject: selectedSubject.text,
        variants: subjectLineVariants.map(v => v.style)
      });

      // Get recommended conversation style for natural communication
      const styleRecommendation = await this.conversationStyleService.recommendConversationStyle(
        prospect,
        analysis,
        campaign
      );

      logger.info(`Selected conversation style: ${styleRecommendation.style.name}`, {
        jobId: emailJobId,
        approach: styleRecommendation.style.approach,
        reasoning: styleRecommendation.reasoning
      });

      // Generate the personalized email with psychological triggers and conversation style
      const emailData = await this.claudeClient.generatePersonalizedEmail(
        prospect,
        campaign,
        analysis,
        campaign.marketingDocument,
        psychologicalTriggers,
        selectedSubject.text,
        styleRecommendation.style // Pass the conversation style
      );

      // Calculate confidence score based on analysis and data quality
      const confidence = this.calculateConfidenceScore(prospect, analysis);

      const generatedEmail: GeneratedEmail = {
        subject: emailData.subject,
        htmlBody: this.formatHtmlEmail(emailData.htmlBody, prospect, campaign),
        textBody: this.formatTextEmail(emailData.textBody, prospect, campaign),
        personalizations: emailData.personalizations,
        confidence
      };

      // Track email generation for conversion analytics
      await this.conversionTracker.trackEmailSent(
        emailJobId, // Using emailJobId as emailId for tracking
        prospect._id.toString(),
        campaign._id.toString(),
        {
          subjectLine: emailData.subject,
          subjectLineStyle: 'personalized', // Default style, could be enhanced to detect actual style
          emailLength: emailData.textBody.length,
          psychologicalTriggers: psychologicalTriggers.map(t => t.type),
          personalizationElements: emailData.personalizations || [],
          industry: prospect.industry || 'creative services',
          businessStage: analysis.businessContext?.growthStage || 'early',
          professionalLevel: analysis.businessContext?.companySize || 'small'
        }
      );

      // Save the generated email
      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        status: JobStatus.COMPLETED,
        generatedEmail
      });

      // Update prospect status
      await ProspectModel.findByIdAndUpdate(prospect._id, {
        status: 'email_generated'
      });

      // Email generation completed

      logger.info(`Successfully generated email for job: ${emailJobId}`, {
        subject: emailData.subject.substring(0, 50),
        confidence,
        personalizationsCount: emailData.personalizations.length,
        psychologicalTriggersCount: psychologicalTriggers.length,
        triggerTypes: psychologicalTriggers.map(t => t.type)
      });

      return generatedEmail;

    } catch (error) {
      logger.error(`Failed to generate email for job: ${emailJobId}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        status: JobStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }


  private createProspectSpecificAnalysis(prospect: any, campaign: any): ProspectAnalysis {
    // Extract actual prospect-specific data
    const companyName = prospect.companyName || 'this business';
    const scrapedData = prospect.scrapedData || {};
    const title = scrapedData.title || '';
    const services = scrapedData.services || [];
    const description = scrapedData.description || '';
    
    // Create personalization based on actual scraped content
    const personalizations = [];
    if (title) personalizations.push(`Business focus: ${title}`);
    if (services.length > 0) personalizations.push(`Services offered: ${services.slice(0, 3).join(', ')}`);
    if (description) personalizations.push(`Business description insights from: ${description.substring(0, 100)}...`);
    if (companyName !== 'this business') personalizations.push(`Company-specific reference: ${companyName}`);
    
    // Prospect-specific opportunity signals
    const opportunitySignals = [];
    if (services.some((s: any) => s.toLowerCase().includes('wedding'))) {
      opportunitySignals.push('wedding photography specialization - high-value client market');
    }
    if (services.some((s: any) => s.toLowerCase().includes('portrait'))) {
      opportunitySignals.push('portrait services - repeat client potential');
    }
    if (title.toLowerCase().includes('photographer')) {
      opportunitySignals.push('established photography business with growth potential');
    }
    
    return {
      prospectId: prospect._id.toString(),
      campaignId: campaign._id.toString(),
      relevantUSPs: campaign.usps?.slice(0, 2) || ['Prints so detailed clients can "count branches on trees"', 'Next level customer service with 75-year guarantee'],
      personalizationOpportunities: personalizations,
      recommendedTone: campaign.tone || 'professional',
      confidence: scrapedData && Object.keys(scrapedData).length > 0 ? 0.75 : 0.4,
      analyzedAt: new Date(),
      businessContext: {
        companySize: services.length > 10 ? 'medium' : 'small',
        growthStage: services.length > 5 ? 'scaling' : 'early',
        marketPosition: title.toLowerCase().includes('award') || title.toLowerCase().includes('premium') ? 'challenger' : 'follower',
        industry: prospect.industry || (title.toLowerCase().includes('photographer') ? 'photography' : 'creative services')
      },
      painPoints: this.generateProspectSpecificPainPoints(prospect, scrapedData),
      opportunitySignals: opportunitySignals.length > 0 ? opportunitySignals : ['business growth through superior service delivery'],
      recommendedProofPoints: ['client testimonials relevant to their service type', 'quality guarantees that match their business level']
    };
  }

  private generateProspectSpecificPainPoints(prospect: any, scrapedData: any): string[] {
    const industry = prospect.industry?.toLowerCase() || '';
    const title = (scrapedData.title || '').toLowerCase();
    const services = scrapedData.services || [];
    const description = (scrapedData.description || '').toLowerCase();
    
    const painPoints = [];
    
    // Photography-specific pain points based on actual services
    if (industry.includes('photography') || title.includes('photographer')) {
      if (services.some((s: any) => s.toLowerCase().includes('wedding'))) {
        painPoints.push('ensuring wedding prints capture every emotional detail clients expect');
        painPoints.push('delivering wedding albums that exceed high client expectations');
      }
      if (services.some((s: any) => s.toLowerCase().includes('portrait'))) {
        painPoints.push('achieving portrait print quality that justifies premium pricing');
      }
      if (services.some((s: any) => s.toLowerCase().includes('baby')) || title.includes('baby')) {
        painPoints.push('creating keepsake-quality prints for precious family moments');
      }
      
      // Generic photography pain points as fallback
      if (painPoints.length === 0) {
        painPoints.push('clients not being "in awe" of their print quality');
        painPoints.push('finding print partners who understand professional photography standards');
      }
    } else if (industry.includes('event') || industry.includes('festival')) {
      painPoints.push('event coordination challenges', 'vendor management complexity');
    } else {
      painPoints.push('maintaining service quality while scaling operations');
    }
    
    return painPoints;
  }
  
  private generateIndustrySpecificPainPoints(prospect: any): string[] {
    // Legacy method - kept for compatibility
    const industry = prospect.industry?.toLowerCase() || '';
    
    if (industry.includes('photography')) {
      return ['clients not being "in awe" of their print quality', 'missing the "next level" customer service that builds their business reputation', 'slower turnaround times affecting client satisfaction and business growth'];
    } else if (industry.includes('event') || industry.includes('festival')) {
      return ['event coordination', 'vendor management', 'logistics planning'];
    } else if (industry.includes('market')) {
      return ['vendor coordination', 'operational efficiency', 'community engagement'];
    } else {
      return ['operational efficiency', 'business growth', 'service delivery'];
    }
  }





  private generatePersonalizationPatterns(prospect: any, campaign: any): string[] {
    const companyName = prospect.companyName || 'your business';
    const industry = prospect.industry || 'creative services';
    const patterns = [];
    
    // Basic personalization patterns
    patterns.push(`Professional approach to ${industry} operations`);
    
    if (prospect.scrapedData?.services?.length > 0) {
      patterns.push(`Specialization in ${prospect.scrapedData.services[0]}`);
    }
    
    patterns.push(`${companyName} business development`);
    
    return patterns.slice(0, 2);
  }

  private calculateConfidenceScore(prospect: any, analysis: ProspectAnalysis): number {
    let score = analysis.confidence || 0.5;

    // Simple confidence adjustments
    if (prospect.scrapedData?.title) score += 0.1;
    if (prospect.scrapedData?.services?.length > 0) score += 0.1;
    if (prospect.companyName) score += 0.1;
    if (prospect.industry) score += 0.1;

    return Math.max(0.3, Math.min(1.0, score));
  }

  private formatHtmlEmail(htmlBody: string, prospect: any, campaign: any): string {
    // Ensure proper paragraph formatting
    let processedHtml = htmlBody;
    
    // If htmlBody doesn't have proper paragraph tags, try to add them
    if (!processedHtml.includes('<p>')) {
      // Split by double line breaks and wrap each section in <p> tags
      const paragraphs = processedHtml.split('\n\n').filter(p => p.trim().length > 0);
      processedHtml = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
    }
    
    // Add basic HTML structure if not present
    if (!processedHtml.includes('<html')) {
      const formattedHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email from ${campaign.name}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .content { margin-bottom: 30px; }
        .content p { margin-bottom: 16px; }
        .signature { border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #666; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="content">
        ${processedHtml}
    </div>
    <div class="signature">
        <p>Best regards,<br>
        ${campaign.fromName || 'Sales Team'}<br>
        ${campaign.fromEmail || 'sales@company.com'}</p>
    </div>
</body>
</html>`;
      return formattedHtml;
    }

    return processedHtml;
  }

  private formatTextEmail(textBody: string, prospect: any, campaign: any): string {
    // Ensure proper formatting for plain text
    let formattedText = textBody;
    
    // Ensure proper paragraph spacing if missing
    // Look for sentences that should be separated but aren't
    formattedText = formattedText.replace(/([.!?])\s*([A-Z][^.!?]*)/g, (match, ending, nextSentence) => {
      // If there's already a double line break, keep it
      if (match.includes('\n\n')) {
        return match;
      }
      // If it looks like it should be a new paragraph, add spacing
      if (nextSentence.match(/^(I |Many |Would you|The |This |Our )/)) {
        return `${ending}\n\n${nextSentence}`;
      }
      return match;
    });
    
    // Ensure there are proper line breaks between logical sections
    // Look for common paragraph starters that should be separated
    const paragraphStarters = [
      /\n([A-Z][a-z]+ photographers)/g,
      /\n(Would you be open)/g,
      /\n(I[''']m curious)/g,
      /\n(Many [a-z]+ mention)/g
    ];
    
    paragraphStarters.forEach(pattern => {
      formattedText = formattedText.replace(pattern, '\n\n$1');
    });

    // Add signature if not present
    if (!formattedText.includes('Best regards') && !formattedText.includes('Sincerely')) {
      formattedText += `\n\nBest regards,\n${campaign.fromName || 'Sales Team'}\n${campaign.fromEmail || 'sales@company.com'}`;
    }

    // Clean up any triple line breaks
    formattedText = formattedText.replace(/\n\n\n+/g, '\n\n');

    return formattedText;
  }

  public async generateBatchEmails(
    emailJobIds: string[],
    batchSize: number = 3
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    logger.info(`Starting batch email generation for ${emailJobIds.length} jobs`, {
      batchSize
    });

    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < emailJobIds.length; i += batchSize) {
      const batch = emailJobIds.slice(i, i + batchSize);
      
      logger.info(`Processing email generation batch ${Math.floor(i / batchSize) + 1}`, {
        batch: batch.length,
        remaining: emailJobIds.length - i - batch.length
      });

      const promises = batch.map(async (jobId) => {
        try {
          await this.generateEmail(jobId);
          successful++;
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Job ${jobId}: ${errorMessage}`);
          logger.error(`Batch email generation failed for job: ${jobId}`, error);
        }
      });

      await Promise.all(promises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < emailJobIds.length) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    logger.info(`Completed batch email generation`, {
      total: emailJobIds.length,
      successful,
      failed
    });

    return { successful, failed, errors };
  }

  public async getEmailJobsReadyForGeneration(limit: number = 50): Promise<string[]> {
    const jobs = await EmailJobModel
      .find({ 
        status: JobStatus.QUEUED,
        attempts: { $lt: 3 } // Don't retry jobs that have failed too many times
      })
      .select('_id')
      .limit(limit)
      .lean();

    return jobs.map(job => job._id.toString());
  }

  public async getGenerationStats(campaignId?: string) {
    const matchCondition = campaignId ? { campaignId } : {};
    
    const jobs = await EmailJobModel.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const result: Record<string, number> = {};
    jobs.forEach(stat => {
      result[stat._id] = stat.count;
    });

    return {
      queued: result[JobStatus.QUEUED] || 0,
      processing: result[JobStatus.PROCESSING] || 0,
      completed: result[JobStatus.COMPLETED] || 0,
      failed: result[JobStatus.FAILED] || 0,
      retrying: result[JobStatus.RETRYING] || 0,
      total: Object.values(result).reduce((sum, count) => sum + count, 0)
    };
  }

  public async retryFailedJobs(campaignId?: string, maxAttempts: number = 3): Promise<number> {
    const matchCondition: any = { 
      status: JobStatus.FAILED, 
      attempts: { $lt: maxAttempts } 
    };
    
    if (campaignId) {
      matchCondition.campaignId = campaignId;
    }

    const failedJobs = await EmailJobModel.find(matchCondition).select('_id');
    
    if (failedJobs.length === 0) {
      return 0;
    }

    await EmailJobModel.updateMany(
      { _id: { $in: failedJobs.map(job => job._id) } },
      { 
        status: JobStatus.QUEUED,
        error: undefined
      }
    );

    logger.info(`Queued ${failedJobs.length} failed jobs for retry`, { campaignId });
    
    return failedJobs.length;
  }

}