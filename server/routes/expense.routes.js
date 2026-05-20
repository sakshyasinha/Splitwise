import express from 'express';
import {
    addExpense,
    getExpenses,
    updateExpense,
    deleteExpense,
    settleDue,
    getMyDues,
    getMyLents,
    getExpenseById,
    getGroupExpenses,
    addPayer,
    getExpenseAuditLog,
    getExpenseBreakdown,
    getFriendsList
} from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import validate from '../middleware/validation.middleware.js';
import { addExpenseSchema, updateExpenseSchema } from '../schemas/expense.schema.js';
import { expenseEndpointsLimiter } from '../middleware/rate-limit.middleware.js';

const router = express.Router();

// All expense routes require authentication
router.use(protect);
router.use(expenseEndpointsLimiter);

// Basic CRUD operations
router.post('/add', validate(addExpenseSchema), addExpense);
router.get('/', getExpenses);
router.get('/my', getMyDues);
router.get('/lent', getMyLents);
router.get('/breakdown', getExpenseBreakdown);
router.get('/friends', getFriendsList);
router.get('/:id', getExpenseById);
router.put('/:id', validate(updateExpenseSchema), updateExpense);
router.delete('/:id', deleteExpense);

// Settlement operations
router.patch('/:id/settle', settleDue);

// Group operations
router.get('/group/:groupId', getGroupExpenses);

// Multi-payer support
router.post('/:id/payers', addPayer);

// Audit trail
router.get('/:id/audit', getExpenseAuditLog);

export default router;
