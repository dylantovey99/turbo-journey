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
        messageId: response.data.id
      });

      return response.data;
    } catch (error) {
      logger.error(`Failed to send Missive draft: ${draftId}`, error);
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
      await this.client.get('/health');
      return true;
    } catch (error) {
      logger.error('Missive health check failed', error);
      return false;
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