/**
 * HTTP Caching Middleware
 * Sets Cache-Control headers on API responses based on endpoint
 * Allows browsers to cache responses locally instead of re-requesting
 * 
 * Browser behavior:
 * - Cache hit (within TTL): Response served from browser cache, NO request to server
 * - Cache miss/expired: Request sent to server, may return 304 Not Modified
 */
const cacheHeadersMiddleware = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (data) {
    const path = req.originalUrl;

    // AUTH ROUTES - NEVER CACHE
    if (path.startsWith('/api/auth')) {
      res.set('Cache-Control', 'no-store');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.removeHeader('ETag');
    }

    // ANALYTICS
    else if (path.includes('/analytics')) {
      res.set('Cache-Control', 'private, max-age=300');
    }

    // GROUPS
    else if (path.includes('/groups') && req.method === 'GET') {
      res.set('Cache-Control', 'private, max-age=180');
    }

    // EXPENSES
    else if (path.includes('/expenses') && req.method === 'GET') {
      if (
        path.includes('/expenses/my') ||
        path.includes('/expenses/lent') ||
        path.includes('/expenses/breakdown') ||
        path.includes('/expenses/friends')
      ) {
        res.set('Cache-Control', 'no-store');
      } else {
        res.set('Cache-Control', 'private, max-age=120');
      }
    }

    // SETTLEMENTS
    else if (path.includes('/settlements') && req.method === 'GET') {
      res.set('Cache-Control', 'private, max-age=180');
    }

    // ACTIVITY
    else if (path.includes('/activity') && req.method === 'GET') {
      if (
        path.includes('/activity/feed') ||
        path.includes('/activity/unread-count')
      ) {
        res.set('Cache-Control', 'no-store');
      } else {
        res.set('Cache-Control', 'private, max-age=60');
      }
    }

    // DEFAULT GET
    else if (req.method === 'GET') {
      res.set('Cache-Control', 'private, max-age=60');
    }

    // POST PUT DELETE
    else {
      res.set('Cache-Control', 'no-store');
    }

    return originalSend.call(this, data);
  };

  next();
};

export default cacheHeadersMiddleware;