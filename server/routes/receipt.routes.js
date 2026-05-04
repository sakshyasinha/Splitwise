import express from 'express';
import * as receiptController from '../controllers/receipt.controller.js';
import { handleUploadError } from '../middleware/upload.middleware.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   POST /api/receipts/:expenseId
 * @desc    Upload a single receipt for an expense
 * @access  Private
 */
router.post(
  '/:expenseId',
  receiptController.uploadSingle,
  handleUploadError,
  receiptController.uploadReceipt
);

/**
 * @route   POST /api/receipts/:expenseId/multiple
 * @desc    Upload multiple receipts for an expense
 * @access  Private
 */
router.post(
  '/:expenseId/multiple',
  receiptController.uploadMultiple,
  handleUploadError,
  receiptController.uploadMultipleReceipts
);

/**
 * @route   GET /api/receipts/:expenseId
 * @desc    Get all receipts for an expense
 * @access  Private
 */
router.get('/:expenseId', receiptController.getExpenseReceipts);

/**
 * @route   PUT /api/receipts/:expenseId/primary
 * @desc    Set primary receipt for an expense
 * @access  Private
 */
router.put('/:expenseId/primary', receiptController.setPrimaryReceipt);

/**
 * @route   DELETE /api/receipts/:expenseId
 * @desc    Delete a receipt from an expense
 * @access  Private
 */
router.delete('/:expenseId', receiptController.deleteReceipt);

/**
 * @route   POST /api/receipts/cleanup
 * @desc    Clean up orphaned files (admin)
 * @access  Private (Admin only in production)
 */
router.post('/cleanup', receiptController.cleanupOrphanedFiles);

/**
 * @route   GET /api/receipts/stats
 * @desc    Get storage statistics (admin)
 * @access  Private (Admin only in production)
 */
router.get('/stats/storage', receiptController.getStorageStats);

export default router;