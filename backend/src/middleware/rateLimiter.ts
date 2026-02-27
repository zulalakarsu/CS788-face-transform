import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10');

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 3600000);

export const rateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  // Skip rate limiting for health checks
  if (req.path === '/health') {
    return next();
  }

  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  if (!store[clientId] || store[clientId].resetTime < now) {
    store[clientId] = {
      count: 1,
      resetTime: now + WINDOW_MS
    };
    return next();
  }

  if (store[clientId].count >= MAX_REQUESTS) {
    const resetIn = Math.ceil((store[clientId].resetTime - now) / 1000);
    res.status(429).json({
      error: 'Too many requests',
      resetIn: `${resetIn} seconds`,
      limit: MAX_REQUESTS,
      window: `${WINDOW_MS / 1000} seconds`
    });
    return;
  }

  store[clientId].count++;
  next();
};