import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { config } from '@/config';

export interface APIError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements APIError {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function createError(message: string, statusCode: number = 500): AppError {
  return new AppError(message, statusCode);
}

export const errorHandler = (
  error: APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational !== false;

  // Log error details
  logger.error('API Error:', {
    error: {
      message: error.message,
      stack: error.stack,
      statusCode,
      isOperational
    },
    request: {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      body: req.body,
      params: req.params,
      query: req.query
    }
  });

  // Prepare error response
  const errorResponse: any = {
    success: false,
    error: getErrorType(statusCode),
    message: error.message
  };

  // Add stack trace in development
  if (config.server.nodeEnv === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = {
      statusCode,
      isOperational
    };
  }

  res.status(statusCode).json(errorResponse);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404);
  next(error);
};

export const validationErrorHandler = (error: any): AppError => {
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return new AppError(`Validation Error: ${messages.join(', ')}`, 400);
  }
  
  if (error.name === 'CastError') {
    return new AppError(`Invalid ${error.path}: ${error.value}`, 400);
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return new AppError(`Duplicate field value: ${field}`, 400);
  }
  
  return error;
};

export const rateLimitHandler = (req: Request, res: Response): void => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.url
  });

  res.status(429).json({
    success: false,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: 900 // 15 minutes
  });
};

function getErrorType(statusCode: number): string {
  switch (Math.floor(statusCode / 100)) {
    case 4:
      return 'Client Error';
    case 5:
      return 'Server Error';
    default:
      return 'Unknown Error';
  }
}

// Global error handlers for uncaught exceptions
export const setupGlobalErrorHandlers = (): void => {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', {
      error: error.message,
      stack: error.stack
    });
    
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise
    });
    
    // Give the logger time to write the error
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
  });
};