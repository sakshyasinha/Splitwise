import * as recurringExpenseService from '../services/recurring-expense.service.js';

// Helper function to normalize recurring expense data
const normalizeRecurringExpense = (recurringExpense) => {
  if (!recurringExpense) return recurringExpense;

  const normalized = recurringExpense.toObject ? recurringExpense.toObject() : { ...recurringExpense };

  // Convert Decimal128 fields to numbers
  if (normalized.amount) {
    normalized.amount = Number(normalized.amount);
  }

  // Normalize split details amounts
  if (normalized.splitDetails) {
    if (normalized.splitDetails.customAmounts) {
      normalized.splitDetails.customAmounts = new Map(
        Array.from(normalized.splitDetails.customAmounts.entries()).map(([key, value]) => [
          key,
          Number(value)
        ])
      );
    }
  }

  return normalized;
};

/**
 * Create a new recurring expense
 */
export const createRecurringExpense = async (req, res) => {
  try {
    const recurringExpense = await recurringExpenseService.createRecurringExpense({
      userId: req.user?.id,
      ...req.body
    });
    res.status(201).json(normalizeRecurringExpense(recurringExpense));
  } catch (error) {
    console.error('Error in createRecurringExpense controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get all recurring expenses for the current user
 */
export const getUserRecurringExpenses = async (req, res) => {
  try {
    const data = await recurringExpenseService.getUserRecurringExpenses(req.user?.id);
    const normalizedData = data.map(normalizeRecurringExpense);
    res.json(normalizedData);
  } catch (error) {
    console.error('Error in getUserRecurringExpenses controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get a specific recurring expense by ID
 */
export const getRecurringExpenseById = async (req, res) => {
  try {
    const recurringExpense = await recurringExpenseService.getRecurringExpenseById(
      req.user?.id,
      req.params.id
    );
    res.json(normalizeRecurringExpense(recurringExpense));
  } catch (error) {
    console.error('Error in getRecurringExpenseById controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Update a recurring expense
 */
export const updateRecurringExpense = async (req, res) => {
  try {
    const recurringExpense = await recurringExpenseService.updateRecurringExpense(
      req.user?.id,
      req.params.id,
      req.body
    );
    res.json(normalizeRecurringExpense(recurringExpense));
  } catch (error) {
    console.error('Error in updateRecurringExpense controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Pause a recurring expense
 */
export const pauseRecurringExpense = async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const recurringExpense = await recurringExpenseService.pauseRecurringExpense(
      req.user?.id,
      req.params.id,
      reason
    );
    res.json(normalizeRecurringExpense(recurringExpense));
  } catch (error) {
    console.error('Error in pauseRecurringExpense controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Resume a paused recurring expense
 */
export const resumeRecurringExpense = async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const recurringExpense = await recurringExpenseService.resumeRecurringExpense(
      req.user?.id,
      req.params.id,
      reason
    );
    res.json(normalizeRecurringExpense(recurringExpense));
  } catch (error) {
    console.error('Error in resumeRecurringExpense controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Delete a recurring expense
 */
export const deleteRecurringExpense = async (req, res) => {
  try {
    const { reason = '' } = req.body;
    const data = await recurringExpenseService.deleteRecurringExpense(
      req.user?.id,
      req.params.id,
      reason
    );
    res.json(data);
  } catch (error) {
    console.error('Error in deleteRecurringExpense controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Manually trigger expense generation from a recurring expense
 */
export const generateExpenseNow = async (req, res) => {
  try {
    const result = await recurringExpenseService.generateExpenseFromRecurring(req.params.id);

    if (result.generated && result.expense) {
      // Normalize the expense data
      const normalizedExpense = {
        ...result.expense.toObject(),
        amount: Number(result.expense.amount)
      };
      res.json({ ...result, expense: normalizedExpense });
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Error in generateExpenseNow controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get recurring expense statistics
 */
export const getRecurringExpenseStats = async (req, res) => {
  try {
    const stats = await recurringExpenseService.getRecurringExpenseStats(req.user?.id);
    res.json(stats);
  } catch (error) {
    console.error('Error in getRecurringExpenseStats controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Process all due recurring expenses (admin/cron endpoint)
 */
export const processDueRecurringExpenses = async (req, res) => {
  try {
    const results = await recurringExpenseService.processDueRecurringExpenses();
    res.json(results);
  } catch (error) {
    console.error('Error in processDueRecurringExpenses controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};