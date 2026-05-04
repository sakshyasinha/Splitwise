import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  sendNudgeEmail,
  testEmailConfiguration,
  getEmailStatus,
  sendTestEmail
} from '../controllers/email.controller.js';

const router = express.Router();

// All email routes require authentication
router.use(protect);

/**
 * @route   POST /api/email/nudge
 * @desc    Send a nudge email to remind someone about a debt
 * @access  Private
 */
router.post('/nudge', sendNudgeEmail);

/**
 * @route   GET /api/email/test
 * @desc    Test email configuration
 * @access  Private
 */
router.get('/test', testEmailConfiguration);

/**
 * @route   GET /api/email/status
 * @desc    Get email configuration status
 * @access  Private
 */
router.get('/status', getEmailStatus);

/**
 * @route   POST /api/email/test-send
 * @desc    Send a test email (for development/testing)
 * @access  Private
 */
router.post('/test-send', sendTestEmail);

export default router;