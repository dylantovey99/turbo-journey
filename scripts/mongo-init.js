// MongoDB initialization script for Docker
// This script runs when the MongoDB container is first created

// Switch to the email-generator database
db = db.getSiblingDB('email-generator');

// Create collections with validation
db.createCollection('prospects', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['website', 'contactEmail', 'status'],
      properties: {
        website: {
          bsonType: 'string',
          description: 'Website URL is required'
        },
        contactEmail: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
          description: 'Valid email address is required'
        },
        contactName: {
          bsonType: 'string',
          description: 'Contact name'
        },
        companyName: {
          bsonType: 'string',
          description: 'Company name'
        },
        industry: {
          bsonType: 'string',
          description: 'Industry classification'
        },
        status: {
          enum: ['pending', 'scraped', 'analyzed', 'email_generated', 'draft_created', 'failed'],
          description: 'Status must be one of the enum values'
        },
        scrapedData: {
          bsonType: 'object',
          description: 'Scraped website data'
        }
      }
    }
  }
});

db.createCollection('campaigns', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'marketingDocument', 'missiveAccountId', 'status'],
      properties: {
        name: {
          bsonType: 'string',
          minLength: 1,
          maxLength: 100,
          description: 'Campaign name is required'
        },
        marketingDocument: {
          bsonType: 'string',
          minLength: 10,
          description: 'Marketing document content is required'
        },
        missiveAccountId: {
          bsonType: 'string',
          description: 'Missive account ID is required'
        },
        status: {
          enum: ['draft', 'active', 'paused', 'completed'],
          description: 'Status must be one of the enum values'
        },
        tone: {
          enum: ['professional', 'casual', 'friendly', 'formal'],
          description: 'Email tone'
        },
        usps: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Array of unique selling points'
        }
      }
    }
  }
});

db.createCollection('emailjobs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['prospectId', 'campaignId', 'status', 'attempts'],
      properties: {
        prospectId: {
          bsonType: 'objectId',
          description: 'Prospect ID is required'
        },
        campaignId: {
          bsonType: 'objectId',
          description: 'Campaign ID is required'
        },
        status: {
          enum: ['queued', 'processing', 'completed', 'failed', 'retrying'],
          description: 'Status must be one of the enum values'
        },
        attempts: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of attempts'
        },
        generatedEmail: {
          bsonType: 'object',
          description: 'Generated email content'
        },
        missiveDraftId: {
          bsonType: 'string',
          description: 'Missive draft ID'
        },
        error: {
          bsonType: 'string',
          description: 'Error message if failed'
        }
      }
    }
  }
});

db.createCollection('bulkimportjobs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['filename', 'totalProspects', 'status'],
      properties: {
        filename: {
          bsonType: 'string',
          description: 'Uploaded filename is required'
        },
        totalProspects: {
          bsonType: 'int',
          minimum: 0,
          description: 'Total number of prospects'
        },
        processedProspects: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of processed prospects'
        },
        successfulProspects: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of successful prospects'
        },
        failedProspects: {
          bsonType: 'int',
          minimum: 0,
          description: 'Number of failed prospects'
        },
        status: {
          enum: ['pending', 'processing', 'completed', 'failed'],
          description: 'Status must be one of the enum values'
        },
        errors: {
          bsonType: 'array',
          description: 'Array of error details'
        }
      }
    }
  }
});

// Create indexes for better performance
db.prospects.createIndex({ website: 1 }, { unique: true });
db.prospects.createIndex({ contactEmail: 1 });
db.prospects.createIndex({ status: 1 });
db.prospects.createIndex({ createdAt: -1 });

db.campaigns.createIndex({ name: 1 });
db.campaigns.createIndex({ status: 1 });
db.campaigns.createIndex({ createdAt: -1 });

db.emailjobs.createIndex({ prospectId: 1, campaignId: 1 }, { unique: true });
db.emailjobs.createIndex({ status: 1 });
db.emailjobs.createIndex({ createdAt: -1 });
db.emailjobs.createIndex({ campaignId: 1, status: 1 });

db.bulkimportjobs.createIndex({ status: 1 });
db.bulkimportjobs.createIndex({ createdAt: -1 });

// Create a user for the application (if needed)
db.createUser({
  user: 'emailapp',
  pwd: 'emailapp123',
  roles: [
    {
      role: 'readWrite',
      db: 'email-generator'
    }
  ]
});

print('MongoDB initialization completed successfully!');
print('Collections created: prospects, campaigns, emailjobs, bulkimportjobs');
print('Indexes created for optimal performance');
print('Application user created: emailapp');