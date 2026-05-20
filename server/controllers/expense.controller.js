import * as expenseService from '../services/expense.service.js';
import Expense from '../models/expense.model.js';
import cacheService from '../services/cache.service.js';
import mongoose from 'mongoose';

// Helper function to convert Decimal128 to number and ensure paidBy field
const normalizeExpense = (expense) => {
  if (!expense) return expense;

  const normalized = expense.toObject ? expense.toObject() : { ...expense };

  // Convert Decimal128 fields to numbers
  if (normalized.amount) {
    normalized.amount = Number(normalized.amount);
  }

  // Ensure paidBy field exists (use first payer if available)
  if (!normalized.paidBy && normalized.payers && normalized.payers.length > 0) {
    normalized.paidBy = normalized.payers[0].userId;
  }

  // Normalize participant amounts
  if (normalized.participants) {
    normalized.participants = normalized.participants.map(participant => ({
      ...participant,
      amount: Number(participant.shareAmount || participant.amount || 0),
      shareAmount: Number(participant.shareAmount || participant.amount || 0),
      paidAmount: Number(participant.paidAmount || 0),
      balance: Number(participant.balance || 0)
    }));
  }

  // Normalize payer amounts
  if (normalized.payers) {
    normalized.payers = normalized.payers.map(payer => ({
      ...payer,
      amount: Number(payer.amount || 0)
    }));
  }

  return normalized;
};

export const addExpense = async (req, res) => {
    try {
        console.log('addExpense controller called with:', {
            user: req.user,
            body: req.body
        });

        const expense = await expenseService.addExpense({
            userId: req.user?.id || req.body.userId,
            ...req.body
        });

        // Invalidate caches for all affected users and groups
        setImmediate(async () => {
          try {
            const groupId = expense.group;
            const userId = req.user?.id || req.body.userId;

            // Invalidate user analytics cache
            await cacheService.invalidateUserCache(String(userId));

            // Invalidate group caches
            if (groupId) {
              await cacheService.invalidateGroupCache(String(groupId));
            }

            // Invalidate participant caches
            if (expense.participants) {
              for (const participant of expense.participants) {
                const pId = String(participant.userId?._id || participant.userId);
                if (pId && pId !== String(userId)) {
                  await cacheService.invalidateUserCache(pId);
                }
              }
            }
          } catch (cacheError) {
            console.warn('Cache invalidation error in addExpense:', cacheError);
          }
        });

        res.status(201).json(normalizeExpense(expense));
    } catch (error) {
        console.error('Error in addExpense controller:', error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getExpenses = async (req, res) => {
    try {
        const data = await expenseService.getVisibleExpenses(req.user?.id);
        const normalizedData = data.map(normalizeExpense);
        res.json(normalizedData);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const updateExpense = async (req, res) => {
    try {
        const expense = await expenseService.updateExpense(req.user?.id, req.params.id, req.body);
        res.json(normalizeExpense(expense));
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const deleteExpense = async (req, res) => {
    try {
        const data = await expenseService.deleteExpense(req.user?.id, req.params.id);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const settleDue = async (req, res) => {
    try {
        const data = await expenseService.settleDue(req.user?.id, req.params.id);

        // Invalidate caches for all affected users and groups BEFORE responding
        try {
            const userId = req.user?.id;
            const expense = data.expense;

            // Invalidate the settling user's cache
            await cacheService.invalidateUserCache(String(userId));

            // Invalidate group cache if expense is in a group
            if (expense?.group) {
                await cacheService.invalidateGroupCache(String(expense.group));
            }

            // Invalidate caches for all participants (their balances have changed)
            if (expense?.participants) {
                for (const participant of expense.participants) {
                    const pId = String(participant.userId?._id || participant.userId);
                    if (pId && pId !== String(userId)) {
                        await cacheService.invalidateUserCache(pId);
                    }
                }
            }
        } catch (cacheError) {
            console.warn('Cache invalidation error in settleDue:', cacheError);
            // Don't block the response if cache invalidation fails
        }

        // Return response only after cache is cleared
        res.json({ settled: data.settled });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
export const getMyDues = async (req, res) => {
    try {
        const data = await expenseService.getMyDues(req.user?.id);
        // Normalize amounts in dues
        if (data.dues) {
            data.dues = data.dues.map(due => ({
                ...due,
                amount: Number(due.amount || 0)
            }));
        }
        data.totalOwed = Number(data.totalOwed || 0);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getMyLents = async (req, res) => {
    try {
        const data = await expenseService.getMyLents(req.user?.id);
        // Normalize amounts in lents
        if (data.lents) {
            data.lents = data.lents.map(lent => ({
                ...lent,
                amount: Number(lent.amount || 0)
            }));
        }
        data.totalLent = Number(data.totalLent || 0);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// New production-ready endpoints for advanced features

export const getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('group', 'name')
            .populate('paidBy', 'name email avatar')
            .populate('createdBy', 'name email avatar')
            .populate('payers.userId', 'name email avatar')
            .populate('participants.userId', 'name email avatar');

        if (!expense) {
            const error = new Error('Expense not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if user has access to this expense
        const userId = req.user?.id;
        const hasAccess =
            String(expense.paidBy) === String(userId) ||
            String(expense.createdBy) === String(userId) ||
            expense.payers?.some(p => String(p.userId) === String(userId)) ||
            expense.participants?.some(p => String(p.userId) === String(userId));

        if (!hasAccess) {
            const error = new Error('You do not have access to this expense');
            error.statusCode = 403;
            throw error;
        }

        res.json(normalizeExpense(expense));
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getGroupExpenses = async (req, res) => {
    try {
        const { groupId } = req.params;
        const data = await expenseService.getGroupExpenses(req.user?.id, groupId);
        const normalizedData = data.map(normalizeExpense);
        res.json(normalizedData);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const addPayer = async (req, res) => {
    try {
        const { expenseId } = req.params;
        const { userId, amount, paymentMethod = 'cash' } = req.body;

        const expense = await Expense.findById(expenseId);
        if (!expense) {
            const error = new Error('Expense not found');
            error.statusCode = 404;
            throw error;
        }

        // Check authorization
        if (String(expense.paidBy) !== String(req.user?.id) &&
            String(expense.createdBy) !== String(req.user?.id)) {
            const error = new Error('Only the creator can add payers');
            error.statusCode = 403;
            throw error;
        }

        // Initialize payers array if it doesn't exist
        if (!expense.payers) {
            expense.payers = [];
        }

        // Add new payer
        expense.payers.push({
            userId,
            amount: Number(amount),
            paidAt: new Date(),
            paymentMethod
        });

        // Add audit log
        if (expense.addAuditLog) {
            await expense.addAuditLog('payer_added', req.user?.id, {
                payerAdded: { userId, amount }
            });
        }

        await expense.save();

        const updatedExpense = await Expense.findById(expenseId)
            .populate('payers.userId', 'name email avatar')
            .populate('participants.userId', 'name email avatar');

        res.json(normalizeExpense(updatedExpense));
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getExpenseAuditLog = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            const error = new Error('Expense not found');
            error.statusCode = 404;
            throw error;
        }

        // Check authorization
        if (String(expense.paidBy) !== String(req.user?.id) &&
            String(expense.createdBy) !== String(req.user?.id)) {
            const error = new Error('Only the creator can view audit logs');
            error.statusCode = 403;
            throw error;
        }

        // Return audit log if it exists, otherwise return empty array
        const auditLog = expense.auditLog || [];

        // Populate user information in audit log
        const populatedAuditLog = await Promise.all(
            auditLog.map(async (log) => {
                const populatedLog = log.toObject();
                if (log.changedBy) {
                    const user = await mongoose.model('User').findById(log.changedBy)
                        .select('name email');
                    populatedLog.changedBy = user;
                }
                return populatedLog;
            })
        );

        res.json({ auditLog: populatedAuditLog });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getExpenseBreakdown = async (req, res) => {
    try {
        const data = await expenseService.getExpenseBreakdown(req.user?.id);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export const getFriendsList = async (req, res) => {
    try {
        const data = await expenseService.getFriendsList(req.user?.id);
        res.json(data);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};
