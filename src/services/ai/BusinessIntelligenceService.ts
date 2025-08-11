import * as cheerio from 'cheerio';
import { logger } from '@/utils/logger';

export interface EnhancedBusinessIntelligence {
  // Core business data
  teamSize: 'solo' | 'small' | 'medium' | 'large';
  businessMaturity: 'startup' | 'established' | 'mature';
  professionalLevel: 'hobbyist' | 'professional' | 'premium';
  industryFocus: string[];
  
  // Revenue indicators
  revenueSignals: {
    hasPricing: boolean;
    hasBookingSystem: boolean;
    hasEcommerce: boolean;
    acceptsPayments: boolean;
    pricingTier: 'budget' | 'mid-market' | 'premium' | 'luxury';
  };
  
  // Market positioning
  marketPosition: {
    position: 'leader' | 'challenger' | 'follower' | 'niche';
    differentiators: string[];
    competitiveAdvantages: string[];
    marketChallenges: string[];
  };
  
  // Growth indicators
  growthSignals: {
    isExpanding: boolean;
    isHiring: boolean;
    newServices: boolean;
    recentUpdates: boolean;
    activeMarketing: boolean;
    socialMedia: boolean;
  };
  
  // Credibility markers
  credibilityMarkers: {
    hasAwards: boolean;
    hasCertifications: boolean;
    hasClientLogos: boolean;
    hasTestimonials: boolean;
    testimonialsCount: number;
    mediaFeatures: string[];
    socialProof: string[];
  };
  
  // Seasonal patterns
  seasonalPatterns: {
    isSeasonalBusiness: boolean;
    peakSeasons: string[];
    eventTypes: string[];
    timingIndicators: string[];
  };
  
  // Technology sophistication
  technologyProfile: {
    websiteQuality: 'basic' | 'professional' | 'advanced';
    hasAnalytics: boolean;
    hasCRM: boolean;
    hasAutomation: boolean;
    integrations: string[];
  };
  
  // Pain point indicators
  painPointSignals: {
    workflowChallenges: string[];
    scalingChallenges: string[];
    technologyGaps: string[];
    operationalInefficiencies: string[];
  };

  // Photography print service indicators
  printServiceIndicators?: {
    hasPrintProducts: boolean;
    printProductTypes: string[];
    hasClientGalleries: boolean;
    hasOnlineOrdering: boolean;
    mentionsPrintDelivery: boolean;
    hasPortfolioGalleries: boolean;
    printQualityEmphasis: boolean;
  };
}

export class BusinessIntelligenceService {
  private static instance: BusinessIntelligenceService;

  private constructor() {}

  public static getInstance(): BusinessIntelligenceService {
    if (!BusinessIntelligenceService.instance) {
      BusinessIntelligenceService.instance = new BusinessIntelligenceService();
    }
    return BusinessIntelligenceService.instance;
  }

  /**
   * Extract comprehensive business intelligence from scraped data
   */
  public extractEnhancedIntelligence(
    $: cheerio.Root,
    url: string,
    scrapedData: any
  ): EnhancedBusinessIntelligence {
    const html = $.html().toLowerCase();
    
    return {
      teamSize: this.assessTeamSize($, html),
      businessMaturity: this.assessBusinessMaturity($, html),
      professionalLevel: this.assessProfessionalLevel($, html),
      industryFocus: this.extractIndustryFocus($, html),
      
      revenueSignals: this.extractRevenueSignals($, html),
      marketPosition: this.extractMarketPosition($, html),
      growthSignals: this.extractGrowthSignals($, html),
      credibilityMarkers: this.extractCredibilityMarkers($, html),
      seasonalPatterns: this.extractSeasonalPatterns($, html, url),
      technologyProfile: this.assessTechnologyProfile($, html),
      painPointSignals: this.extractPainPointSignals($, html),
      printServiceIndicators: this.extractPrintServiceIndicators($, html)
    };
  }

  private assessTeamSize($: cheerio.Root, html: string): EnhancedBusinessIntelligence['teamSize'] {
    // Enhanced team size detection
    const soloIndicators = [
      'i am', 'my business', 'freelancer', 'independent', 'sole proprietor'
    ];
    const teamIndicators = [
      'our team', 'we are', 'staff', 'employees', 'team members'
    ];
    const largeTeamIndicators = [
      'departments', 'divisions', 'management team', 'executive', 'board'
    ];

    const soloCount = soloIndicators.filter(indicator => html.includes(indicator)).length;
    const teamCount = teamIndicators.filter(indicator => html.includes(indicator)).length;
    const largeCount = largeTeamIndicators.filter(indicator => html.includes(indicator)).length;

    // Count actual team member references
    const teamMemberCount = $('.team-member, .staff-member, [class*="team"]').length;
    const aboutUsContent = $('[href*="about"], .about, #about').text().toLowerCase();

    if (soloCount > teamCount && teamMemberCount <= 1) return 'solo';
    if (largeCount > 0 || teamMemberCount > 10) return 'large';
    if (teamCount > soloCount || teamMemberCount > 3) return 'medium';
    return 'small';
  }

  private assessBusinessMaturity($: cheerio.Root, html: string): EnhancedBusinessIntelligence['businessMaturity'] {
    const maturityIndicators = {
      startup: ['new', 'launching', 'recently started', 'founded 202'],
      established: ['since', 'established', 'founded', 'years of experience'],
      mature: ['decades', 'over 20 years', 'generations', 'legacy', 'tradition']
    };

    let maxScore = 0;
    let maturityLevel: EnhancedBusinessIntelligence['businessMaturity'] = 'startup';

    for (const [level, indicators] of Object.entries(maturityIndicators)) {
      const score = indicators.filter(indicator => html.includes(indicator)).length;
      if (score > maxScore) {
        maxScore = score;
        maturityLevel = level as EnhancedBusinessIntelligence['businessMaturity'];
      }
    }

    return maturityLevel;
  }

  private assessProfessionalLevel($: cheerio.Root, html: string): EnhancedBusinessIntelligence['professionalLevel'] {
    const premiumIndicators = [
      'luxury', 'exclusive', 'premium', 'elite', 'high-end', 'bespoke',
      'concierge', 'white-glove', 'VIP', 'private'
    ];
    const professionalIndicators = [
      'professional', 'certified', 'licensed', 'accredited', 'studio',
      'commercial', 'corporate', 'business', 'enterprise'
    ];

    const premiumCount = premiumIndicators.filter(indicator => html.includes(indicator)).length;
    const professionalCount = professionalIndicators.filter(indicator => html.includes(indicator)).length;

    // Check for high-end pricing indicators
    const hasPremiumPricing = html.includes('$1000') || html.includes('$2000') || 
                              html.includes('$3000') || html.includes('$5000');

    if (premiumCount >= 2 || hasPremiumPricing) return 'premium';
    if (professionalCount >= 3 || html.includes('award') || html.includes('certification')) return 'professional';
    return 'hobbyist';
  }

  private extractIndustryFocus($: cheerio.Root, html: string): string[] {
    const industryKeywords = {
      photography: ['photography', 'photographer', 'photo', 'portrait', 'wedding', 'commercial photography', 'studio', 'prints', 'albums', 'canvas', 'gallery'],
      events: ['event', 'wedding', 'party', 'celebration', 'ceremony', 'reception'],
      festival: ['festival', 'music festival', 'food festival', 'art festival', 'community event'],
      market: ['market', 'farmers market', 'craft market', 'vendor', 'marketplace'],
      design: ['design', 'graphic design', 'web design', 'creative design'],
      consulting: ['consulting', 'consultant', 'advisory', 'strategy']
    };

    const focusAreas: string[] = [];
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      const matches = keywords.filter(keyword => html.includes(keyword)).length;
      if (matches >= 2) {
        focusAreas.push(industry);
      }
    }

    return focusAreas.length > 0 ? focusAreas : ['creative services'];
  }

  private extractRevenueSignals($: cheerio.Root, html: string): EnhancedBusinessIntelligence['revenueSignals'] {
    const pricingKeywords = ['pricing', 'price', 'rates', 'cost', 'fee', 'investment'];
    const bookingKeywords = ['book', 'schedule', 'appointment', 'consultation', 'reserve'];
    const ecommerceKeywords = ['shop', 'buy', 'purchase', 'cart', 'checkout', 'order'];
    const paymentKeywords = ['payment', 'paypal', 'stripe', 'square', 'credit card', 'pay'];

    const hasPricing = pricingKeywords.some(keyword => html.includes(keyword));
    const hasBookingSystem = bookingKeywords.some(keyword => html.includes(keyword));
    const hasEcommerce = ecommerceKeywords.some(keyword => html.includes(keyword));
    const acceptsPayments = paymentKeywords.some(keyword => html.includes(keyword));

    // Determine pricing tier based on content
    let pricingTier: EnhancedBusinessIntelligence['revenueSignals']['pricingTier'] = 'budget';
    if (html.includes('luxury') || html.includes('premium') || html.includes('exclusive')) {
      pricingTier = 'luxury';
    } else if (html.includes('professional') || html.includes('commercial')) {
      pricingTier = 'premium';
    } else if (html.includes('affordable') || html.includes('competitive')) {
      pricingTier = 'mid-market';
    }

    return {
      hasPricing,
      hasBookingSystem,
      hasEcommerce,
      acceptsPayments,
      pricingTier
    };
  }

  private extractMarketPosition($: cheerio.Root, html: string): EnhancedBusinessIntelligence['marketPosition'] {
    const leadershipKeywords = ['leading', 'top', 'best', 'premier', 'number one', '#1'];
    const challengerKeywords = ['competitive', 'alternative', 'better than', 'superior'];
    const nicheKeywords = ['specialized', 'boutique', 'custom', 'artisan', 'bespoke', 'unique'];
    
    const differentiators = this.extractDifferentiators($, html);
    const competitiveAdvantages = this.extractCompetitiveAdvantages($, html);
    const marketChallenges = this.extractMarketChallenges($, html);

    const leadershipScore = leadershipKeywords.filter(k => html.includes(k)).length;
    const challengerScore = challengerKeywords.filter(k => html.includes(k)).length;
    const nicheScore = nicheKeywords.filter(k => html.includes(k)).length;

    let position: EnhancedBusinessIntelligence['marketPosition']['position'] = 'follower';
    if (leadershipScore >= 2) position = 'leader';
    else if (nicheScore >= 2) position = 'niche';
    else if (challengerScore >= 1) position = 'challenger';

    return {
      position,
      differentiators,
      competitiveAdvantages,
      marketChallenges
    };
  }

  private extractGrowthSignals($: cheerio.Root, html: string): EnhancedBusinessIntelligence['growthSignals'] {
    const expansionKeywords = ['expanding', 'new location', 'growing', 'scaling'];
    const hiringKeywords = ['hiring', 'join our team', 'careers', 'now hiring'];
    const newServiceKeywords = ['now offering', 'new service', 'recently added'];
    const updateKeywords = ['recently', 'latest', '2024', 'new website'];
    const marketingKeywords = ['follow us', 'newsletter', 'subscribe', 'social media'];

    return {
      isExpanding: expansionKeywords.some(k => html.includes(k)),
      isHiring: hiringKeywords.some(k => html.includes(k)),
      newServices: newServiceKeywords.some(k => html.includes(k)),
      recentUpdates: updateKeywords.filter(k => html.includes(k)).length >= 3,
      activeMarketing: marketingKeywords.some(k => html.includes(k)),
      socialMedia: $('a[href*="facebook"], a[href*="instagram"], a[href*="twitter"]').length > 0
    };
  }

  private extractCredibilityMarkers($: cheerio.Root, html: string): EnhancedBusinessIntelligence['credibilityMarkers'] {
    const awards = this.extractAwards($);
    const certifications = this.extractCertifications($);
    const testimonials = this.extractTestimonials($);
    const mediaFeatures = this.extractMediaFeatures($, html);
    const socialProof = this.extractSocialProof($, html);

    return {
      hasAwards: awards.length > 0,
      hasCertifications: certifications.length > 0,
      hasClientLogos: $('.client-logo, .client img, img[alt*="client"]').length > 0,
      hasTestimonials: testimonials.length > 0,
      testimonialsCount: testimonials.length,
      mediaFeatures,
      socialProof
    };
  }

  private extractSeasonalPatterns($: cheerio.Root, html: string, url: string): EnhancedBusinessIntelligence['seasonalPatterns'] {
    const seasonalKeywords = {
      wedding: ['wedding season', 'bridal season', 'engagement season'],
      holiday: ['holiday', 'christmas', 'seasonal', 'winter events'],
      summer: ['summer', 'outdoor', 'festival season'],
      fall: ['fall', 'autumn', 'harvest']
    };

    const eventTypes = this.extractEventTypes($, html);
    const timingIndicators = this.extractTimingIndicators($, html);
    
    const seasonalMatches = Object.values(seasonalKeywords)
      .flat()
      .filter(keyword => html.includes(keyword));

    return {
      isSeasonalBusiness: seasonalMatches.length >= 2,
      peakSeasons: this.identifyPeakSeasons(html),
      eventTypes,
      timingIndicators
    };
  }

  private assessTechnologyProfile($: cheerio.Root, html: string): EnhancedBusinessIntelligence['technologyProfile'] {
    const analyticsIndicators = ['google analytics', 'tracking', 'gtag', 'ga('];
    const crmIndicators = ['crm', 'customer management', 'contact management'];
    const automationIndicators = ['automated', 'workflow', 'integration', 'zapier'];

    const hasAnalytics = analyticsIndicators.some(indicator => html.includes(indicator));
    const hasCRM = crmIndicators.some(indicator => html.includes(indicator));
    const hasAutomation = automationIndicators.some(indicator => html.includes(indicator));

    // Assess website quality
    const qualityIndicators = {
      basic: $('.container, .row, .col').length < 5,
      professional: $('.container, .row, .col').length >= 5 && $('script').length < 10,
      advanced: $('script').length >= 10 && html.includes('react') || html.includes('vue') || html.includes('angular')
    };

    let websiteQuality: EnhancedBusinessIntelligence['technologyProfile']['websiteQuality'] = 'basic';
    if (qualityIndicators.advanced) websiteQuality = 'advanced';
    else if (qualityIndicators.professional) websiteQuality = 'professional';

    return {
      websiteQuality,
      hasAnalytics,
      hasCRM,
      hasAutomation,
      integrations: this.extractIntegrations($, html)
    };
  }

  private extractPainPointSignals($: cheerio.Root, html: string): EnhancedBusinessIntelligence['painPointSignals'] {
    const workflowChallenges = this.extractWorkflowChallenges($, html);
    const scalingChallenges = this.extractScalingChallenges($, html);
    const technologyGaps = this.extractTechnologyGaps($, html);
    const operationalInefficiencies = this.extractOperationalInefficiencies($, html);

    return {
      workflowChallenges,
      scalingChallenges,
      technologyGaps,
      operationalInefficiencies
    };
  }

  // Helper methods
  private extractDifferentiators($: cheerio.Root, html: string): string[] {
    const differentiatorKeywords = [
      'unique', 'exclusive', 'only', 'different', 'unlike others',
      'specialized', 'custom', 'personalized', 'bespoke'
    ];
    return differentiatorKeywords.filter(keyword => html.includes(keyword));
  }

  private extractCompetitiveAdvantages($: cheerio.Root, html: string): string[] {
    const advantageKeywords = [
      'award-winning', 'certified', 'experienced', 'expert', 'professional',
      'fast', 'reliable', 'quality', 'guarantee'
    ];
    return advantageKeywords.filter(keyword => html.includes(keyword));
  }

  private extractMarketChallenges($: cheerio.Root, html: string): string[] {
    const challengeKeywords = [
      'struggling', 'difficult', 'challenge', 'problem', 'issue',
      'time-consuming', 'expensive', 'complex'
    ];
    return challengeKeywords.filter(keyword => html.includes(keyword));
  }

  private extractAwards($: cheerio.Root): string[] {
    const awards: string[] = [];
    $('*:contains("award"), *:contains("winner"), *:contains("recognized")').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 10 && text.length < 200 && text.toLowerCase().includes('award')) {
        awards.push(text);
      }
    });
    return awards.slice(0, 5);
  }

  private extractCertifications($: cheerio.Root): string[] {
    const certifications: string[] = [];
    $('*:contains("certified"), *:contains("licensed"), *:contains("accredited")').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 10 && text.length < 150) {
        certifications.push(text);
      }
    });
    return certifications.slice(0, 5);
  }

  private extractTestimonials($: cheerio.Root): Array<{text: string; author?: string}> {
    const testimonials: Array<{text: string; author?: string}> = [];
    $('.testimonial, .review, .quote, blockquote').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 20 && text.length < 500) {
        testimonials.push({ text });
      }
    });
    return testimonials.slice(0, 10);
  }

  private extractMediaFeatures($: cheerio.Root, html: string): string[] {
    const mediaKeywords = ['featured in', 'as seen in', 'press', 'media', 'interviewed'];
    return mediaKeywords.filter(keyword => html.includes(keyword));
  }

  private extractSocialProof($: cheerio.Root, html: string): string[] {
    const socialProofKeywords = [
      'clients served', 'projects completed', 'years experience',
      'satisfied customers', 'five star', '5-star'
    ];
    return socialProofKeywords.filter(keyword => html.includes(keyword));
  }

  private extractEventTypes($: cheerio.Root, html: string): string[] {
    const eventKeywords = [
      'wedding', 'corporate event', 'festival', 'conference', 'party',
      'celebration', 'graduation', 'birthday', 'anniversary'
    ];
    return eventKeywords.filter(keyword => html.includes(keyword));
  }

  private extractTimingIndicators($: cheerio.Root, html: string): string[] {
    const timingKeywords = [
      'book early', 'advance booking', 'seasonal', 'limited availability',
      'busy season', 'peak time', 'holiday rush'
    ];
    return timingKeywords.filter(keyword => html.includes(keyword));
  }

  private identifyPeakSeasons(html: string): string[] {
    const seasons: string[] = [];
    if (html.includes('summer') || html.includes('june') || html.includes('july')) seasons.push('summer');
    if (html.includes('fall') || html.includes('autumn') || html.includes('october')) seasons.push('fall');
    if (html.includes('winter') || html.includes('december') || html.includes('holiday')) seasons.push('winter');
    if (html.includes('spring') || html.includes('april') || html.includes('may')) seasons.push('spring');
    return seasons;
  }

  private extractIntegrations($: cheerio.Root, html: string): string[] {
    const integrationKeywords = [
      'paypal', 'stripe', 'square', 'mailchimp', 'constant contact',
      'zapier', 'google calendar', 'zoom', 'facebook pixel'
    ];
    return integrationKeywords.filter(keyword => html.includes(keyword));
  }

  private extractWorkflowChallenges($: cheerio.Root, html: string): string[] {
    const workflowKeywords = [
      'manual process', 'time consuming', 'repetitive', 'inefficient',
      'back and forth', 'multiple systems', 'disorganized'
    ];
    return workflowKeywords.filter(keyword => html.includes(keyword));
  }

  private extractScalingChallenges($: cheerio.Root, html: string): string[] {
    const scalingKeywords = [
      'too busy', 'overwhelmed', 'capacity', 'growing pains',
      'can\'t keep up', 'need help', 'expanding'
    ];
    return scalingKeywords.filter(keyword => html.includes(keyword));
  }

  private extractTechnologyGaps($: cheerio.Root, html: string): string[] {
    const technologyKeywords = [
      'outdated system', 'need upgrade', 'manual tracking',
      'spreadsheet', 'paper forms', 'no automation'
    ];
    return technologyKeywords.filter(keyword => html.includes(keyword));
  }

  private extractOperationalInefficiencies($: cheerio.Root, html: string): string[] {
    const inefficiencyKeywords = [
      'double entry', 'lost orders', 'missed deadlines',
      'communication issues', 'follow up', 'tracking problems'
    ];
    return inefficiencyKeywords.filter(keyword => html.includes(keyword));
  }

  private extractPrintServiceIndicators($: cheerio.Root, html: string): EnhancedBusinessIntelligence['printServiceIndicators'] {
    const printProductKeywords = ['prints', 'albums', 'canvas', 'metal prints', 'fine art prints', 'wall art', 'print packages'];
    const clientGalleryKeywords = ['client gallery', 'proofing', 'online gallery', 'photo delivery'];
    const orderingKeywords = ['order prints', 'print ordering', 'online ordering', 'shopping cart'];
    const deliveryKeywords = ['print delivery', 'shipping', 'fulfillment', 'turnaround time'];
    const portfolioKeywords = ['portfolio', 'gallery', 'showcase'];
    const qualityKeywords = ['print quality', 'professional prints', 'archival', 'color accurate', 'premium prints'];

    const printProductTypes = printProductKeywords.filter(keyword => html.includes(keyword));
    
    return {
      hasPrintProducts: printProductTypes.length > 0,
      printProductTypes,
      hasClientGalleries: clientGalleryKeywords.some(keyword => html.includes(keyword)),
      hasOnlineOrdering: orderingKeywords.some(keyword => html.includes(keyword)),
      mentionsPrintDelivery: deliveryKeywords.some(keyword => html.includes(keyword)),
      hasPortfolioGalleries: portfolioKeywords.some(keyword => html.includes(keyword)),
      printQualityEmphasis: qualityKeywords.some(keyword => html.includes(keyword))
    };
  }
}