import { Request, Response, NextFunction } from 'express';
// import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}

export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { statusCode = 500, message } = error;
  
  console.error(`[${new Date().toISOString()}] ERROR:`, {
    method: req.method,
    url: req.url,
    statusCode,
    message,
    stack: error.stack,
    body: req.body,
    requestId: req.headers['x-request-id']
  });

  // Don't expose internal errors in production
  const responseMessage = statusCode === 500 && process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : message;

  res.status(statusCode).json({
    success: false,
    error: responseMessage,
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id']
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};