import express from 'express';
import { getSettlement, recordSettlement, getSettlementHistory } from '../controllers/settlement.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/:groupId', protect, getSettlement);
router.post('/record', protect, recordSettlement);
router.get('/history/mine', protect, getSettlementHistory);

export default router;
