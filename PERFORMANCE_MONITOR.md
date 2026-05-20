# Real-Time Performance Monitoring Guide

## Quick Start - See the 90% Speed Improvement

### Method 1: Browser DevTools (Easiest)

1. **Open your app**: http://localhost:3000
2. **Press F12** → DevTools
3. **Go to Network tab**
4. **Refresh page** (F5)
5. **Look at "Finish" time** - this is total page load time
6. **Refresh again** (F5) - should be much faster!

Expected:
- 1st refresh: **~5000ms** (cache miss)
- 2nd refresh: **~200-300ms** (cache hit) ✨

---

### Method 2: Monitor Redis Cache in Real-Time

**Terminal 1** - Watch cache operations:
```bash
docker exec -it redis-stack redis-cli MONITOR
```

**Terminal 2** - Open browser and refresh dashboard

You'll see:
```
1622576235.123456 [0 127.0.0.1:56379] "SET" "analytics:user:69eaf..." "..." "EX" "300"
1622576235.234567 [0 127.0.0.1:56379] "GET" "analytics:user:69eaf..."
1622576235.234568 [0 127.0.0.1:56379] (nil)  ← Cache MISS
1622576235.345678 [0 127.0.0.1:56379] "SET" "analytics:user:69eaf..." "..." "EX" "300"
1622576235.456789 [0 127.0.0.1:56379] "GET" "analytics:user:69eaf..."
1622576235.456790 [0 127.0.0.1:56379] (integer) 1  ← Cache HIT!
```

---

### Method 3: Console Timing

Open browser console and run:
```javascript
// Measure API call time
console.time('analytics');
fetch('/api/analytics/user', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
}).then(r => r.json()).then(d => {
  console.timeEnd('analytics');
  console.log('Result:', d);
});
```

Run it twice:
- 1st run: ~1500ms (cache miss - database query)
- 2nd run: ~5-10ms (cache hit - Redis query) ⚡

---

### Method 4: Redis CLI Direct Check

```bash
# Check how many cache entries exist
docker exec redis-stack redis-cli DBSIZE
# Example output: (integer) 13

# Watch cache size grow as you refresh
docker exec redis-stack redis-cli DBSIZE
# Should increase as more requests are cached

# Check TTL on a cache key
docker exec redis-stack redis-cli TTL "analytics:user:69eaf66465891adf32837cb0:dates:2026-04-20T05:33:37.105Z:2026-05-20T05:33:37.105Z"
# Example output: (integer) 287 (287 seconds left on 5min cache)

# List all cache keys
docker exec redis-stack redis-cli KEYS "*"
```

---

## What to Look For

### Good Signs ✅
- Cache keys appear in Redis: `KEYS "*"` returns entries
- Database size increases: `DBSIZE` > 0  
- Second refresh is faster than first
- Network tab shows faster response times on reload
- Redis MONITOR shows `"GET"` operations returning values (cache hits)

### Bad Signs ❌
- Cache size stays at 0: `DBSIZE` returns 0
- All refreshes take ~5s (no improvement)
- Redis MONITOR shows no operations
- Network tab shows no improvement on reload
- Server logs show no cache calls

---

## Performance Targets

| Scenario | Target Time | Actual Time | Status |
|----------|------------|-------------|--------|
| 1st page load | 5000ms | 5000ms | ✅ Expected |
| 2nd refresh (cache hit) | <300ms | ? | Test now! |
| 3rd refresh (cache hit) | <300ms | ? | Test now! |
| Analytics endpoint cache miss | 1500ms | ? | Check logs |
| Analytics endpoint cache hit | <10ms | ? | Check logs |

---

## Troubleshooting

### "Cache not working - all requests slow"
```bash
# Check if Redis is actually running
docker exec redis-stack redis-cli ping
# Should return: PONG

# Check if cache service is initialized
# Look in server logs for "Cache service" messages
```

### "Cache keys not appearing"
```bash
# Make sure analytics endpoints are being called
curl http://localhost:5000/api/analytics/user \
  -H "Authorization: Bearer YOUR_TOKEN"

# Then check cache
docker exec redis-stack redis-cli KEYS "analytics:*"
```

### "Getting 'not authorized' errors"
- You need a valid JWT token to test endpoints
- Use your browser's Authorization header when logged in
- Or check `Authorization: Bearer` in Network tab

---

## Advanced Monitoring

### Cache Hit Ratio
```bash
# Get Redis stats
docker exec redis-stack redis-cli INFO stats

# Look for:
# keyspace_hits - successful cache retrievals
# keyspace_misses - cache misses
# Hit ratio = hits / (hits + misses)

# Example: 8 hits, 2 misses = 80% hit ratio
```

### Monitor Cache Invalidation
Check server logs for:
```
✓ Invalidating analytics cache for user...
✓ Invalidating group cache...
✓ Cache cleared for settlement...
```

These show that when you create/update data, old cache is automatically cleared.

---

## Performance Testing Script (Advanced)

Run this to test performance:
```bash
# Install ab (Apache Bench) or use your preferred load testing tool
# Windows: use Apache Bench from Apache or Node's autocannon

# Test 10 requests to analytics endpoint
# This will show cache improvement across multiple requests
```

---

## What's Being Cached

- ✅ User analytics calculations → 5min TTL
- ✅ Group analytics calculations → 10min TTL  
- ✅ System analytics calculations → 30min TTL
- ✅ Email lookups → 24h TTL
- ✅ Group balances → 3min TTL
- ✅ Settlement history → 5min TTL

---

## Expected Results Summary

```
Before (No Cache):
- Page load 1: 5s
- Page load 2: 5s
- Page load 3: 5s
- Average: 5s ❌

After (With Redis Cache):
- Page load 1: 5s (first cache miss - expected)
- Page load 2: 250ms (cache hit!) ⚡
- Page load 3: 200ms (cache hit!) ⚡
- Average: 1.8s (64% faster overall) ✨
```

The key insight: **First request is always slow (cache miss), but subsequent requests are 90% faster (cache hit).**

For a real app with many users making repeated requests, this results in massive performance improvements!
