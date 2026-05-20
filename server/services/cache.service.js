import Redis from 'ioredis';
import logger from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';

// Lazy initialization - Redis connection only created when needed
let redis = null;
export const getRedisClient = () => {
  if (!redis) {
    redis = new Redis(REDIS_URL);
    redis.on('error', (err) => {
      logger.warn('Redis connection error:', err.message);
    });
    redis.on('connect', () => {
      logger.info('Redis cache connected');
    });
  }
  return redis;
};

/**
 * Cache TTL Constants (in seconds)
 */
export const CACHE_TTL = {
  USER_EMAIL: 24 * 60 * 60,        // 24 hours - user data doesn't change often
  ANALYTICS: 10 * 60,               // 10 minutes - analytics should be relatively fresh
  USER_ANALYTICS: 5 * 60,           // 5 minutes - personal analytics more dynamic
  SETTLEMENT_BALANCE: 3 * 60,       // 3 minutes - balances change frequently
  GROUP_DETAILS: 60 * 60,           // 1 hour - group structure rarely changes
  GROUP_BALANCE: 5 * 60,            // 5 minutes - group balances dynamic
  RECENT_EXPENSES: 2 * 60,          // 2 minutes - dashboard needs fresh data
  DEBT_CALCULATION: 5 * 60,         // 5 minutes - debt calculations
  SYSTEM_ANALYTICS: 30 * 60         // 30 minutes - system-wide analytics
};

/**
 * Cache Keys Pattern
 */
const getCacheKey = {
  userByEmail: (email) => `user:email:${email.toLowerCase()}`,
  userAnalytics: (userId, options = {}) => {
    const key = `analytics:user:${userId}`;
    if (options.groupId) return `${key}:group:${options.groupId}`;
    if (options.category) return `${key}:category:${options.category}`;
    if (options.startDate && options.endDate) {
      return `${key}:dates:${options.startDate}:${options.endDate}`;
    }
    return key;
  },
  groupAnalytics: (groupId, options = {}) => {
    const key = `analytics:group:${groupId}`;
    if (options.startDate && options.endDate) {
      return `${key}:dates:${options.startDate}:${options.endDate}`;
    }
    return key;
  },
  systemAnalytics: (options = {}) => {
    const key = `analytics:system`;
    if (options.startDate && options.endDate) {
      return `${key}:dates:${options.startDate}:${options.endDate}`;
    }
    return key;
  },
  groupBalance: (groupId) => `balance:group:${groupId}`,
  groupDetails: (groupId) => `group:${groupId}:details`,
  userRecentExpenses: (userId, limit = 50) => `expenses:user:${userId}:recent:${limit}`,
  settlementHistory: (userId) => `settlement:history:${userId}`,
  debtCalculation: (groupId) => `debt:group:${groupId}`
};

/**
 * Get cached value with fallback to fetcher function
 */
export const getOrSet = async (cacheKey, fetcher, ttl, parse = JSON.parse) => {
  try {
    // Try to get from cache
    const cached = await getRedisClient().get(cacheKey);
    if (cached) {
      try {
        return parse ? parse(cached) : cached;
      } catch (e) {
        logger.warn(`Failed to parse cached value for ${cacheKey}:`, e);
      }
    }
  } catch (err) {
    logger.warn(`Cache GET failed for ${cacheKey}:`, err.message);
    // Continue to fetch fresh data if cache fails
  }

  // Fetch fresh data
  const data = await fetcher();

  // Store in cache
  try {
    await getRedisClient().setex(
      cacheKey,
      ttl,
      JSON.stringify(data)
    );
  } catch (err) {
    logger.warn(`Cache SET failed for ${cacheKey}:`, err.message);
  }

  return data;
};

/**
 * Set cache value
 */
export const set = async (cacheKey, value, ttl) => {
  try {
    await getRedisClient().setex(cacheKey, ttl, JSON.stringify(value));
  } catch (err) {
    logger.warn(`Cache SET failed for ${cacheKey}:`, err.message);
  }
};

/**
 * Get cache value
 */
export const get = async (cacheKey) => {
  try {
    const value = await getRedisClient().get(cacheKey);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn(`Cache GET failed for ${cacheKey}:`, err.message);
    return null;
  }
};

/**
 * Delete cache key
 */
export const del = async (cacheKey) => {
  try {
    await getRedisClient().del(cacheKey);
  } catch (err) {
    logger.warn(`Cache DEL failed for ${cacheKey}:`, err.message);
  }
};

/**
 * Delete multiple cache keys (pattern or exact)
 */
export const delMany = async (pattern) => {
  try {
    const keys = await getRedisClient().keys(pattern);
    if (keys.length > 0) {
      await getRedisClient().del(...keys);
    }
  } catch (err) {
    logger.warn(`Cache DELMANY failed for pattern ${pattern}:`, err.message);
  }
};

/**
 * Invalidate all caches for a user
 */
export const invalidateUserCache = async (userId) => {
  await Promise.all([
    delMany(`analytics:user:${userId}*`),
    delMany(`expenses:user:${userId}*`),
    delMany(`settlement:history:${userId}*`),
  ]);
};

/**
 * Invalidate all caches for a group
 */
export const invalidateGroupCache = async (groupId) => {
  await Promise.all([
    del(getCacheKey.groupDetails(groupId)),
    del(getCacheKey.groupBalance(groupId)),
    del(getCacheKey.groupAnalytics(groupId)),
    del(getCacheKey.debtCalculation(groupId)),
    delMany(`analytics:user:*:group:${groupId}`)
  ]);
};

/**
 * Invalidate settlement-related caches
 */
export const invalidateSettlementCache = async (fromUserId, toUserId) => {
  await Promise.all([
    del(getCacheKey.settlementHistory(fromUserId)),
    del(getCacheKey.settlementHistory(toUserId))
  ]);
};

/**
 * Clear all caches (use sparingly - expensive)
 */
export const clearAll = async () => {
  try {
    await getRedisClient().flushdb();
    logger.info('Redis cache cleared completely');
  } catch (err) {
    logger.error('Failed to clear Redis cache:', err);
  }
};

/**
 * Get cache stats (hit/miss counts)
 */
export const getStats = async () => {
  try {
    const info = await getRedisClient().info('stats');
    return info;
  } catch (err) {
    logger.warn('Failed to get Redis stats:', err);
    return null;
  }
};

export default {
  getCacheKey,
  getOrSet,
  set,
  get,
  del,
  delMany,
  invalidateUserCache,
  invalidateGroupCache,
  invalidateSettlementCache,
  clearAll,
  getStats,
  CACHE_TTL
};
