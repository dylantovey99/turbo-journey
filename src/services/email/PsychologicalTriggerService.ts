import { logger } from '@/utils/logger';

export interface PsychologicalTrigger {
  type: 'social-proof' | 'authority' | 'scarcity' | 'reciprocity' | 'commitment' | 'liking' | 'consensus';
  content: string;
  industry: string;
  intensity: 'subtle' | 'moderate' | 'strong';
  context: 'opening' | 'body' | 'closing' | 'cta';
}

export interface TriggerProfile {
  industry: string;
  businessStage: string;
  preferredTriggers: string[];
  avoidTriggers: string[];
  intensityPreference: 'subtle' | 'moderate' | 'strong';
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

  public generateTriggersForProspect(
    prospectData: any,
    analysis: any,
    campaignData: any
  ): PsychologicalTrigger[] {
    const industry = analysis.businessContext?.industry || 'creative services';
    const businessStage = analysis.businessContext?.growthStage || 'scaling';
    const companySize = analysis.businessContext?.companySize || 'small';

    logger.info('Generating psychological triggers', {
      industry,
      businessStage,
      companySize
    });

    const triggers: PsychologicalTrigger[] = [];

    // Get industry-specific trigger profile
    const profile = this.getTriggerProfile(industry, businessStage, companySize);

    // Generate social proof triggers (most effective for creative professionals)
    if (profile.preferredTriggers.includes('social-proof')) {
      triggers.push(this.generateSocialProofTrigger(industry, profile.intensityPreference));
    }

    // Generate authority triggers (establish credibility)
    if (profile.preferredTriggers.includes('authority')) {
      triggers.push(this.generateAuthorityTrigger(industry, profile.intensityPreference));
    }

    // Generate subtle scarcity (time-sensitive opportunities)
    if (profile.preferredTriggers.includes('scarcity') && businessStage === 'scaling') {
      triggers.push(this.generateScarcityTrigger(industry, 'subtle'));
    }

    // Generate reciprocity (providing value first)
    if (profile.preferredTriggers.includes('reciprocity')) {
      triggers.push(this.generateReciprocityTrigger(industry, profile.intensityPreference));
    }

    // Generate consensus triggers (what peers are doing)
    if (profile.preferredTriggers.includes('consensus')) {
      triggers.push(this.generateConsensusTrigger(industry, profile.intensityPreference));
    }

    return triggers.filter(trigger => !profile.avoidTriggers.includes(trigger.type));
  }

  private getTriggerProfile(industry: string, businessStage: string, companySize: string): TriggerProfile {
    // Creative professionals respond well to peer validation and subtle authority
    const baseProfile: TriggerProfile = {
      industry,
      businessStage,
      preferredTriggers: ['social-proof', 'authority', 'reciprocity', 'consensus'],
      avoidTriggers: ['scarcity'], // Avoid high-pressure tactics
      intensityPreference: 'subtle'
    };

    if (industry.includes('photography') || industry.includes('photographer')) {
      return {
        ...baseProfile,
        preferredTriggers: ['social-proof', 'authority', 'reciprocity'],
        avoidTriggers: ['scarcity'],
        intensityPreference: 'moderate'
      };
    }

    if (industry.includes('festival') || industry.includes('event')) {
      return {
        ...baseProfile,
        preferredTriggers: ['consensus', 'social-proof', 'authority'],
        avoidTriggers: ['scarcity'],
        intensityPreference: 'subtle'
      };
    }

    if (industry.includes('market')) {
      return {
        ...baseProfile,
        preferredTriggers: ['social-proof', 'consensus', 'reciprocity'],
        avoidTriggers: ['scarcity'],
        intensityPreference: 'moderate'
      };
    }

    // For scaling businesses, allow subtle scarcity
    if (businessStage === 'scaling' || companySize === 'medium') {
      baseProfile.preferredTriggers.push('scarcity');
      baseProfile.avoidTriggers = [];
      baseProfile.intensityPreference = 'moderate';
    }

    return baseProfile;
  }

  private generateSocialProofTrigger(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): PsychologicalTrigger {
    const templates = this.getSocialProofTemplates(industry, intensity);
    const selectedTemplate = this.selectRandomTemplate(templates);

    return {
      type: 'social-proof',
      content: selectedTemplate,
      industry,
      intensity,
      context: 'body'
    };
  }

  private generateAuthorityTrigger(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): PsychologicalTrigger {
    const templates = this.getAuthorityTemplates(industry, intensity);
    const selectedTemplate = this.selectRandomTemplate(templates);

    return {
      type: 'authority',
      content: selectedTemplate,
      industry,
      intensity,
      context: 'opening'
    };
  }

  private generateScarcityTrigger(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): PsychologicalTrigger {
    const templates = this.getScarcityTemplates(industry, intensity);
    const selectedTemplate = this.selectRandomTemplate(templates);

    return {
      type: 'scarcity',
      content: selectedTemplate,
      industry,
      intensity,
      context: 'closing'
    };
  }

  private generateReciprocityTrigger(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): PsychologicalTrigger {
    const templates = this.getReciprocityTemplates(industry, intensity);
    const selectedTemplate = this.selectRandomTemplate(templates);

    return {
      type: 'reciprocity',
      content: selectedTemplate,
      industry,
      intensity,
      context: 'body'
    };
  }

  private generateConsensusTrigger(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): PsychologicalTrigger {
    const templates = this.getConsensusTemplates(industry, intensity);
    const selectedTemplate = this.selectRandomTemplate(templates);

    return {
      type: 'consensus',
      content: selectedTemplate,
      industry,
      intensity,
      context: 'body'
    };
  }

  private getSocialProofTemplates(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): string[] {
    const baseTemplates = {
      subtle: [
        'Other creative professionals often mention',
        'I\'ve noticed successful studios tend to',
        'Many industry peers find that',
        'Creative entrepreneurs frequently tell me',
        'Fellow professionals have shared that'
      ],
      moderate: [
        'Over 80% of creative professionals we work with report',
        'The most successful studios in your field typically',
        'Industry leaders consistently mention',
        'Top-performing creative businesses often',
        'Award-winning professionals frequently'
      ],
      strong: [
        '95% of our creative clients see immediate improvements in',
        'Every successful studio we\'ve worked with has',
        'Without exception, thriving creative businesses',
        'All our top-tier clients report significant',
        'Universally, high-performing creatives'
      ]
    };

    if (industry.includes('photography')) {
      return {
        subtle: [
          'Other photographers often mention their clients are "absolutely in awe" of their prints from',
          'Successful studios typically say "my business has experienced significant growth because their products are soooo good"',
          'Fellow photographers find their prints help "convey the value of what I offer" through',
          'Professional photographers frequently share how they can "count the branches on trees" with prints from',
          'Established studios often discover "next level customer service" through'
        ],
        moderate: [
          'Top photography studios consistently report "incredible turn-around times" and "stunning vibrant colours"',
          'Professional photographers see "significant growth" when clients are "in awe" of their print quality',
          'Award-winning photographers typically rely on partners who provide "next level customer service"',
          'Industry-leading studios have found 75-year warranties essential for client confidence',
          'Most successful photographers realize "beautiful products, excellent printing, quality, colours" require professional partnerships'
        ],
        strong: [
          'Every professional photographer who partners with us reports their "business has experienced significant growth"',
          'Without fail, studios using our prints find their clients are "absolutely in awe" of the results',
          'All our photography clients achieve prints where you can "count the branches on trees"',
          'Universally, successful photographers prioritize partners who provide "next level customer service"',
          '100% of our studio partners appreciate our pay-after-satisfaction guarantee with 75-year warranty'
        ]
      }[intensity];
    }

    if (industry.includes('festival') || industry.includes('event')) {
      return {
        subtle: [
          'Other festival organizers often find',
          'Successful event coordinators typically',
          'Fellow community event planners mention',
          'Experienced organizers frequently share',
          'Established festivals often discover'
        ],
        moderate: [
          'Top festival organizers consistently see',
          '80% of successful events implement',
          'Award-winning festivals typically',
          'Industry-leading events have found',
          'Most thriving festivals realize'
        ],
        strong: [
          '9 out of 10 successful festivals report',
          'Every profitable event we work with',
          'Without exception, thriving festivals',
          'All our festival clients achieve',
          'Universally, successful organizers'
        ]
      }[intensity];
    }

    return baseTemplates[intensity];
  }

  private getAuthorityTemplates(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): string[] {
    const baseTemplates = {
      subtle: [
        'In my experience working with creative professionals',
        'Having helped similar businesses optimize their workflows',
        'Through our work with industry professionals',
        'Based on our experience in the creative sector',
        'From what I\'ve observed in creative businesses'
      ],
      moderate: [
        'As a specialist in creative industry operations',
        'With over X years optimizing creative workflows',
        'As someone who focuses exclusively on creative businesses',
        'Having worked with 100+ creative professionals',
        'As a recognized expert in creative business optimization'
      ],
      strong: [
        'As the leading authority on creative business optimization',
        'Having revolutionized workflows for 500+ creative businesses',
        'As the go-to expert for creative industry efficiency',
        'With my proven track record of transforming creative operations',
        'As the creator of the industry-standard optimization framework'
      ]
    };

    if (industry.includes('photography')) {
      return {
        subtle: [
          'Having partnered with photography studios who report "significant business growth"',
          'In my experience helping studios achieve clients who are "absolutely in awe" of their prints',
          'Through our work providing "next level customer service" to professional photographers',
          'Based on helping studios deliver prints where clients can "count the branches on trees"',
          'From what I\'ve seen in studios experiencing "incredible turn-around times"'
        ],
        moderate: [
          'As a specialist in delivering prints that leave clients "in awe"',
          'With extensive experience providing "stunning vibrant colours" and "incredible turn-around times"',
          'Having helped 50+ photography studios achieve "significant business growth"',
          'As someone who focuses on "next level customer service" with 75-year warranties',
          'With my background in delivering prints where you can "count the branches on trees"'
        ],
        strong: [
          'As the leading provider of prints that consistently leave clients "absolutely in awe"',
          'Having delivered "next level customer service" and "significant business growth" to 200+ studios',
          'As the go-to authority for prints where clients can "count the branches on trees"',
          'With my proven expertise in "incredible turn-around times" and 75-year warranties',
          'As the creator of the pay-after-satisfaction guarantee methodology'
        ]
      }[intensity];
    }

    return baseTemplates[intensity];
  }

  private getScarcityTemplates(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): string[] {
    // Always keep scarcity subtle for creative professionals
    return [
      'With the busy season approaching',
      'As operational demands continue to grow',
      'Given the current industry trends',
      'With more professionals seeking efficiency',
      'As workflows become increasingly complex'
    ];
  }

  private getReciprocityTemplates(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): string[] {
    const baseTemplates = {
      subtle: [
        'I\'d be happy to share a quick insight that might help',
        'Here\'s something that could be useful for your workflow',
        'I thought you might find this approach interesting',
        'This strategy has worked well for similar businesses',
        'You might benefit from this operational insight'
      ],
      moderate: [
        'I\'d like to share a proven strategy that could help',
        'Here\'s a valuable insight I typically share with',
        'I want to offer a solution that\'s worked for others',
        'Let me share something that could significantly help',
        'I\'d be glad to provide this useful framework'
      ],
      strong: [
        'I want to give you exclusive access to our methodology',
        'Here\'s a comprehensive solution I\'m offering',
        'I\'d like to provide you with our complete framework',
        'Let me share our proprietary approach with you',
        'I want to offer you our full optimization system'
      ]
    };

    return baseTemplates[intensity];
  }

  private getConsensusTemplates(industry: string, intensity: 'subtle' | 'moderate' | 'strong'): string[] {
    const baseTemplates = {
      subtle: [
        'Many professionals in your field are exploring',
        'There\'s a growing trend among creative businesses toward',
        'More and more industry professionals are adopting',
        'The creative community is increasingly focused on',
        'Industry professionals are moving toward'
      ],
      moderate: [
        'The majority of successful professionals now use',
        'Most industry leaders have already implemented',
        'The standard practice among top performers is',
        'Leading professionals consistently choose',
        'The industry consensus points toward'
      ],
      strong: [
        'Everyone in the industry is now using',
        'You\'re missing out if you\'re not already implementing',
        'The entire industry has moved toward',
        'All successful professionals now rely on',
        'It\'s become essential for anyone serious about'
      ]
    };

    return baseTemplates[intensity];
  }

  private selectRandomTemplate(templates: string[]): string {
    return templates[Math.floor(Math.random() * templates.length)];
  }

  public integrateTriggersIntoEmail(
    emailContent: string,
    triggers: PsychologicalTrigger[]
  ): string {
    let enhancedContent = emailContent;

    // Sort triggers by context for proper placement
    const openingTriggers = triggers.filter(t => t.context === 'opening');
    const bodyTriggers = triggers.filter(t => t.context === 'body');
    const closingTriggers = triggers.filter(t => t.context === 'closing');

    // Integrate triggers naturally into the email structure
    // This is a simplified integration - in production, you'd use more sophisticated NLP
    
    // Add opening trigger after the first sentence
    if (openingTriggers.length > 0) {
      const sentences = enhancedContent.split('. ');
      if (sentences.length > 1) {
        sentences[0] += `. ${openingTriggers[0].content}`;
        enhancedContent = sentences.join('. ');
      }
    }

    // Add body triggers in the middle
    if (bodyTriggers.length > 0) {
      const paragraphs = enhancedContent.split('\\n\\n');
      if (paragraphs.length > 1) {
        const midPoint = Math.floor(paragraphs.length / 2);
        paragraphs[midPoint] += ` ${bodyTriggers[0].content}.`;
        enhancedContent = paragraphs.join('\\n\\n');
      }
    }

    // Add closing triggers before the final call-to-action
    if (closingTriggers.length > 0) {
      const lastParagraphIndex = enhancedContent.lastIndexOf('\\n\\n');
      if (lastParagraphIndex > -1) {
        const beforeLast = enhancedContent.substring(0, lastParagraphIndex);
        const lastPart = enhancedContent.substring(lastParagraphIndex);
        enhancedContent = beforeLast + `\\n\\n${closingTriggers[0].content}.` + lastPart;
      }
    }

    logger.info('Integrated psychological triggers into email', {
      triggersCount: triggers.length,
      types: triggers.map(t => t.type)
    });

    return enhancedContent;
  }
}