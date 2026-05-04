import express from 'express';
import smartSettlementController from '../controllers/smart-settlement.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Get smart settlement suggestions for a group
router.get('/groups/:groupId/smart-settlements', protect, smartSettlementController.getSmartSettlements);

// Get alternative payment suggestions
router.get('/groups/:groupId/alternative-payments', protect, smartSettlementController.getAlternativePayments);

// Get comprehensive settlement analysis
router.get('/groups/:groupId/settlement-analysis', protect, smartSettlementController.getSettlementAnalysis);

export default router;