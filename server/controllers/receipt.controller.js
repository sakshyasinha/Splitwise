import * as receiptService from '../services/receipt.service.js';
import upload from '../middleware/upload.middleware.js';

/**
 * Upload a single receipt for an expense
 */
export const uploadReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const result = await receiptService.uploadReceipt(
      req.params.expenseId,
      req.user?.id,
      req.file
    );

    res.json(result);
  } catch (error) {
    console.error('Error in uploadReceipt controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Upload multiple receipts for an expense
 */
export const uploadMultipleReceipts = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const result = await receiptService.uploadMultipleReceipts(
      req.params.expenseId,
      req.user?.id,
      req.files
    );

    res.json(result);
  } catch (error) {
    console.error('Error in uploadMultipleReceipts controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Delete a receipt from an expense
 */
export const deleteReceipt = async (req, res) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ message: 'fileUrl is required' });
    }

    const result = await receiptService.deleteReceipt(
      req.params.expenseId,
      req.user?.id,
      fileUrl
    );

    res.json(result);
  } catch (error) {
    console.error('Error in deleteReceipt controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get all receipts for an expense
 */
export const getExpenseReceipts = async (req, res) => {
  try {
    const result = await receiptService.getExpenseReceipts(
      req.params.expenseId,
      req.user?.id
    );

    res.json(result);
  } catch (error) {
    console.error('Error in getExpenseReceipts controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Set primary receipt for an expense
 */
export const setPrimaryReceipt = async (req, res) => {
  try {
    const { fileUrl } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ message: 'fileUrl is required' });
    }

    const result = await receiptService.setPrimaryReceipt(
      req.params.expenseId,
      req.user?.id,
      fileUrl
    );

    res.json(result);
  } catch (error) {
    console.error('Error in setPrimaryReceipt controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Clean up orphaned files (admin endpoint)
 */
export const cleanupOrphanedFiles = async (req, res) => {
  try {
    const result = await receiptService.cleanupOrphanedFiles();
    res.json(result);
  } catch (error) {
    console.error('Error in cleanupOrphanedFiles controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get storage statistics (admin endpoint)
 */
export const getStorageStats = async (req, res) => {
  try {
    const stats = await receiptService.getStorageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error in getStorageStats controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// Export upload middleware for use in routes
export const uploadSingle = upload.single('receipt');
export const uploadMultiple = upload.array('receipts', 10);