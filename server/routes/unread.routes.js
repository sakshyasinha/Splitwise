import express from 'express';
import Redis from 'ioredis';
import Expense from '../models/expense.model.js';

const router = express.Router();
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';
const redis = new Redis(REDIS_URL);

// Get unread counts for current user across expenses
router.get('/', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const pattern = `unread:user:${userId}:expense:*`;
    const keys = await redis.keys(pattern);
    const result = {};
    if (keys.length > 0) {
      const values = await redis.mget(keys);
      keys.forEach((k, idx) => {
        const parts = k.split(':');
        const expenseId = parts[parts.length - 1];
        result[expenseId] = Number(values[idx] || 0);
      });
    }
    res.json(result);
  } catch (err) {
    console.error('Unread GET error', err);
    res.status(500).json({ message: 'Failed to fetch unreads' });
  }
});

// Clear unread for the current user for a given expense
router.post('/clear/:expenseId', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });
    const { expenseId } = req.params;
    if (!expenseId) return res.status(400).json({ message: 'Missing expenseId' });

    const key = `unread:user:${userId}:expense:${expenseId}`;
    await redis.del(key);

    // Emit update so clients can refresh badges
    try {
      const io = req.app?.locals?.io;
      if (io) {
        // notify that this user's unread for the expense is now zero
        io.of('/messages').emit('unread-updated', { expenseId, unreadByUser: { [String(userId)]: 0 } });
      }
    } catch (err) {
      console.error('Failed to emit unread clear update', err);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Unread clear error', err);
    res.status(500).json({ message: 'Failed to clear unreads' });
  }
});

export default router;
