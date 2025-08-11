import { logger } from '@/utils/logger';

export interface PsychologicalTrigger {
  type: 'social-proof' | 'authority' | 'scarcity' | 'reciprocity' | 'commitment' | 'liking' | 'consensus';
  intensity: 'subtle' | 'moderate' | 'strong';
  content: string;
  context: string;
  industryAppropriate: boolean;
  conversionImpact: number; // 1-10 scale
}

export interface TriggerProfile {
  industry: string;
  professionalLevel: 'hobbyist' | 'professional' | 'premium';
  businessStage: 'startup' | 'small' | 'established' | 'mature';
  marketPosition: 'leader' | 'challenger' | 'follower' | 'niche';
  preferredTriggers: PsychologicalTrigger['type'][];
  avoidTriggers: PsychologicalTrigger['type'][];
  maxIntensity: PsychologicalTrigger['intensity'];
}

export class PsychologicalTriggerService {
  private static instance: PsychologicalTriggerService;

  private constructor() {}

  public static getInstance(): PsychologicalTriggerService {
    if (!PsychologicalTriggerService.instance) {
      PsychologicalTriggerService.instance = new PsychologicalTriggerService();
    }
    return PsychologicalTriggerService.instance;
  }

  /**
   * Generate appropriate psychological triggers for a prospect
   */
  public generateTriggersForProspect(
    prospectData: any,
    analysis: any,
    campaignData: any
  ): PsychologicalTrigger[] {
    const profile = this.createTriggerProfile(prospectData, analysis);
    const triggers: PsychologicalTrigger[] = [];

    // Select 2-3 appropriate triggers based on profile
    const selectedTypes = this.selectOptimalTriggers(profile, 3);

    for (const triggerType of selectedTypes) {
      const trigger = this.createTrigger(
        triggerType,
        profile,
        prospectData,
        analysis,
        campaignData
      );

      if (trigger) {
        triggers.push(trigger);
      }
    }

    return triggers;
  }

  /**
   * Create a trigger profile based on prospect characteristics
   */
  private createTriggerProfile(prospectData: any, analysis: any): TriggerProfile {
    const industry = analysis.businessContext?.industry || 'creative services';
    const professionalLevel = this.determineProfessionalLevel(prospectData, analysis);
    const businessStage = analysis.businessContext?.growthStage || 'small';
    const marketPosition = analysis.businessContext?.marketPosition || 'follower';

    // Creative professionals tend to respond well to peer validation and expertise
    const preferredTriggers: PsychologicalTrigger['type'][] = ['social-proof', 'authority', 'consensus'];
    const avoidTriggers: PsychologicalTrigger['type'][] = [];
    
    // High-pressure tactics are typically inappropriate for creative professionals
    let maxIntensity: PsychologicalTrigger['intensity'] = 'moderate';

    // Adjust based on professional level
    if (professionalLevel === 'premium' || marketPosition === 'leader') {
      preferredTriggers.push('authority', 'consensus');
      maxIntensity = 'subtle';
    } else if (professionalLevel === 'hobbyist') {
      preferredTriggers.push('reciprocity', 'liking');
      maxIntensity = 'moderate';
    }

    // Business stage adjustments
    if (businessStage === 'startup' || businessStage === 'scaling') {
      preferredTriggers.push('social-proof', 'scarcity');
    } else if (businessStage === 'mature') {
      preferredTriggers.push('authority', 'consensus');
      avoidTriggers.push('scarcity'); // Mature businesses less responsive to urgency
    }

    // Industry-specific adjustments
    if (industry.includes('photography') || industry.includes('photographer')) {
      preferredTriggers.push('liking', 'social-proof'); // Appreciate artistic recognition
    } else if (industry.includes('festival') || industry.includes('event')) {
      preferredTriggers.push('consensus', 'social-proof'); // Community-focused
    } else if (industry.includes('market')) {
      preferredTriggers.push('authority', 'consensus'); // Efficiency-focused
    }

    return {
      industry,
      professionalLevel,
      businessStage: businessStage as TriggerProfile['businessStage'],
      marketPosition: marketPosition as TriggerProfile['marketPosition'],
      preferredTriggers: [...new Set(preferredTriggers)], // Remove duplicates
      avoidTriggers,
      maxIntensity
    };
  }

  /**
   * Select optimal trigger types for the prospect
   */
  private selectOptimalTriggers(
    profile: TriggerProfile,
    count: number
  ): PsychologicalTrigger['type'][] {
    // Filter out avoided triggers
    const availableTriggers = profile.preferredTriggers.filter(
      trigger => !profile.avoidTriggers.includes(trigger)
    );

    // Score triggers based on profile fit
    const scoredTriggers = availableTriggers.map(trigger => ({
      type: trigger,
      score: this.scoreTriggerFit(trigger, profile)
    }));

    // Sort by score and take top N
    return scoredTriggers
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(t => t.type);
  }

  /**
   * Score how well a trigger fits a profile
   */
  private scoreTriggerFit(
    triggerType: PsychologicalTrigger['type'],
    profile: TriggerProfile
  ): number {
    let score = 0;

    // Base preference score
    if (profile.preferredTriggers.includes(triggerType)) score += 3;
    if (profile.avoidTriggers.includes(triggerType)) score -= 5;

    // Industry-specific scoring
    if (profile.industry.includes('photography')) {
      switch (triggerType) {
        case 'liking': score += 2; break; // Artistic appreciation
        case 'social-proof': score += 2; break; // Portfolio validation
        case 'authority': score += 1; break;
      }
    } else if (profile.industry.includes('festival') || profile.industry.includes('event')) {
      switch (triggerType) {
        case 'consensus': score += 2; break; // Community decisions
        case 'social-proof': score += 2; break; // Other events' success
        case 'authority': score += 1; break;
      }
    } else if (profile.industry.includes('market')) {
      switch (triggerType) {
        case 'authority': score += 2; break; // Operational expertise
        case 'consensus': score += 2; break; // Industry standards
        case 'social-proof': score += 1; break;
      }
    }

    // Professional level adjustments
    if (profile.professionalLevel === 'premium') {
      if (['authority', 'consensus'].includes(triggerType)) score += 1;
      if (['scarcity', 'reciprocity'].includes(triggerType)) score -= 1;
    } else if (profile.professionalLevel === 'hobbyist') {
      if (['reciprocity', 'liking'].includes(triggerType)) score += 1;
      if (triggerType === 'authority') score -= 1;
    }

    return Math.max(0, score); // Ensure non-negative
  }

  /**
   * Create a specific trigger instance
   */
  private createTrigger(
    type: PsychologicalTrigger['type'],
    profile: TriggerProfile,
    prospectData: any,
    analysis: any,
    campaignData: any
  ): PsychologicalTrigger | null {
    const intensity = this.determineIntensity(type, profile);
    const context = this.generateContext(type, profile, prospectData, analysis);
    const content = this.generateTriggerContent(type, intensity, context, profile);

    if (!content) return null;

    return {
      type,
      intensity,
      content,
      context,
      industryAppropriate: true,
      conversionImpact: this.estimateConversionImpact(type, intensity, profile)
    };
  }

  /**
   * Determine appropriate intensity for a trigger
   */
  private determineIntensity(
    type: PsychologicalTrigger['type'],
    profile: TriggerProfile
  ): PsychologicalTrigger['intensity'] {
    // Start with profile max
    let intensity = profile.maxIntensity;

    // Certain triggers are naturally more subtle for creative professionals
    if (['authority', 'liking'].includes(type) && profile.professionalLevel === 'premium') {
      intensity = 'subtle';
    }

    // Social proof can be more moderate even for premium professionals
    if (type === 'social-proof' && intensity === 'subtle') {
      intensity = 'moderate';
    }

    return intensity;
  }

  /**
   * Generate contextual information for the trigger
   */
  private generateContext(
    type: PsychologicalTrigger['type'],
    profile: TriggerProfile,
    prospectData: any,
    analysis: any
  ): string {
    const companyName = prospectData.companyName || 'business';
    const industry = profile.industry;
    const painPoint = analysis.painPoints?.[0] || 'operational challenges';

    switch (type) {
      case 'social-proof':
        return `${industry} professionals with similar ${painPoint}`;
      
      case 'authority':
        return `expertise in ${industry} operations and ${painPoint}`;
      
      case 'consensus':
        return `industry standard practices for ${industry} businesses`;
      
      case 'scarcity':
        return `limited availability for ${industry} optimization projects`;
      
      case 'reciprocity':
        return `valuable insights for ${companyName}'s ${painPoint}`;
      
      case 'liking':
        return `appreciation for ${companyName}'s creative work in ${industry}`;
      
      case 'commitment':
        return `commitment to improving ${industry} operations`;
      
      default:
        return `relevant ${industry} business context`;
    }
  }

  /**
   * Generate trigger content based on type and intensity
   */
  private generateTriggerContent(
    type: PsychologicalTrigger['type'],
    intensity: PsychologicalTrigger['intensity'],
    context: string,
    profile: TriggerProfile
  ): string {
    const templates = this.getTriggerTemplates(type, intensity, profile);
    
    // Select template based on context and industry
    const template = this.selectBestTemplate(templates, context, profile);
    
    return this.customizeTemplate(template, context, profile);
  }

  /**
   * Get templates for a trigger type and intensity
   */
  private getTriggerTemplates(
    type: PsychologicalTrigger['type'],
    intensity: PsychologicalTrigger['intensity'],
    profile: TriggerProfile
  ): string[] {
    const templates = {
      'social-proof': {
        subtle: this.getIndustrySpecificSocialProofTemplates('subtle', profile.industry),
        moderate: this.getIndustrySpecificSocialProofTemplates('moderate', profile.industry),
        strong: this.getIndustrySpecificSocialProofTemplates('strong', profile.industry)
      },
      'authority': {
        subtle: this.getIndustrySpecificAuthorityTemplates('subtle', profile.industry),
        moderate: this.getIndustrySpecificAuthorityTemplates('moderate', profile.industry),
        strong: this.getIndustrySpecificAuthorityTemplates('strong', profile.industry)
      },
      'consensus': {
        subtle: [
          'The {industry} community generally agrees',
          'There\'s growing consensus in {industry}',
          'Industry best practices suggest'
        ],
        moderate: [
          'The standard approach in {industry} is',
          'Most {industry} leaders recommend',
          'Industry research consistently shows'
        ],
        strong: [
          'Industry standards now require',
          'Every leading {industry} business uses',
          'The {industry} industry has universally adopted'
        ]
      },
      'liking': {
        subtle: [
          'I appreciate your professional approach to',
          'Your work shows genuine dedication',
          'I admire how you\'ve developed'
        ],
        moderate: [
          'Your vision clearly demonstrates expertise',
          'The quality of your work reflects professionalism',
          'I\'m impressed by your commitment to excellence'
        ],
        strong: [
          'Your exceptional work truly stands out',
          'The excellence in your approach',
          'Your innovative solutions inspire confidence'
        ]
      },
      'reciprocity': {
        subtle: [
          'I\'d love to share some insights about',
          'I have some thoughts on optimizing',
          'I came across something relevant to'
        ],
        moderate: [
          'I\'d be happy to share our research on',
          'I have some valuable insights about',
          'I\'d like to offer some perspective on'
        ],
        strong: [
          'I\'m excited to share our exclusive research on',
          'I have breakthrough insights that could help with',
          'I want to offer you first access to our findings on'
        ]
      },
      'scarcity': {
        subtle: [
          'Given the seasonal nature of {industry}',
          'With the current {industry} market dynamics',
          'Considering the timing in {industry}'
        ],
        moderate: [
          'While we typically focus on larger {industry} operations',
          'Given our limited capacity for {industry} projects',
          'With only a few {industry} optimization slots available'
        ],
        strong: [
          'We rarely take on additional {industry} clients',
          'This opportunity is only available to select {industry} businesses',
          'We\'re limiting this {industry} program to just 5 participants'
        ]
      },
      'commitment': {
        subtle: [
          'I believe in supporting {industry} professionals',
          'I\'m committed to helping {industry} businesses',
          'My focus is on empowering {industry} operations'
        ],
        moderate: [
          'I\'m dedicated to transforming {industry} operations',
          'My mission is advancing {industry} business success',
          'I\'m passionate about optimizing {industry} workflows'
        ],
        strong: [
          'I\'m personally invested in revolutionizing {industry}',
          'My life\'s work is dedicated to {industry} excellence',
          'I guarantee transformation for committed {industry} businesses'
        ]
      }
    };

    return templates[type]?.[intensity] || [];
  }

  /**
   * Select the best template for the context
   */
  private selectBestTemplate(
    templates: string[],
    context: string,
    profile: TriggerProfile
  ): string {
    if (templates.length === 0) return '';
    
    // For now, select randomly. Could be enhanced with A/B testing data
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Customize template with context-specific information
   */
  private customizeTemplate(
    template: string,
    context: string,
    profile: TriggerProfile
  ): string {
    return template.replace(/{industry}/g, this.getIndustryLabel(profile.industry));
  }

  /**
   * Get user-friendly industry label
   */
  private getIndustryLabel(industry: string): string {
    if (industry.includes('photography') || industry.includes('photographer')) {
      const photoLabels = ['photography', 'photography business', 'photo', 'visual arts'];
      return photoLabels[Math.floor(Math.random() * photoLabels.length)];
    } else if (industry.includes('festival') || industry.includes('event')) {
      const eventLabels = ['festival', 'event', 'event planning', 'community event'];
      return eventLabels[Math.floor(Math.random() * eventLabels.length)];
    } else if (industry.includes('market')) {
      const marketLabels = ['market', 'marketplace', 'vendor coordination', 'community market'];
      return marketLabels[Math.floor(Math.random() * marketLabels.length)];
    }
    
    // Vary the fallback instead of always using "creative"
    const genericLabels = ['business', 'professional service', 'industry', 'field', 'sector'];
    return genericLabels[Math.floor(Math.random() * genericLabels.length)];
  }

  /**
   * Determine professional level from prospect data
   */
  private determineProfessionalLevel(
    prospectData: any,
    analysis: any
  ): TriggerProfile['professionalLevel'] {
    const indicators = prospectData.businessIntelligence || {};
    
    // Premium indicators
    if (indicators.hasAwards || indicators.hasCertifications || 
        indicators.hasClientLogos || indicators.professionalLevel === 'premium') {
      return 'premium';
    }

    // Professional indicators
    if (indicators.hasBookingSystem || indicators.hasPricing || 
        indicators.testimonialsCount > 3 || indicators.professionalLevel === 'professional') {
      return 'professional';
    }

    // Default to hobbyist for insufficient data
    return 'hobbyist';
  }

  /**
   * Estimate conversion impact of a trigger
   */
  private estimateConversionImpact(
    type: PsychologicalTrigger['type'],
    intensity: PsychologicalTrigger['intensity'],
    profile: TriggerProfile
  ): number {
    let baseImpact = 5; // Default moderate impact

    // Type-based impact for creative professionals
    const typeImpacts = {
      'social-proof': 7,
      'authority': 6,
      'liking': 8,
      'consensus': 6,
      'reciprocity': 5,
      'scarcity': 4,
      'commitment': 5
    };

    baseImpact = typeImpacts[type] || baseImpact;

    // Intensity multiplier
    const intensityMultipliers = {
      'subtle': 0.8,
      'moderate': 1.0,
      'strong': 1.2
    };

    baseImpact *= intensityMultipliers[intensity];

    // Professional level adjustment
    if (profile.professionalLevel === 'premium' && ['liking', 'authority'].includes(type)) {
      baseImpact += 1;
    } else if (profile.professionalLevel === 'hobbyist' && type === 'scarcity') {
      baseImpact -= 1;
    }

    return Math.min(10, Math.max(1, Math.round(baseImpact)));
  }

  /**
   * Get industry-specific social proof templates
   */
  private getIndustrySpecificSocialProofTemplates(
    intensity: PsychologicalTrigger['intensity'],
    industry: string
  ): string[] {
    const baseTemplates = {
      subtle: [
        'Other professionals often find',
        'Many colleagues in similar roles have mentioned',
        'I\'ve noticed professionals typically'
      ],
      moderate: [
        'Most professionals I work with discover',
        'Businesses frequently report',
        'Successful operations often share'
      ],
      strong: [
        '90% of professionals see improvements',
        'Leading businesses consistently achieve',
        'Top-performing operations all use'
      ]
    };

    if (industry.includes('photography') || industry.includes('photographer')) {
      return {
        subtle: [
          'Many photographers mention how their clients react when they see prints with "stunning vibrant colours"',
          'Successful studios often tell me they can "practically count the branches on the trees" in their prints',
          'Fellow photographers appreciate when "no question is too hard" for their print partner to answer',
          'Professional photographers find their clients get excited about "beautiful products, excellent printing, quality, colours"',
          'Studios frequently share how the right partner makes "everything done in-house" feel seamless'
        ],
        moderate: [
          'Photography studios consistently mention "colour matching was superb" as a game-changer for their business',
          'Professional photographers tell me "customer service is next level" matters more than they initially thought',
          'Award-winning photographers often say they want partners who "go over and beyond time and again"',
          'Established studios realize that when clients see quality, "my business has experienced significant growth"',
          'Most successful photographers prioritize partners where they\'re "always so excited" to receive products'
        ],
        strong: [
          'Every photographer I work with wants clients who are impressed by prints so detailed they can see individual tree branches',
          'Top studios consistently achieve the kind of quality where clients examine prints closely and are amazed by the detail',
          'Professional photographers universally want the confidence that comes from superior colour accuracy',
          'Leading photography businesses prioritize partners who make them excited about their finished products',
          'Successful studios all understand that exceptional print quality directly drives business growth'
        ]
      }[intensity];
    }

    return baseTemplates[intensity];
  }

  /**
   * Get industry-specific authority templates
   */
  private getIndustrySpecificAuthorityTemplates(
    intensity: PsychologicalTrigger['intensity'],
    industry: string
  ): string[] {
    const baseTemplates = {
      subtle: [
        'In my experience with {industry}',
        'Having worked with {industry} operations',
        'From what I\'ve observed in {industry}'
      ],
      moderate: [
        'After helping numerous {industry} businesses',
        'Through my specialization in {industry} optimization',
        'Based on my {industry} expertise'
      ],
      strong: [
        'As a recognized expert in {industry} operations',
        'Having optimized over 100 {industry} businesses',
        'My proven track record in {industry} shows'
      ]
    };

    if (industry.includes('photography') || industry.includes('photographer')) {
      return {
        subtle: [
          'Having worked with photographers who consistently hear "colour matching was superb" from their clients',
          'Through partnering with studios where everything is "done in-house" to maintain quality control',
          'Based on my experience helping photographers achieve prints where you can see incredible detail',
          'From working with studios whose customers get excited about receiving their finished products',
          'In my work with photographers who prioritize "beautiful products, excellent printing, quality, colours"'
        ],
        moderate: [
          'As someone who specializes in helping photographers achieve superior colour accuracy in their prints',
          'With extensive experience ensuring photographers never have to worry that "no question is too hard"',
          'Having helped numerous studios achieve the kind of detail where clients examine every aspect closely',
          'Through my focus on partnerships where photographers are confident in their print quality',
          'As a specialist in ensuring photography businesses experience measurable growth through superior products'
        ],
        strong: [
          'As the expert behind print solutions that consistently deliver stunning colour accuracy',
          'Having established the industry standard for photography print partnerships that drive business growth',
          'As the authority on achieving print quality that makes photographers excited about their finished work',
          'With my proven track record of helping studios achieve prints with exceptional detail and colour',
          'As the specialist photographers trust when they need confidence in their print partner'
        ]
      }[intensity];
    }

    return baseTemplates[intensity];
  }
}