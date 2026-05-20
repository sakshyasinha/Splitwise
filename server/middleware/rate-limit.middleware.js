import { getRedisClient } from '../services/cache.service.js';
import logger from '../utils/logger.js';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;

export const createRateLimiter = (options = {}) => {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    keyGenerator = (req) => req.user?.id || req.ip,
    skip = () => false,
    message = 'Too many requests, please try again later',
  } = options;

  return async (req, res, next) => {
    try {
      if (skip(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const redisKey = `rate_limit:${key}`;
      const redis = getRedisClient();

      const current = await redis.incr(redisKey);

      if (current === 1) {
        await redis.expire(redisKey, Math.ceil(windowMs / 1000));
      }

      const limit = maxRequests;
      const remaining = Math.max(0, limit - current);
      const resetTime = Math.ceil((await redis.pttl(redisKey)) / 1000);

      res.setHeader('RateLimit-Limit', limit);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', Math.floor(Date.now() / 1000) + resetTime);

      if (current > maxRequests) {
        logger.warn('Rate limit exceeded', {
          key,
          current,
          limit,
          resetTime,
          requestId: req.id,
        });
        return res.status(429).json({
          statusCode: 429,
          message,
          retryAfter: resetTime,
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error.message);
      next();
    }
  };
};

export const authEndpointsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => req.ip,
  message: 'Too many authentication attempts, please try again later',
});

export const userEndpointsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  keyGenerator: (req) => req.user?.id || req.ip,
});

export const expenseEndpointsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 200,
  keyGenerator: (req) => req.user?.id || req.ip,
});

export const settlementsEndpointsLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 50,
  keyGenerator: (req) => req.user?.id || req.ip,
});

export const nudgeEndpointsLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  keyGenerator: (req) => req.user?.id,
  message: 'Too many nudges sent. Please try again later',
});
