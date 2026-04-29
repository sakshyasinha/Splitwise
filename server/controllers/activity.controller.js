import * as activityService from '../services/activity.service.js';

/**
 * Get user's activity feed
 * @route GET /api/activity/feed
 */
export const getUserActivityFeed = async (req, res) => {
    try {
        const userId = req.user?.id;
        const options = {
            limit: parseInt(req.query.limit) || 20,
            skip: parseInt(req.query.skip) || 0,
            unreadOnly: req.query.unreadOnly === 'true',
            type: req.query.type || null,
            groupId: req.query.groupId || null
        };

        const result = await activityService.getUserActivityFeed(userId, options);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Get group's activity feed
 * @route GET /api/activity/group/:groupId
 */
export const getGroupActivityFeed = async (req, res) => {
    try {
        const { groupId } = req.params;
        const options = {
            limit: parseInt(req.query.limit) || 20,
            skip: parseInt(req.query.skip) || 0
        };

        const result = await activityService.getGroupActivityFeed(groupId, options);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Mark activities as read
 * @route PUT /api/activity/read
 */
export const markActivitiesAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        const { activityIds } = req.body;

        if (!Array.isArray(activityIds) || activityIds.length === 0) {
            const error = new Error('activityIds array is required');
            error.statusCode = 400;
            throw error;
        }

        const result = await activityService.markActivitiesAsRead(userId, activityIds);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Mark all activities as read for user
 * @route PUT /api/activity/read-all
 */
export const markAllActivitiesAsRead = async (req, res) => {
    try {
        const userId = req.user?.id;
        const result = await activityService.markAllActivitiesAsRead(userId);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Get unread notification count
 * @route GET /api/activity/unread-count
 */
export const getUnreadNotificationCount = async (req, res) => {
    try {
        const userId = req.user?.id;
        const count = await activityService.getUnreadNotificationCount(userId);
        res.json({ count });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Get activity statistics
 * @route GET /api/activity/statistics
 */
export const getActivityStatistics = async (req, res) => {
    try {
        const userId = req.user?.id;
        const statistics = await activityService.getActivityStatistics(userId);
        res.json(statistics);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Create manual activity entry
 * @route POST /api/activity
 */
export const createActivity = async (req, res) => {
    try {
        const userId = req.user?.id;
        const activityData = {
            ...req.body,
            userId // Override userId to ensure it's the authenticated user
        };

        const activity = await activityService.createActivity(activityData);
        res.status(201).json(activity);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export default {
    getUserActivityFeed,
    getGroupActivityFeed,
    markActivitiesAsRead,
    markAllActivitiesAsRead,
    getUnreadNotificationCount,
    getActivityStatistics,
    createActivity
};
