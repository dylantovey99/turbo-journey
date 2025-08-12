import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { MissiveConfig } from '@/types';

export interface MissiveDraft {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  format?: 'text' | 'html';
  attachments?: any[];
}

export interface MissiveApiDraft {
  subject?: string;
  body?: string;
  to_fields: Array<{ address: string; name?: string }>;
  cc_fields?: Array<{ address: string; name?: string }>;
  bcc_fields?: Array<{ address: string; name?: string }>;
  from_field?: { address: string; name?: string };
  attachments?: any[];
}

export interface MissiveDraftResponse {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MissiveApiError {
  error: {
    message: string;
    code: string;
    details?: any;
  };
}

export class MissiveClient {
  private client: AxiosInstance;
  private lastRequestTime: number = 0;
  private readonly minInterval: number = 1000; // 1 second between requests
  private static instance: MissiveClient;

  constructor(missiveConfig?: Partial<MissiveConfig>) {
    const apiConfig = {
      apiToken: missiveConfig?.apiToken || config.missive.apiToken,
      baseUrl: missiveConfig?.baseUrl || config.missive.baseUrl,
      accountId: missiveConfig?.accountId || config.missive.defaultAccountId,
    };

    if (!apiConfig.apiToken) {
      throw new Error('Missive API token is required');
    }

    this.client = axios.create({
      baseURL: apiConfig.baseUrl,
      headers: {
        'Authorization': `Bearer ${apiConfig.apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Personalized-Email-Generator/1.0',
      },
      timeout: 30000, // 30 second timeout
    });

    this.setupInterceptors();
    logger.info('MissiveClient initialized', { baseUrl: apiConfig.baseUrl });
  }

  public static getInstance(): MissiveClient {
    if (!MissiveClient.instance) {
      MissiveClient.instance = new MissiveClient();
    }
    return MissiveClient.instance;
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        await this.enforceRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and logging
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('Missive API request successful', {
          url: response.config.url,
          status: response.status,
          method: response.config.method,
        });
        return response;
      },
      (error) => {
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          
          logger.error('Missive API request failed', {
            url: error.config?.url,
            method: error.config?.method,
            status,
            error: data,
          });

          // Handle specific error cases
          if (status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            logger.warn('Rate limit exceeded', { retryAfter });
            
            // You could implement automatic retry logic here
            throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
          }

          if (status === 401) {
            throw new Error('Unauthorized: Invalid Missive API token');
          }

          if (status === 404) {
            throw new Error('Resource not found');
          }

          throw new Error(`Missive API error: ${data?.error?.message || 'Unknown error'}`);
        }

        logger.error('Missive API network error', error);
        throw error;
      }
    );
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      logger.debug('Rate limiting: waiting', { delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  public async createDraft(
    draft: MissiveDraft,
    accountId?: string
  ): Promise<MissiveDraftResponse> {
    try {
      logger.info('Creating Missive draft', {
        to: draft.to,
        subject: draft.subject?.substring(0, 50),
        format: draft.format || 'html'
      });

      // Convert to Missive API format
      const apiDraft: MissiveApiDraft = {
        subject: draft.subject,
        body: draft.body,
        to_fields: draft.to.map(email => ({ address: email })),
        from_field: {
          address: config.email.defaultFromEmail,
          name: config.email.defaultFromName
        }
      };

      if (draft.cc && draft.cc.length > 0) {
        apiDraft.cc_fields = draft.cc.map(email => ({ address: email }));
      }

      if (draft.bcc && draft.bcc.length > 0) {
        apiDraft.bcc_fields = draft.bcc.map(email => ({ address: email }));
      }

      const response = await this.client.post('/drafts', {
        drafts: apiDraft
      });

      logger.info('Missive draft created successfully', {
        draftId: response.data.id,
        status: response.data.status
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to create Missive draft', {
        error: error instanceof Error ? error.message : 'Unknown error',
        draft: {
          to: draft.to,
          subject: draft.subject?.substring(0, 50)
        }
      });
      throw error;
    }
  }

  public async getDraft(draftId: string): Promise<any> {
    try {
      const response = await this.client.get(`/drafts/${draftId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get Missive draft: ${draftId}`, error);
      throw error;
    }
  }

  public async updateDraft(
    draftId: string,
    updates: Partial<MissiveDraft>
  ): Promise<MissiveDraftResponse> {
    try {
      logger.info('Updating Missive draft', { draftId });

      const response = await this.client.patch(`/drafts/${draftId}`, updates);

      logger.info('Missive draft updated successfully', {
        draftId: response.data.id,
        status: response.data.status
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to update Missive draft: ${draftId}`, error);
      throw error;
    }
  }

  public async deleteDraft(draftId: string): Promise<void> {
    try {
      await this.client.delete(`/drafts/${draftId}`);
      logger.info('Missive draft deleted successfully', { draftId });
    } catch (error) {
      logger.error(`Failed to delete Missive draft: ${draftId}`, error);
      throw error;
    }
  }

  public async sendDraft(draftId: string): Promise<any> {
    try {
      logger.info('Sending Missive draft', { draftId });

      const response = await this.client.post(`/drafts/${draftId}/send`);

      logger.info('Missive draft sent successfully', {
        draftId,
        messageId: response.data.id,
        conversationId: response.data.conversation_id
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to send Missive draft: ${draftId}`, error);
      throw error;
    }
  }

  /**
   * Send draft and capture conversation ID for reply monitoring
   */
  public async sendDraftWithTracking(draftId: string, emailJobId: string): Promise<{
    messageId: string;
    conversationId: string;
    sentAt: Date;
  }> {
    try {
      logger.info('Sending Missive draft with tracking', { draftId, emailJobId });

      // Send the draft
      const response = await this.client.post(`/drafts/${draftId}/send`);
      
      const messageId = response.data.id;
      const conversationId = response.data.conversation_id;
      const sentAt = new Date();

      if (!conversationId) {
        logger.error('No conversation ID returned from Missive after sending', { 
          draftId, 
          messageId,
          response: response.data 
        });
        throw new Error('Missive did not return conversation ID after sending draft');
      }

      // Update the email job with conversation tracking info
      const { EmailJobModel } = await import('@/models');
      await EmailJobModel.findByIdAndUpdate(emailJobId, {
        'response.metadata.conversationId': conversationId,
        'response.metadata.messageId': messageId,
        'analytics.sentAt': sentAt,
        status: 'completed'
      });

      logger.info('Draft sent and tracking updated', {
        draftId,
        emailJobId,
        messageId,
        conversationId,
        sentAt: sentAt.toISOString()
      });

      return {
        messageId,
        conversationId,
        sentAt
      };

    } catch (error) {
      logger.error(`Failed to send draft with tracking: ${draftId}`, error);
      
      // Update email job status to failed
      try {
        const { EmailJobModel } = await import('@/models');
        await EmailJobModel.findByIdAndUpdate(emailJobId, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error sending draft'
        });
      } catch (updateError) {
        logger.error('Failed to update email job status after send failure', updateError);
      }
      
      throw error;
    }
  }

  public async listDrafts(accountId?: string, limit: number = 50): Promise<any[]> {
    try {
      const params: any = { limit };
      if (accountId) params.account_id = accountId;

      const response = await this.client.get('/drafts', { params });
      return response.data.drafts || [];
    } catch (error) {
      logger.error('Failed to list Missive drafts', error);
      throw error;
    }
  }

  public async getAccountInfo(accountId?: string): Promise<any> {
    try {
      const targetAccountId = accountId || config.missive.defaultAccountId;
      const response = await this.client.get(`/accounts/${targetAccountId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get account info: ${accountId}`, error);
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Test with drafts endpoint which is more universally available
      await this.client.get('/drafts', { params: { limit: 1 } });
      return true;
    } catch (error) {
      logger.error('Missive health check failed', error);
      return false;
    }
  }

  private getDefaultAccountId(): string {
    return config.missive.defaultAccountId || 'me'; // 'me' is a valid fallback in Missive API
  }

  /**
   * Get conversation by draft ID (for response monitoring)
   */
  public async getConversationByDraftId(draftId: string): Promise<any> {
    try {
      logger.debug(`Getting conversation for draft: ${draftId}`);
      
      // First, check if we have the conversation ID stored in email jobs
      const { EmailJobModel } = await import('@/models');
      const emailJob = await EmailJobModel.findOne({ 
        missiveDraftId: draftId,
        'response.metadata.conversationId': { $exists: true, $ne: null }
      });
      
      if (emailJob?.response?.metadata?.conversationId) {
        logger.debug(`Found stored conversation ID for draft: ${draftId}`);
        return await this.getConversation(emailJob.response.metadata.conversationId);
      }
      
      // Fallback: try to get the draft to find the conversation ID
      const draft = await this.getDraft(draftId);
      if (draft?.conversation_id) {
        logger.debug(`Found conversation ID in draft response: ${draftId}`);
        return await this.getConversation(draft.conversation_id);
      }
      
      // If still no conversation_id, the draft may not have been sent yet
      logger.warn(`No conversation ID found for draft: ${draftId}. Draft may not have been sent yet.`);
      return null;
      
    } catch (error) {
      logger.error(`Failed to get conversation for draft: ${draftId}`, error);
      throw error;
    }
  }

  /**
   * Get specific conversation
   */
  public async getConversation(conversationId: string): Promise<any> {
    try {
      const response = await this.client.get(`/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get conversation: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * List conversations with filtering
   */
  public async listConversations(params: {
    limit?: number;
    until?: string;
    inbox?: boolean;
    assigned?: boolean;
    closed?: boolean;
    flagged?: boolean;
  } = {}): Promise<any[]> {
    try {
      const response = await this.client.get('/conversations', { params });
      return response.data.conversations || [];
    } catch (error) {
      logger.error('Failed to list conversations', error);
      throw error;
    }
  }

  /**
   * Get conversation replies from a specific prospect
   */
  public async getConversationReplies(
    conversationId: string,
    fromEmail: string,
    sinceDate: Date
  ): Promise<any[]> {
    try {
      logger.debug(`Getting replies from ${fromEmail} since ${sinceDate.toISOString()}`);
      
      // Get all messages in the conversation
      const messages = await this.getConversationMessages(conversationId, { limit: 50 });
      
      // Filter for messages from the specific email address since the given date
      const replies = messages.filter(message => {
        // Check if message is from the prospect email
        const messageFrom = message.from?.address || message.author?.email;
        const isFromProspect = messageFrom?.toLowerCase() === fromEmail.toLowerCase();
        
        // Check if message is after the sent date
        const messageDate = new Date(message.delivered_at || message.created_at);
        const isAfterSentDate = messageDate >= sinceDate;
        
        // Check if this is a reply (not the original message)
        const isReply = message.in_reply_to && message.in_reply_to.length > 0;
        
        return isFromProspect && isAfterSentDate && isReply;
      });
      
      logger.debug(`Found ${replies.length} replies from ${fromEmail}`);
      return replies;
      
    } catch (error) {
      logger.error(`Failed to get conversation replies: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * Get messages in a conversation
   */
  public async getConversationMessages(conversationId: string, params: {
    limit?: number;
    until?: string;
  } = {}): Promise<any[]> {
    try {
      const response = await this.client.get(`/conversations/${conversationId}/messages`, { params });
      return response.data.messages || [];
    } catch (error) {
      logger.error(`Failed to get conversation messages: ${conversationId}`, error);
      throw error;
    }
  }

  /**
   * Find conversations by participant email
   */
  public async findConversationsByParticipant(
    email: string,
    limit: number = 25
  ): Promise<any[]> {
    try {
      // Get recent conversations and filter by participant
      const conversations = await this.listConversations({ limit });
      
      const matchingConversations = conversations.filter(conv => {
        const participants = conv.participants || [];
        return participants.some((p: any) => 
          p.email?.toLowerCase() === email.toLowerCase()
        );
      });
      
      logger.debug(`Found ${matchingConversations.length} conversations with ${email}`);
      return matchingConversations;
      
    } catch (error) {
      logger.error(`Failed to find conversations by participant: ${email}`, error);
      throw error;
    }
  }

  public async batchCreateDrafts(
    drafts: Array<MissiveDraft & { accountId?: string }>,
    batchSize: number = 5
  ): Promise<{ successful: MissiveDraftResponse[]; failed: Array<{ draft: MissiveDraft; error: string }> }> {
    logger.info(`Creating ${drafts.length} Missive drafts in batches`, { batchSize });

    const successful: MissiveDraftResponse[] = [];
    const failed: Array<{ draft: MissiveDraft; error: string }> = [];

    for (let i = 0; i < drafts.length; i += batchSize) {
      const batch = drafts.slice(i, i + batchSize);
      
      logger.info(`Processing Missive draft batch ${Math.floor(i / batchSize) + 1}`, {
        batch: batch.length,
        remaining: drafts.length - i - batch.length
      });

      const promises = batch.map(async (draft) => {
        try {
          const result = await this.createDraft(draft, draft.accountId);
          successful.push(result);
          return result;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          failed.push({ draft, error: errorMessage });
          logger.error('Batch draft creation failed', {
            to: draft.to,
            subject: draft.subject?.substring(0, 50),
            error: errorMessage
          });
          return null;
        }
      });

      await Promise.all(promises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < drafts.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Completed batch draft creation`, {
      total: drafts.length,
      successful: successful.length,
      failed: failed.length
    });

    return { successful, failed };
  }

  public getRateLimitHeaders(response: AxiosResponse): {
    limit?: string;
    remaining?: string;
    reset?: string;
  } {
    return {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
      reset: response.headers['x-ratelimit-reset'],
    };
  }
}