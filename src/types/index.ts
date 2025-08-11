export interface Prospect {
  id: string;
  website: string;
  contactEmail: string;
  contactName?: string;
  companyName?: string;
  industry?: string;
  scrapedData?: ScrapedData;
  status: ProspectStatus;
  campaignIds: string[];
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScrapedData {
  title?: string;
  description?: string;
  services?: string[];
  technologies?: string[];
  recentNews?: string[];
  contactInfo?: ContactInfo;
  metadata?: Record<string, any>;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  address?: string;
  socialMedia?: Record<string, string>;
}

export enum ProspectStatus {
  PENDING = 'pending',
  SCRAPED = 'scraped',
  ANALYZED = 'analyzed',
  EMAIL_GENERATED = 'email_generated',
  DRAFT_CREATED = 'draft_created',
  FAILED = 'failed'
}

export interface Campaign {
  id: string;
  name: string;
  marketingDocument: string;
  emailTemplate?: string;
  usps: string[];
  targetAudience?: string;
  tone?: EmailTone;
  emailStyle?: EmailStyle;
  missiveAccountId: string;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed'
}

export enum EmailTone {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  FRIENDLY = 'friendly',
  FORMAL = 'formal'
}

export enum EmailStyle {
  STATEMENT = 'statement',
  QUESTION = 'question'
}

export interface EmailJob {
  id: string;
  prospectId: string;
  campaignId: string;
  status: JobStatus;
  generatedEmail?: GeneratedEmail;
  missiveDraftId?: string;
  error?: string;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export interface GeneratedEmail {
  subject: string;
  htmlBody: string;
  textBody: string;
  personalizations: string[];
  confidence: number;
}

export interface BulkImportJob {
  id: string;
  filename: string;
  totalProspects: number;
  processedProspects: number;
  successfulProspects: number;
  failedProspects: number;
  status: BulkImportStatus;
  importErrors: BulkImportError[];
  createdAt: Date;
  updatedAt: Date;
}

export enum BulkImportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface BulkImportError {
  row: number;
  error: string;
  data: Record<string, any>;
}

export interface MissiveConfig {
  apiToken: string;
  baseUrl: string;
  webhookSecret?: string;
  accountId: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ScrapingConfig {
  delayMs: number;
  timeout: number;
  maxRetries: number;
  userAgent: string;
}

export interface RateLimitConfig {
  missiveRequestsPerSecond: number;
  openaiRequestsPerMinute: number;
  scrapingDelayMs: number;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}