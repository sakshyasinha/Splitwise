import express from 'express';
import {
    getGroupDebtSimplification,
    getUserNetBalance,
    getPaymentSuggestions,
    getGroupBalances
} from '../controllers/debt.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All debt routes require authentication
router.use(protect);

// Group debt operations
router.get('/group/:groupId/simplify', getGroupDebtSimplification);
router.get('/group/:groupId/balances', getGroupBalances);

// User debt operations
router.get('/user/balance', getUserNetBalance);
router.get('/user/suggestions', getPaymentSuggestions);

export default router;
