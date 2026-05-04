import express from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * @route   GET /api/analytics/user
 * @desc    Get analytics for current user
 * @access  Private
 */
router.get('/user', analyticsController.getUserAnalytics);

/**
 * @route   GET /api/analytics/group/:groupId
 * @desc    Get analytics for a specific group
 * @access  Private
 */
router.get('/group/:groupId', analyticsController.getGroupAnalytics);

/**
 * @route   GET /api/analytics/system
 * @desc    Get system-wide analytics (admin)
 * @access  Private (Admin only in production)
 */
router.get('/system', analyticsController.getSystemAnalytics);

export default router;