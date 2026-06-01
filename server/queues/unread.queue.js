import Queue from 'bull';
import Redis from 'ioredis';
import Expense from '../models/expense.model.js';
import logger from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || 'redis://127.0.0.1:6379';

export let unreadQueue = null;
let redis = null;
let processorInitialized = false;

const getUnreadQueue = () => {
  if (!unreadQueue) {
    unreadQueue = new Queue('unread-updates', REDIS_URL);
    unreadQueue.on('error', (error) => {
      logger.warn(`Unread queue Redis unavailable: ${error.message}`);
    });
  }

  return unreadQueue;
};

const getRedisCounterClient = () => {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    redis.on('error', (error) => {
      logger.warn(`Unread counter Redis unavailable: ${error.message}`);
    });
  }

  return redis;
};

export function initUnreadQueue(io) {
  const queue = getUnreadQueue();
  const counterClient = getRedisCounterClient();

  if (processorInitialized) {
    return { queue, redis: counterClient };
  }

  processorInitialized = true;

  // Process jobs in-process (for simple setups). In production you may run a separate worker process.
  queue.process(async (job) => {
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
      updates.push(counterClient.incr(key));
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
        // Emit globally on the namespace so any listeners can react
        io.of('/messages').emit('unread-updated', { expenseId, unreadByUser });

        // Also emit to the specific expense room so clients that joined
        // `expense:<expenseId>` receive the update immediately without
        // relying on a global listener. This helps SPAs that manage
        // per-room listeners and can avoid requiring a full page reload.
        try {
          io.of('/messages').to(`expense:${expenseId}`).emit('unread-updated', { expenseId, unreadByUser });
        } catch (err) {
          logger.warn('Failed to emit unread-updated to expense room', { expenseId, error: err.message });
        }
        // Also emit to each affected user's personal room so UI badges update
        try {
          for (const [userId, count] of Object.entries(unreadByUser)) {
            try {
              io.of('/messages').to(`user:${userId}`).emit('unread-updated', { expenseId, unreadByUser: { [userId]: count } });
            } catch (err) {
              logger.warn('Failed to emit unread-updated to user room', { expenseId, userId, error: err.message });
            }
          }
        } catch (err) {
          logger.warn('Failed to emit unread-updated to user rooms', { expenseId, error: err.message });
        }
      }
    } catch (err) {
      logger.error('Failed to emit unread-updated', err);
    }

    return Promise.resolve();
  });

  queue.on('failed', (job, err) => {
    logger.error(`Unread job failed ${job?.id}: ${err.message}`);
  });

  return { queue, redis: counterClient };
}

export default { get unreadQueue() { return unreadQueue; }, initUnreadQueue };
