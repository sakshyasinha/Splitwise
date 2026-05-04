import Expense from '../models/expense.model.js';
import { deleteFile, getFileUrl, getFilePath, fileExists } from '../middleware/upload.middleware.js';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Upload receipt for an expense
 */
export const uploadReceipt = async (expenseId, userId, file) => {
  try {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(expense.paidBy) !== String(userId) && String(expense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can upload receipts');
      error.statusCode = 403;
      throw error;
    }

    // Initialize images array if it doesn't exist
    if (!expense.images) {
      expense.images = [];
    }

    // Add file to images array
    const fileUrl = getFileUrl(file.filename);
    expense.images.push(fileUrl);

    // Set receiptUrl to the first image if not set
    if (!expense.receiptUrl && expense.images.length > 0) {
      expense.receiptUrl = expense.images[0];
    }

    await expense.save();

    // Add audit log
    if (expense.addAuditLog) {
      await expense.addAuditLog('updated', userId, {
        images: expense.images,
        receiptUrl: expense.receiptUrl
      }, {
        images: expense.images.filter(img => img !== fileUrl),
        receiptUrl: expense.receiptUrl === fileUrl ? null : expense.receiptUrl
      }, 'Receipt uploaded');
    }

    return {
      success: true,
      fileUrl,
      images: expense.images,
      receiptUrl: expense.receiptUrl
    };
  } catch (error) {
    // Clean up uploaded file if there was an error
    if (file && file.filename) {
      const filePath = getFilePath(file.filename);
      deleteFile(filePath);
    }
    throw error;
  }
};

/**
 * Upload multiple receipts for an expense
 */
export const uploadMultipleReceipts = async (expenseId, userId, files) => {
  try {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(expense.paidBy) !== String(userId) && String(expense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can upload receipts');
      error.statusCode = 403;
      throw error;
    }

    // Initialize images array if it doesn't exist
    if (!expense.images) {
      expense.images = [];
    }

    const previousImages = [...expense.images];

    // Add files to images array
    const fileUrls = files.map(file => getFileUrl(file.filename));
    expense.images.push(...fileUrls);

    // Set receiptUrl to the first image if not set
    if (!expense.receiptUrl && expense.images.length > 0) {
      expense.receiptUrl = expense.images[0];
    }

    await expense.save();

    // Add audit log
    if (expense.addAuditLog) {
      await expense.addAuditLog('updated', userId, {
        images: expense.images,
        receiptUrl: expense.receiptUrl
      }, {
        images: previousImages,
        receiptUrl: expense.receiptUrl === fileUrls[0] ? null : expense.receiptUrl
      }, 'Multiple receipts uploaded');
    }

    return {
      success: true,
      fileUrls,
      images: expense.images,
      receiptUrl: expense.receiptUrl
    };
  } catch (error) {
    // Clean up uploaded files if there was an error
    if (files && files.length > 0) {
      files.forEach(file => {
        if (file.filename) {
          const filePath = getFilePath(file.filename);
          deleteFile(filePath);
        }
      });
    }
    throw error;
  }
};

/**
 * Delete a receipt from an expense
 */
export const deleteReceipt = async (expenseId, userId, fileUrl) => {
  try {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(expense.paidBy) !== String(userId) && String(expense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can delete receipts');
      error.statusCode = 403;
      throw error;
    }

    if (!expense.images || !expense.images.includes(fileUrl)) {
      const error = new Error('Receipt not found');
      error.statusCode = 404;
      throw error;
    }

    // Remove file from array
    const previousImages = [...expense.images];
    expense.images = expense.images.filter(img => img !== fileUrl);

    // Update receiptUrl if needed
    if (expense.receiptUrl === fileUrl) {
      expense.receiptUrl = expense.images.length > 0 ? expense.images[0] : null;
    }

    await expense.save();

    // Delete physical file
    const filename = path.basename(fileUrl);
    const filePath = getFilePath(filename);
    deleteFile(filePath);

    // Add audit log
    if (expense.addAuditLog) {
      await expense.addAuditLog('updated', userId, {
        images: expense.images,
        receiptUrl: expense.receiptUrl
      }, {
        images: previousImages,
        receiptUrl: fileUrl
      }, 'Receipt deleted');
    }

    return {
      success: true,
      images: expense.images,
      receiptUrl: expense.receiptUrl
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get all receipts for an expense
 */
export const getExpenseReceipts = async (expenseId, userId) => {
  try {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    const hasAccess =
      String(expense.paidBy) === String(userId) ||
      String(expense.createdBy) === String(userId) ||
      expense.participants?.some(p => String(p.userId) === String(userId));

    if (!hasAccess) {
      const error = new Error('You do not have access to this expense');
      error.statusCode = 403;
      throw error;
    }

    return {
      images: expense.images || [],
      receiptUrl: expense.receiptUrl
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Set primary receipt for an expense
 */
export const setPrimaryReceipt = async (expenseId, userId, fileUrl) => {
  try {
    const expense = await Expense.findById(expenseId);

    if (!expense) {
      const error = new Error('Expense not found');
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    if (String(expense.paidBy) !== String(userId) && String(expense.createdBy) !== String(userId)) {
      const error = new Error('Only the creator can set primary receipt');
      error.statusCode = 403;
      throw error;
    }

    if (!expense.images || !expense.images.includes(fileUrl)) {
      const error = new Error('Receipt not found');
      error.statusCode = 404;
      throw error;
    }

    const previousReceiptUrl = expense.receiptUrl;
    expense.receiptUrl = fileUrl;

    await expense.save();

    // Add audit log
    if (expense.addAuditLog) {
      await expense.addAuditLog('updated', userId, {
        receiptUrl: fileUrl
      }, {
        receiptUrl: previousReceiptUrl
      }, 'Primary receipt set');
    }

    return {
      success: true,
      receiptUrl: expense.receiptUrl
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Clean up orphaned files (files not referenced by any expense)
 */
export const cleanupOrphanedFiles = async () => {
  try {
    const receiptsDir = path.join(__dirname, '../../uploads/receipts');

    if (!fs.existsSync(receiptsDir)) {
      return { cleaned: 0, errors: [] };
    }

    // Get all files in the receipts directory
    const files = fs.readdirSync(receiptsDir);

    // Get all referenced files from expenses
    const expenses = await Expense.find({ images: { $exists: true, $ne: [] } });
    const referencedFiles = new Set();
    expenses.forEach(expense => {
      if (expense.images) {
        expense.images.forEach(img => {
          const filename = path.basename(img);
          referencedFiles.add(filename);
        });
      }
    });

    // Find and delete orphaned files
    let cleaned = 0;
    const errors = [];

    for (const file of files) {
      if (!referencedFiles.has(file)) {
        const filePath = path.join(receiptsDir, file);
        try {
          fs.unlinkSync(filePath);
          cleaned++;
        } catch (error) {
          errors.push({
            file,
            error: error.message
          });
        }
      }
    }

    return { cleaned, errors };
  } catch (error) {
    console.error('Error in cleanupOrphanedFiles:', error);
    throw error;
  }
};

/**
 * Get storage statistics
 */
export const getStorageStats = async () => {
  try {
    const receiptsDir = path.join(__dirname, '../../uploads/receipts');

    if (!fs.existsSync(receiptsDir)) {
      return {
        totalFiles: 0,
        totalSize: 0,
        averageSize: 0,
        fileTypes: {}
      };
    }

    const files = fs.readdirSync(receiptsDir);
    let totalSize = 0;
    const fileTypes = {};

    for (const file of files) {
      const filePath = path.join(receiptsDir, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;

      const ext = path.extname(file).toLowerCase();
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    }

    return {
      totalFiles: files.length,
      totalSize,
      averageSize: files.length > 0 ? totalSize / files.length : 0,
      fileTypes
    };
  } catch (error) {
    console.error('Error in getStorageStats:', error);
    throw error;
  }
};