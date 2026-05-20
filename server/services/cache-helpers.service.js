import User from '../models/user.model.js';
import Expense from '../models/expense.model.js';
import Settlement from '../models/settlement.model.js';
import cacheService, { CACHE_TTL } from './cache.service.js';
import logger from '../utils/logger.js';

// Note: We don't create a separate Redis client here
// We use the cache.service.js client instead via cacheService functions

/**
 * Get user by email with caching
 * Caches user._id lookups to avoid database queries on every payment
 */
export const getUserByEmailCached = async (email) => {
  if (!email) return null;

  const lowerEmail = email.toLowerCase().trim();
  const cacheKey = cacheService.getCacheKey.userByEmail(lowerEmail);

  try {
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    // Query database
    const user = await User.findOne({ email: lowerEmail }).lean();
    
    if (user) {
      // Cache the result
      await cacheService.set(cacheKey, user, CACHE_TTL.USER_EMAIL);
    }

    return user;
  } catch (err) {
    logger.warn(`Error caching user lookup for ${email}:`, err.message);
    // Fall back to direct query
    return await User.findOne({ email: lowerEmail }).lean();
  }
};

/**
 * Invalidate user email cache when user is updated
 */
export const invalidateUserEmailCache = async (email) => {
  const lowerEmail = email.toLowerCase().trim();
  const cacheKey = cacheService.getCacheKey.userByEmail(lowerEmail);
  await cacheService.del(cacheKey);
};

/**
 * Calculate group balance with caching
 * Caches balance calculations for group settlements
 */
export const getGroupBalanceCached = async (groupId) => {
  const cacheKey = cacheService.getCacheKey.groupBalance(groupId);

  try {
    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        // Fetch all expenses for the group
        const expenses = await Expense.find({
          group: groupId,
          isDeleted: false
        })
          .populate('paidBy', '_id name email')
          .populate('participants.userId', '_id name email');

        // Calculate balances
        const balances = {};

        expenses.forEach(expense => {
          const participants = expense.participants || [];
          const amount = Number(expense.amount) || 0;
          const payerId = String(expense.paidBy?._id || expense.paidBy);

          // Initialize if not exists
          if (!balances[payerId]) balances[payerId] = 0;

          // Payer credits the amount
          balances[payerId] += amount;

          // Each participant owes their share
          const sharePerPerson = participants.length > 0 ? amount / participants.length : 0;
          participants.forEach(participant => {
            const participantId = String(participant.userId?._id || participant.userId);
            if (!balances[participantId]) balances[participantId] = 0;
            balances[participantId] -= sharePerPerson;
          });
        });

        return balances;
      },
      CACHE_TTL.GROUP_BALANCE
    );
  } catch (err) {
    logger.warn(`Error caching group balance for ${groupId}:`, err.message);
    throw err;
  }
};

/**
 * Get settlement history with caching
 */
export const getSettlementHistoryCached = async (userId) => {
  const cacheKey = cacheService.getCacheKey.settlementHistory(userId);

  try {
    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const settlements = await Settlement.find({
          $or: [{ from: userId }, { to: userId }]
        })
          .sort({ settledAt: -1 })
          .populate('from', 'name email avatar')
          .populate('to', 'name email avatar')
          .populate('expenseId', 'description amount date')
          .lean();

        return settlements;
      },
      CACHE_TTL.SETTLEMENT_BALANCE
    );
  } catch (err) {
    logger.warn(`Error caching settlement history for ${userId}:`, err.message);
    throw err;
  }
};

export default {
  getUserByEmailCached,
  invalidateUserEmailCache,
  getGroupBalanceCached,
  getSettlementHistoryCached
};
