import * as expenseService from '../services/expense.service.js';
import Settlement from '../models/settlement.model.js';
import Expense from '../models/expense.model.js';
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
        const expense = await expenseService.addExpense({
            userId: req.user?.id || req.body.userId,
            ...req.body
        });
        res.status(201).json(normalizeExpense(expense));
    } catch (error) {
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

        // Record the settlement
        if (data.settled && !data.alreadyPaid) {
            const expense = await Expense.findById(req.params.id)
                .populate('paidBy')
                .populate('createdBy');

            // Support both legacy paidBy and new createdBy fields
            const payer = expense?.paidBy || expense?.createdBy;

            if (expense) {
                // Find participant amount - support both old and new schema
                const participant = expense.participants?.find(
                    p => String(p.userId) === String(req.user?.id)
                );

                const amount = participant?.amount || participant?.shareAmount || 0;

                const settlement = await Settlement.create({
                    expenseId: req.params.id,
                    from: req.user?.id,
                    to: payer,
                    amount: amount,
                    description: `Settlement for: ${expense.description}`,
                });

                await settlement.populate('from', 'name email');
                await settlement.populate('to', 'name email');

                data.settlement = settlement;
            }
        }

        res.json(data);
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
