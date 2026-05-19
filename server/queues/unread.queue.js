import Queue from 'bull';
import Redis from 'ioredis';
import Expense from '../models/expense.model.js';

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';

// Queue to process unread updates
export const unreadQueue = new Queue('unread-updates', REDIS_URL);

// A lightweight Redis client for counters
const redis = new Redis(REDIS_URL);

export function initUnreadQueue(io) {
  // Process jobs in-process (for simple setups). In production you may run a separate worker process.
  unreadQueue.process(async (job) => {
    const { expenseId, messageId, senderId } = job.data || {};
    if (!expenseId) return Promise.resolve();

    // Find expense participants
    const expense = await Expense.findById(expenseId).lean();
    if (!expense) return Promise.resolve();

    const participants = (expense.participants || []).map(p => (p.userId ? String(p.userId) : null)).filter(Boolean);

    // For each participant except sender, increment their unread counter for this expense
    const updates = [];
    for (const userId of participants) {
      if (senderId && String(senderId) === String(userId)) continue;
      const key = `unread:user:${userId}:expense:${expenseId}`;
      updates.push(redis.incr(key));
    }

    const results = await Promise.all(updates);

    // Build a mapping of unread counts for this expense
    const unreadByUser = {};
    let i = 0;
    for (const userId of participants) {
      if (senderId && String(senderId) === String(userId)) continue;
      const count = results[i++] || 0;
      unreadByUser[userId] = Number(count);
    }

    // Emit an update to clients (namespace /messages) so they can update UI
    try {
      if (io) {
        io.of('/messages').emit('unread-updated', { expenseId, unreadByUser });
      }
    } catch (err) {
      console.error('Failed to emit unread-updated', err);
    }

    return Promise.resolve();
  });

  unreadQueue.on('failed', (job, err) => {
    console.error('Unread job failed', job.id, err);
  });

  return { queue: unreadQueue, redis };
}

export default { unreadQueue, initUnreadQueue };
