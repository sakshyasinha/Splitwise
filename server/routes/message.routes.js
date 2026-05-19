import express from 'express';
import { getMessagesForExpense, postMessageForExpense } from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/messages/:expenseId
router.get('/:expenseId', protect, getMessagesForExpense);

// POST /api/messages/:expenseId
router.post('/:expenseId', protect, postMessageForExpense);

export default router;
