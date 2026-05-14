/**
 * Simple in-memory rate limiter to prevent abuse
 * Tracks requests per user per time window
 */

class RateLimiter {
  constructor() {
    this.requests = new Map(); // Map of userId -> array of timestamps
    this.windowMs = 60 * 60 * 1000; // 1 hour window
    this.maxRequests = 5; // Max 5 nudges per hour
  }

  /**
   * Check if a user has exceeded the rate limit
   * @param {string} userId - User ID
   * @param {string} action - Action type (e.g., 'nudge')
   * @returns {Object} { allowed: boolean, remaining: number, resetTime: Date }
   */
  check(userId, action = 'default') {
    const key = `${userId}:${action}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this user/action
    let userRequests = this.requests.get(key) || [];

    // Filter out requests outside the current window
    userRequests = userRequests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (userRequests.length >= this.maxRequests) {
      // Find when the oldest request will expire
      const oldestRequest = userRequests[0];
      const resetTime = new Date(oldestRequest + this.windowMs);

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        message: `Too many requests. Please try again after ${resetTime.toLocaleTimeString()}`
      };
    }

    // Add current request
    userRequests.push(now);
    this.requests.set(key, userRequests);

    // Calculate remaining requests
    const remaining = this.maxRequests - userRequests.length;
    const resetTime = new Date(now + this.windowMs);

    return {
      allowed: true,
      remaining,
      resetTime
    };
  }

  /**
   * Reset rate limit for a specific user/action
   * @param {string} userId - User ID
   * @param {string} action - Action type
   */
  reset(userId, action = 'default') {
    const key = `${userId}:${action}`;
    this.requests.delete(key);
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(timestamp => timestamp > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

// Run cleanup every 5 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 5 * 60 * 1000);

export default rateLimiter;