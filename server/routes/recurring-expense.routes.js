import express from 'express';
import * as recurringExpenseController from '../controllers/recurring-expense.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/recurring-expenses
 * @desc    Create a new recurring expense
 * @access  Private
 */
router.post('/', recurringExpenseController.createRecurringExpense);

/**
 * @route   GET /api/recurring-expenses
 * @desc    Get all recurring expenses for current user
 * @access  Private
 */
router.get('/', recurringExpenseController.getUserRecurringExpenses);

/**
 * @route   GET /api/recurring-expenses/stats
 * @desc    Get recurring expense statistics
 * @access  Private
 */
router.get('/stats', recurringExpenseController.getRecurringExpenseStats);

/**
 * @route   POST /api/recurring-expenses/process-due
 * @desc    Process all due recurring expenses (cron job)
 * @access  Private (Admin only in production)
 */
router.post('/process-due', recurringExpenseController.processDueRecurringExpenses);

/**
 * @route   GET /api/recurring-expenses/:id
 * @desc    Get a specific recurring expense
 * @access  Private
 */
router.get('/:id', recurringExpenseController.getRecurringExpenseById);

/**
 * @route   PUT /api/recurring-expenses/:id
 * @desc    Update a recurring expense
 * @access  Private
 */
router.put('/:id', recurringExpenseController.updateRecurringExpense);

/**
 * @route   POST /api/recurring-expenses/:id/pause
 * @desc    Pause a recurring expense
 * @access  Private
 */
router.post('/:id/pause', recurringExpenseController.pauseRecurringExpense);

/**
 * @route   POST /api/recurring-expenses/:id/resume
 * @desc    Resume a paused recurring expense
 * @access  Private
 */
router.post('/:id/resume', recurringExpenseController.resumeRecurringExpense);

/**
 * @route   POST /api/recurring-expenses/:id/generate
 * @desc    Manually generate expense from recurring expense
 * @access  Private
 */
router.post('/:id/generate', recurringExpenseController.generateExpenseNow);

/**
 * @route   DELETE /api/recurring-expenses/:id
 * @desc    Delete a recurring expense
 * @access  Private
 */
router.delete('/:id', recurringExpenseController.deleteRecurringExpense);

export default router;