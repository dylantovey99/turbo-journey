import mongoose from 'mongoose';
import { ProspectModel } from '@/models/Prospect';
import { ProspectStatus } from '@/types';

describe('Prospect Model', () => {
  describe('Validation', () => {
    it('should create a valid prospect with required fields', async () => {
      const prospectData = testUtils.createTestProspect();
      const savedProspect = await ProspectModel.create(prospectData);
      
      expect(savedProspect._id).toBeValidObjectId();
      expect(savedProspect.website).toBe(prospectData.website);
      expect(savedProspect.contactEmail).toBe(prospectData.contactEmail);
      expect(savedProspect.status).toBe(ProspectStatus.PENDING);
    });

    it('should require website field', async () => {
      const prospectData = testUtils.createTestProspect({ website: undefined });
      
      await expect(ProspectModel.create(prospectData)).rejects.toThrow('website');
    });

    it('should require contactEmail field', async () => {
      const prospectData = testUtils.createTestProspect({ contactEmail: undefined });
      
      await expect(ProspectModel.create(prospectData)).rejects.toThrow('contactEmail');
    });

    it('should enforce unique website constraint', async () => {
      const prospectData = testUtils.createTestProspect();
      
      // Create first prospect
      await ProspectModel.create(prospectData);
      
      // Try to create second prospect with same website
      await expect(ProspectModel.create(prospectData)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const prospectData = testUtils.createTestProspect({ contactEmail: 'invalid-email' });
      
      await expect(ProspectModel.create(prospectData)).rejects.toThrow();
    });

    it('should validate status enum values', async () => {
      const prospectData = testUtils.createTestProspect({ status: 'invalid-status' });
      
      await expect(ProspectModel.create(prospectData)).rejects.toThrow();
    });
  });

  describe('Methods', () => {
    it('should transform _id to id in JSON output', async () => {
      const prospectData = testUtils.createTestProspect();
      const savedProspect = await ProspectModel.create(prospectData);
      const json = savedProspect.toJSON();
      
      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });

    it('should normalize website URL to lowercase', async () => {
      const prospectData = testUtils.createTestProspect({ 
        website: 'HTTPS://TEST-COMPANY.COM' 
      });
      const prospect = ProspectModel.create(prospectData);
      
      const savedProspect = await prospect.save();
      expect(savedProspect.website).toBe('https://test-company.com');
    });

    it('should normalize email to lowercase', async () => {
      const prospectData = testUtils.createTestProspect({ 
        contactEmail: 'TEST@TEST-COMPANY.COM' 
      });
      const prospect = ProspectModel.create(prospectData);
      
      const savedProspect = await prospect.save();
      expect(savedProspect.contactEmail).toBe('test@test-company.com');
    });
  });

  describe('Indexes', () => {
    it('should have website index', async () => {
      const indexes = await ProspectModel.collection.getIndexes();
      const websiteIndex = Object.keys(indexes).find(key => 
        indexes[key].some((field: any) => field[0] === 'website')
      );
      expect(websiteIndex).toBeDefined();
    });

    it('should have contactEmail index', async () => {
      const indexes = await ProspectModel.collection.getIndexes();
      const emailIndex = Object.keys(indexes).find(key => 
        indexes[key].some((field: any) => field[0] === 'contactEmail')
      );
      expect(emailIndex).toBeDefined();
    });
  });

  describe('Scraped Data', () => {
    it('should store scraped data with proper structure', async () => {
      const scrapedData = {
        title: 'Test Company - Leading Tech Solutions',
        description: 'We provide innovative technology solutions',
        services: ['Web Development', 'AI Solutions'],
        technologies: ['React', 'Node.js'],
        recentNews: ['Company raises Series A'],
        contactInfo: {
          email: 'info@test-company.com',
          phone: '+1-555-0123'
        },
        metadata: {
          scrapedAt: new Date(),
          hasContactPage: true
        }
      };

      const prospectData = testUtils.createTestProspect({ 
        scrapedData,
        status: ProspectStatus.SCRAPED 
      });
      const prospect = ProspectModel.create(prospectData);
      
      const savedProspect = await prospect.save();
      
      expect(savedProspect.scrapedData).toBeDefined();
      expect(savedProspect.scrapedData!.title).toBe(scrapedData.title);
      expect(savedProspect.scrapedData!.services).toEqual(scrapedData.services);
      expect(savedProspect.scrapedData!.contactInfo!.email).toBe(scrapedData.contactInfo.email);
    });
  });
});