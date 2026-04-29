import express from 'express';
import {
    getUserActivityFeed,
    getGroupActivityFeed,
    markActivitiesAsRead,
    markAllActivitiesAsRead,
    getUnreadNotificationCount,
    getActivityStatistics,
    createActivity
} from '../controllers/activity.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All activity routes require authentication
router.use(protect);

// Activity feed operations
router.get('/feed', getUserActivityFeed);
router.get('/group/:groupId', getGroupActivityFeed);

// Notification operations
router.get('/unread-count', getUnreadNotificationCount);
router.put('/read', markActivitiesAsRead);
router.put('/read-all', markAllActivitiesAsRead);

// Statistics
router.get('/statistics', getActivityStatistics);

// Manual activity creation
router.post('/', createActivity);

export default router;
