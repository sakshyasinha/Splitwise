import RecurringExpense from '../models/recurring-expense.model.js';
import Expense from '../models/expense.model.js';
import User from '../models/user.model.js';
import { splitEqual, splitPercentage, splitShares, splitCustom } from './split.service.js';
import * as emailService from './email.service.js';

/**
 * Create a new recurring expense
 */
export const createRecurringExpense = async (data) => {
  try {
    const {
      userId,
      description,
      amount,
      currency = 'INR',
      category = 'General',
      groupId,
      paidBy,
      participants,
      splitType = 'equal',
      splitDetails = {},
      recurrence,
      notes
    } = data;

    // Validation
    if (!userId || !amount || !description || !recurrence || !recurrence.type) {
      const error = new Error('Missing required fields');
      error.statusCode = 400;
      throw error;
    }

    if (!Array.isArray(participants) || participants.length === 0) {
      const error = new Error('At least one participant is required');
      error.statusCode = 400;
      throw error;
    }

    // Resolve participant users
    const participantUsers = await resolveParticipantUsers(participants);
    const participantIds = participantUsers.map(user => user._id);

    // Calculate next occurrence date
    const nextOccurrence = calculateInitialNextOccurrence(recurrence);

    // Create recurring expense
    const recurringExpense = await RecurringExpense.create({
      description,
      amount: Number(amount),
      currency,
      category,
      group: groupId || null,
      createdBy: userId,
      paidBy: paidBy || userId,
      splitType,
      splitDetails,
      participants: participantIds.map(id => ({ userId: id })),
      recurrence: {
        ...recurrence,
        endDate: recurrence.endDate || null,
        endAfterOccurrences: recurrence.endAfterOccurrences || null
      },
      nextOccurrence,
      notes,
      auditLog: [{
        action: 'created',
        changedBy: userId,
        changedAt: new Date(),
        changes: { amount, description, recurrence },
        previousValues: {},
        reason: 'Initial recurring expense creation'
      }]
    });

    return RecurringExpense.findById(recurringExpense._id)
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('group', 'name');
  } catch (error) {
    console.error('Error in createRecurringExpense:', error);
    throw error;
  }
};

/**
 * Get all recurring expenses for a user
 */
export const getUserRecurringExpenses = async (userId) => {
  try {
    if (!userId) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      throw error;
    }

    return RecurringExpense.findByUser(userId);
  } catch (error) {
    console.error('Error in getUserRecurringExpenses:', error);
    throw error;
  }
};

/**
 * Get a specific recurring expense
 */
export const getRecurringExpenseById = async (userId, recurringExpenseId) => {
  try {
    const recurringExpense = await RecurringExpense.findById(recurringExpenseId)
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('group', 'name')
      .populate('generatedExpenses');

    if (!recurringExpense) {
      const error = new Error('Recurring expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    const hasAccess =
      String(recurringExpense.createdBy) === String(userId) ||
      String(recurringExpense.paidBy) === String(userId) ||
      recurringExpense.participants.some(p => String(p.userId) === String(userId));

    if (!hasAccess) {
      const error = new Error('You do not have access to this recurring expense');
      error.statusCode = 403;
      throw error;
    }

    return recurringExpense;
  } catch (error) {
    console.error('Error in getRecurringExpenseById:', error);
    throw error;
  }
};

/**
 * Update a recurring expense
 */
export const updateRecurringExpense = async (userId, recurringExpenseId, updates) => {
  try {
    const recurringExpense = await RecurringExpense.findById(recurringExpenseId);

    if (!recurringExpense) {
      const error = new Error('Recurring expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(recurringExpense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can update this recurring expense');
      error.statusCode = 403;
      throw error;
    }

    // Store previous values for audit log
    const previousValues = {
      description: recurringExpense.description,
      amount: recurringExpense.amount,
      recurrence: recurringExpense.recurrence,
      isActive: recurringExpense.isActive
    };

    // Update fields
    if (updates.description) recurringExpense.description = updates.description;
    if (updates.amount) recurringExpense.amount = Number(updates.amount);
    if (updates.currency) recurringExpense.currency = updates.currency;
    if (updates.category) recurringExpense.category = updates.category;
    if (updates.notes !== undefined) recurringExpense.notes = updates.notes;
    if (updates.splitType) recurringExpense.splitType = updates.splitType;
    if (updates.splitDetails) recurringExpense.splitDetails = updates.splitDetails;
    if (updates.paidBy) recurringExpense.paidBy = updates.paidBy;

    // Update participants if provided
    if (Array.isArray(updates.participants) && updates.participants.length > 0) {
      const participantUsers = await resolveParticipantUsers(updates.participants);
      recurringExpense.participants = participantUsers.map(user => ({ userId: user._id }));
    }

    // Update recurrence if provided
    if (updates.recurrence) {
      recurringExpense.recurrence = {
        ...recurringExpense.recurrence,
        ...updates.recurrence
      };

      // Recalculate next occurrence if recurrence changed
      if (updates.recurrence.type || updates.recurrence.interval) {
        recurringExpense.nextOccurrence = calculateInitialNextOccurrence(recurringExpense.recurrence);
      }
    }

    // Add audit log
    await recurringExpense.addAuditLog('updated', userId, updates, previousValues, 'Recurring expense updated');

    await recurringExpense.save();

    return RecurringExpense.findById(recurringExpense._id)
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('group', 'name');
  } catch (error) {
    console.error('Error in updateRecurringExpense:', error);
    throw error;
  }
};

/**
 * Pause a recurring expense
 */
export const pauseRecurringExpense = async (userId, recurringExpenseId, reason = '') => {
  try {
    const recurringExpense = await RecurringExpense.findById(recurringExpenseId);

    if (!recurringExpense) {
      const error = new Error('Recurring expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(recurringExpense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can pause this recurring expense');
      error.statusCode = 403;
      throw error;
    }

    await recurringExpense.pause(userId, reason);

    return RecurringExpense.findById(recurringExpense._id)
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('group', 'name');
  } catch (error) {
    console.error('Error in pauseRecurringExpense:', error);
    throw error;
  }
};

/**
 * Resume a paused recurring expense
 */
export const resumeRecurringExpense = async (userId, recurringExpenseId, reason = '') => {
  try {
    const recurringExpense = await RecurringExpense.findById(recurringExpenseId);

    if (!recurringExpense) {
      const error = new Error('Recurring expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(recurringExpense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can resume this recurring expense');
      error.statusCode = 403;
      throw error;
    }

    await recurringExpense.resume(userId, reason);

    return RecurringExpense.findById(recurringExpense._id)
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('group', 'name');
  } catch (error) {
    console.error('Error in resumeRecurringExpense:', error);
    throw error;
  }
};

/**
 * Delete a recurring expense
 */
export const deleteRecurringExpense = async (userId, recurringExpenseId, reason = '') => {
  try {
    const recurringExpense = await RecurringExpense.findById(recurringExpenseId);

    if (!recurringExpense) {
      const error = new Error('Recurring expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(recurringExpense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can delete this recurring expense');
      error.statusCode = 403;
      throw error;
    }

    await recurringExpense.softDelete(userId, reason);

    return { deleted: true };
  } catch (error) {
    console.error('Error in deleteRecurringExpense:', error);
    throw error;
  }
};

/**
 * Generate expense from recurring expense
 */
export const generateExpenseFromRecurring = async (recurringExpenseId) => {
  try {
    const recurringExpense = await RecurringExpense.findById(recurringExpenseId)
      .populate('createdBy', 'name email')
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('group', 'name');

    if (!recurringExpense) {
      const error = new Error('Recurring expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check if we should generate
    if (!recurringExpense.shouldGenerateNextOccurrence()) {
      return { generated: false, reason: 'Conditions not met' };
    }

    // Prepare expense data
    const participantIds = recurringExpense.participants.map(p => String(p.userId));
    const numericAmount = Number(recurringExpense.amount);

    // Calculate splits
    let splits;
    switch (recurringExpense.splitType) {
      case 'equal':
        splits = splitEqual(numericAmount, participantIds);
        break;
      case 'percentage':
        splits = splitPercentage(numericAmount, participantIds, recurringExpense.splitDetails.percentages);
        break;
      case 'shares':
        splits = splitShares(numericAmount, participantIds, recurringExpense.splitDetails.shares);
        break;
      case 'custom':
        splits = splitCustom(numericAmount, participantIds, recurringExpense.splitDetails.customAmounts);
        break;
      default:
        splits = splitEqual(numericAmount, participantIds);
    }

    // Create participant entries
    const participantSplits = splits.map(split => {
      const isPayer = String(split.userId) === String(recurringExpense.paidBy);
      return {
        userId: split.userId,
        amount: split.amount,
        shareAmount: split.amount,
        paidAmount: isPayer ? numericAmount : 0,
        balance: isPayer ? (numericAmount - split.amount) : -split.amount,
        status: isPayer ? 'settled' : 'pending'
      };
    });

    // Create payers
    const payers = [{
      userId: recurringExpense.paidBy,
      amount: numericAmount,
      paidAt: new Date(),
      paymentMethod: 'cash'
    }];

    // Create expense
    const expense = await Expense.create({
      group: recurringExpense.group,
      amount: numericAmount,
      description: `${recurringExpense.description} (Recurring)`,
      paidBy: recurringExpense.paidBy,
      createdBy: recurringExpense.createdBy,
      participants: participantSplits,
      currency: recurringExpense.currency,
      category: recurringExpense.category,
      splitType: recurringExpense.splitType,
      splitDetails: recurringExpense.splitDetails,
      payers,
      date: recurringExpense.nextOccurrence,
      notes: recurringExpense.notes ? `Recurring expense note: ${recurringExpense.notes}` : undefined,
      auditLog: [{
        action: 'created',
        changedBy: recurringExpense.createdBy,
        changedAt: new Date(),
        changes: {
          generatedFrom: recurringExpenseId,
          isRecurring: true
        },
        previousValues: {},
        reason: 'Generated from recurring expense'
      }]
    });

    // Mark occurrence as generated
    await recurringExpense.markOccurrenceGenerated(expense._id);

    // Add audit log to recurring expense
    await recurringExpense.addAuditLog('occurrence_generated', recurringExpense.createdBy, {
      expenseId: expense._id,
      occurrenceDate: recurringExpense.lastOccurrence
    }, {}, 'Expense generated from recurring template');

    // Send email notification
    setImmediate(async () => {
      try {
        await emailService.sendExpenseAlertEmail(expense._id);
      } catch (error) {
        console.error('Failed to send expense alert email for recurring expense:', error);
      }
    });

    return {
      generated: true,
      expense: await Expense.findById(expense._id)
        .populate('group', 'name')
        .populate('paidBy', 'name email')
        .populate('createdBy', 'name email')
        .populate('payers.userId', 'name email avatar')
        .populate('participants.userId', 'name email')
    };
  } catch (error) {
    console.error('Error in generateExpenseFromRecurring:', error);
    throw error;
  }
};

/**
 * Process all due recurring expenses
 */
export const processDueRecurringExpenses = async () => {
  try {
    const dueRecurringExpenses = await RecurringExpense.findActive();

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: []
    };

    for (const recurringExpense of dueRecurringExpenses) {
      results.processed++;
      try {
        const result = await generateExpenseFromRecurring(recurringExpense._id);
        if (result.generated) {
          results.succeeded++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          recurringExpenseId: recurringExpense._id,
          error: error.message
        });
        console.error('Failed to process recurring expense:', recurringExpense._id, error);
      }
    }

    return results;
  } catch (error) {
    console.error('Error in processDueRecurringExpenses:', error);
    throw error;
  }
};

/**
 * Get recurring expense statistics
 */
export const getRecurringExpenseStats = async (userId) => {
  try {
    if (!userId) {
      const error = new Error('User ID is required');
      error.statusCode = 400;
      throw error;
    }

    const recurringExpenses = await RecurringExpense.findByUser(userId);

    const stats = {
      total: recurringExpenses.length,
      active: 0,
      paused: 0,
      totalMonthlyAmount: 0,
      nextOccurrences: []
    };

    recurringExpenses.forEach(re => {
      if (re.isActive && !re.isPaused) {
        stats.active++;
        // Estimate monthly amount
        const monthlyAmount = estimateMonthlyAmount(re);
        stats.totalMonthlyAmount += monthlyAmount;

        if (re.nextOccurrence) {
          stats.nextOccurrences.push({
            id: re._id,
            description: re.description,
            amount: Number(re.amount),
            nextOccurrence: re.nextOccurrence
          });
        }
      } else if (re.isPaused) {
        stats.paused++;
      }
    });

    // Sort next occurrences by date
    stats.nextOccurrences.sort((a, b) => new Date(a.nextOccurrence) - new Date(b.nextOccurrence));

    return stats;
  } catch (error) {
    console.error('Error in getRecurringExpenseStats:', error);
    throw error;
  }
};

// Helper functions

const resolveParticipantUsers = async (participants) => {
  const cleaned = [...new Set(participants.map(item => String(item).trim()).filter(Boolean))];
  const users = [];

  for (const identifier of cleaned) {
    let user = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      user = await User.findById(identifier);
    }

    if (!user) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    }

    if (!user) {
      try {
        user = await User.create({
          email: identifier.toLowerCase(),
          name: identifier.split('@')[0],
          password: 'temp_password_' + Date.now(),
          isTemporary: true
        });
      } catch (error) {
        if (error.code === 11000) {
          user = await User.findOne({ email: identifier.toLowerCase() });
        } else {
          throw error;
        }
      }
    }

    if (user) {
      users.push(user);
    }
  }

  return users;
};

const calculateInitialNextOccurrence = (recurrence) => {
  const now = new Date();
  const next = new Date(now);

  switch (recurrence.type) {
    case 'daily':
      next.setDate(next.getDate() + (recurrence.interval || 1));
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * (recurrence.interval || 1)));
      if (recurrence.dayOfWeek !== undefined) {
        next.setDate(next.getDate() + (recurrence.dayOfWeek - next.getDay() + 7) % 7);
      }
      break;
    case 'biweekly':
      next.setDate(next.getDate() + (14 * (recurrence.interval || 1)));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + (recurrence.interval || 1));
      if (recurrence.dayOfMonth !== undefined) {
        next.setDate(Math.min(recurrence.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + (3 * (recurrence.interval || 1)));
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + (recurrence.interval || 1));
      if (recurrence.monthOfYear !== undefined) {
        next.setMonth(recurrence.monthOfYear - 1);
      }
      if (recurrence.dayOfMonth !== undefined) {
        next.setDate(Math.min(recurrence.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      }
      break;
    case 'custom':
      next.setDate(next.getDate() + (recurrence.interval || 1));
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
};

const estimateMonthlyAmount = (recurringExpense) => {
  const amount = Number(recurringExpense.amount);
  const { type, interval = 1 } = recurringExpense.recurrence;

  switch (type) {
    case 'daily':
      return amount * 30 / interval;
    case 'weekly':
      return amount * 4 / interval;
    case 'biweekly':
      return amount * 2 / interval;
    case 'monthly':
      return amount / interval;
    case 'quarterly':
      return amount * 4 / interval;
    case 'yearly':
      return amount * 12 / interval;
    case 'custom':
      return amount * 30 / interval; // Assume custom is daily-based
    default:
      return amount;
  }
};