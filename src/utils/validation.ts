import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      logger.warn('Request validation failed', {
        error: error.details,
        path: req.path,
        method: req.method
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message,
        details: error.details
      });
    }
    
    return next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params);
    
    if (error) {
      logger.warn('Params validation failed', {
        error: error.details,
        path: req.path,
        method: req.method
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message,
        details: error.details
      });
    }
    
    return next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query);
    
    if (error) {
      logger.warn('Query validation failed', {
        error: error.details,
        path: req.path,
        method: req.method
      });
      
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.details[0].message,
        details: error.details
      });
    }
    
    return next();
  };
};

// Common validation schemas
export const schemas = {
  prospect: Joi.object({
    website: Joi.string().uri().required(),
    contactEmail: Joi.string().email().required(),
    contactName: Joi.string().allow('', null).optional(),
    companyName: Joi.string().allow('', null).optional(),
    industry: Joi.string().allow('', null).optional()
  }),
  
  campaign: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    marketingDocument: Joi.string().min(10).required(),
    emailTemplate: Joi.string().optional(),
    usps: Joi.array().items(Joi.string()).optional(),
    targetAudience: Joi.string().optional(),
    tone: Joi.string().valid('professional', 'casual', 'friendly', 'formal').optional(),
    emailStyle: Joi.string().valid('statement', 'question').optional(),
    missiveAccountId: Joi.string().required()
  }),
  
  campaignUpdate: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    marketingDocument: Joi.string().min(10).optional(),
    emailTemplate: Joi.string().optional(),
    usps: Joi.array().items(Joi.string()).optional(),
    targetAudience: Joi.string().optional(),
    tone: Joi.string().valid('professional', 'casual', 'friendly', 'formal').optional(),
    emailStyle: Joi.string().valid('statement', 'question').optional(),
    status: Joi.string().valid('draft', 'active', 'paused', 'completed').optional()
  }),
  
  objectId: Joi.object({
    id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
  }),
  
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    filter: Joi.string().optional()
  }),
  
  bulkImport: Joi.object({
    campaignId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional()
  }),
  
  emailGeneration: Joi.object({
    prospectIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).required(),
    campaignId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
  })
};