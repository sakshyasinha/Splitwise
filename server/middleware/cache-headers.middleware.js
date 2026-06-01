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
  // Store original send method
  const originalSend = res.send;

  // Override send to add cache headers before response
  res.send = function(data) {
    const path = req.path;

    // Set caching strategy based on endpoint
    if (path.includes('/analytics')) {
      // Analytics data changes infrequently - cache for 5 minutes
      res.set('Cache-Control', 'private, max-age=300');
    } else if (path.includes('/groups') && req.method === 'GET') {
      // Groups list changes occasionally - cache for 3 minutes
      res.set('Cache-Control', 'private, max-age=180');
    } else if (path.includes('/expenses') && req.method === 'GET') {
      if (
        path.includes('/expenses/my') ||
        path.includes('/expenses/lent') ||
        path.includes('/expenses/breakdown') ||
        path.includes('/expenses/friends')
      ) {
        // User-specific debt and balance views must update immediately after settle-up actions.
        res.set('Cache-Control', 'no-store');
      } else {
        // Expenses list changes occasionally - cache for 2 minutes
        res.set('Cache-Control', 'private, max-age=120');
      }
    } else if (path.includes('/settlements') && req.method === 'GET') {
      // Settlement data changes occasionally - cache for 3 minutes
      res.set('Cache-Control', 'private, max-age=180');
    } else if (path.includes('/activity') && req.method === 'GET') {
      if (path.includes('/activity/feed') || path.includes('/activity/unread-count')) {
        // Notification state must refresh immediately after mark-as-read actions.
        res.set('Cache-Control', 'no-store');
      } else {
        // Activity statistics can tolerate a short cache window.
        res.set('Cache-Control', 'private, max-age=60');
      }
    } else if (req.method === 'GET') {
      // Default for other GET requests - cache for 1 minute
      res.set('Cache-Control', 'private, max-age=60');
    } else {
      // Don't cache POST/PUT/DELETE
      res.set('Cache-Control', 'no-store');
    }

    // Do NOT set a synthetic ETag here. We rely on Cache-Control max-age
    // so the browser can avoid conditional requests entirely. Setting a
    // changing ETag (like Date.now()) forces revalidation and defeats caching.

    // Call original send
    return originalSend.call(this, data);
  };

  next();
};

export default cacheHeadersMiddleware;
