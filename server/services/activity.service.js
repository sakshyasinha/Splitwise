import mongoose from 'mongoose';

/**
 * Activity Feed & Notification Service
 * Implements 'Who-Did-What' logging and notification system
 */

// Activity Schema (for in-memory or future database storage)
const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        index: true
    },
    expenseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expense',
        index: true
    },
    type: {
        type: String,
        enum: [
            'expense_created',
            'expense_updated',
            'expense_deleted',
            'expense_settled',
            'payer_added',
            'payer_removed',
            'split_changed',
            'group_created',
            'group_updated',
            'user_added',
            'user_removed',
            'settlement_created',
            'settlement_completed'
        ],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    mentionedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Create indexes for better query performance
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ groupId: 1, createdAt: -1 });
activitySchema.index({ isRead: 1, createdAt: -1 });
activitySchema.index({ type: 1, createdAt: -1 });

// Activity Model (will be created if it doesn't exist)
let Activity;
try {
    Activity = mongoose.model('Activity');
} catch (error) {
    Activity = mongoose.model('Activity', activitySchema);
}

/**
 * Create an activity log entry
 * @param {Object} activityData - Activity data
 * @returns {Promise<Object>} Created activity
 */
export const createActivity = async (activityData) => {
    try {
        const activity = await Activity.create(activityData);

        // Populate related data for immediate use
        await activity.populate('userId', 'name email avatar');
        if (activity.groupId) {
            await activity.populate('groupId', 'name');
        }
        if (activity.expenseId) {
            await activity.populate('expenseId', 'description amount');
        }

        return activity;
    } catch (error) {
        console.error('Error creating activity:', error);
        throw new Error('Failed to create activity log');
    }
};

/**
 * Get activity feed for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options {limit, skip, unreadOnly, type}
 * @returns {Promise<Array>} Array of activities
 */
export const getUserActivityFeed = async (userId, options = {}) => {
    try {
        const {
            limit = 20,
            skip = 0,
            unreadOnly = false,
            type = null,
            groupId = null
        } = options;

        const query = {
            $or: [
                { userId }, // Activities where user is the actor
                { mentionedUsers: userId } // Activities where user is mentioned
            ]
        };

        if (unreadOnly) {
            query.isRead = false;
        }

        if (type) {
            query.type = type;
        }

        if (groupId) {
            query.groupId = groupId;
        }

        const activities = await Activity.find(query)
            .populate('userId', 'name email avatar')
            .populate('groupId', 'name')
            .populate('expenseId', 'description amount')
            .populate('mentionedUsers', 'name email avatar')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        // Get total count for pagination
        const total = await Activity.countDocuments(query);

        return {
            activities,
            total,
            hasMore: skip + activities.length < total
        };
    } catch (error) {
        console.error('Error getting user activity feed:', error);
        throw new Error('Failed to get activity feed');
    }
};

/**
 * Get activity feed for a group
 * @param {string} groupId - Group ID
 * @param {Object} options - Query options {limit, skip}
 * @returns {Promise<Array>} Array of activities
 */
export const getGroupActivityFeed = async (groupId, options = {}) => {
    try {
        const { limit = 20, skip = 0 } = options;

        const activities = await Activity.find({ groupId })
            .populate('userId', 'name email avatar')
            .populate('groupId', 'name')
            .populate('expenseId', 'description amount')
            .populate('mentionedUsers', 'name email avatar')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip);

        const total = await Activity.countDocuments({ groupId });

        return {
            activities,
            total,
            hasMore: skip + activities.length < total
        };
    } catch (error) {
        console.error('Error getting group activity feed:', error);
        throw new Error('Failed to get group activity feed');
    }
};

/**
 * Mark activities as read
 * @param {string} userId - User ID
 * @param {Array<string>} activityIds - Array of activity IDs to mark as read
 * @returns {Promise<Object>} Update result
 */
export const markActivitiesAsRead = async (userId, activityIds) => {
    try {
        const result = await Activity.updateMany(
            {
                _id: { $in: activityIds },
                $or: [
                    { userId },
                    { mentionedUsers: userId }
                ]
            },
            { isRead: true }
        );

        return {
            modifiedCount: result.modifiedCount,
            message: `Marked ${result.modifiedCount} activities as read`
        };
    } catch (error) {
        console.error('Error marking activities as read:', error);
        throw new Error('Failed to mark activities as read');
    }
};

/**
 * Mark all activities as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update result
 */
export const markAllActivitiesAsRead = async (userId) => {
    try {
        const result = await Activity.updateMany(
            {
                $or: [
                    { userId },
                    { mentionedUsers: userId }
                ],
                isRead: false
            },
            { isRead: true }
        );

        return {
            modifiedCount: result.modifiedCount,
            message: `Marked ${result.modifiedCount} activities as read`
        };
    } catch (error) {
        console.error('Error marking all activities as read:', error);
        throw new Error('Failed to mark all activities as read');
    }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of unread notifications
 */
export const getUnreadNotificationCount = async (userId) => {
    try {
        const count = await Activity.countDocuments({
            $or: [
                { userId },
                { mentionedUsers: userId }
            ],
            isRead: false
        });

        return count;
    } catch (error) {
        console.error('Error getting unread notification count:', error);
        throw new Error('Failed to get unread notification count');
    }
};

/**
 * Delete old activities (cleanup job)
 * @param {number} daysToKeep - Number of days to keep activities
 * @returns {Promise<Object>} Deletion result
 */
export const cleanupOldActivities = async (daysToKeep = 90) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await Activity.deleteMany({
            createdAt: { $lt: cutoffDate },
            isRead: true // Only delete read activities
        });

        return {
            deletedCount: result.deletedCount,
            message: `Deleted ${result.deletedCount} old activities`
        };
    } catch (error) {
        console.error('Error cleaning up old activities:', error);
        throw new Error('Failed to cleanup old activities');
    }
};

/**
 * Helper function to create expense-related activities
 * @param {string} type - Activity type
 * @param {Object} expense - Expense object
 * @param {string} userId - User who performed the action
 * @param {Array<string>} mentionedUsers - Array of mentioned user IDs
 * @returns {Promise<Object>} Created activity
 */
export const createExpenseActivity = async (type, expense, userId, mentionedUsers = []) => {
    const activityData = {
        userId,
        groupId: expense.group,
        expenseId: expense._id,
        type,
        mentionedUsers,
        metadata: {
            expenseAmount: expense.amount,
            expenseDescription: expense.description,
            splitType: expense.splitType
        }
    };

    switch (type) {
        case 'expense_created':
            activityData.title = 'New Expense Added';
            activityData.description = `Added expense: ${expense.description} (₹${expense.amount})`;
            activityData.priority = 'normal';
            break;

        case 'expense_updated':
            activityData.title = 'Expense Updated';
            activityData.description = `Updated expense: ${expense.description}`;
            activityData.priority = 'low';
            break;

        case 'expense_deleted':
            activityData.title = 'Expense Deleted';
            activityData.description = `Deleted expense: ${expense.description}`;
            activityData.priority = 'high';
            break;

        case 'expense_settled':
            activityData.title = 'Expense Settled';
            activityData.description = `Settled expense: ${expense.description}`;
            activityData.priority = 'normal';
            break;

        case 'split_changed':
            activityData.title = 'Split Method Changed';
            activityData.description = `Changed split method for: ${expense.description}`;
            activityData.priority = 'normal';
            break;

        default:
            activityData.title = 'Expense Activity';
            activityData.description = `Activity on expense: ${expense.description}`;
    }

    return createActivity(activityData);
};

/**
 * Helper function to create settlement-related activities
 * @param {string} type - Activity type
 * @param {Object} settlement - Settlement object
 * @param {string} userId - User who performed the action
 * @param {Array<string>} mentionedUsers - Array of mentioned user IDs
 * @returns {Promise<Object>} Created activity
 */
export const createSettlementActivity = async (type, settlement, userId, mentionedUsers = []) => {
    const activityData = {
        userId,
        groupId: settlement.groupId,
        expenseId: settlement.expenseId,
        type,
        mentionedUsers,
        metadata: {
            settlementAmount: settlement.amount,
            fromUser: settlement.from,
            toUser: settlement.to
        }
    };

    switch (type) {
        case 'settlement_created':
            activityData.title = 'Payment Initiated';
            activityData.description = `Payment of ₹${settlement.amount} initiated`;
            activityData.priority = 'high';
            break;

        case 'settlement_completed':
            activityData.title = 'Payment Completed';
            activityData.description = `Payment of ₹${settlement.amount} completed`;
            activityData.priority = 'normal';
            break;

        default:
            activityData.title = 'Settlement Activity';
            activityData.description = `Settlement activity: ₹${settlement.amount}`;
    }

    return createActivity(activityData);
};

/**
 * Get activity statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Activity statistics
 */
export const getActivityStatistics = async (userId) => {
    try {
        const [
            totalActivities,
            unreadActivities,
            recentActivities
        ] = await Promise.all([
            Activity.countDocuments({
                $or: [
                    { userId },
                    { mentionedUsers: userId }
                ]
            }),
            Activity.countDocuments({
                $or: [
                    { userId },
                    { mentionedUsers: userId }
                ],
                isRead: false
            }),
            Activity.find({
                $or: [
                    { userId },
                    { mentionedUsers: userId }
                ]
            })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('userId', 'name email avatar')
        ]);

        // Count by type
        const activitiesByType = await Activity.aggregate([
            {
                $match: {
                    $or: [
                        { userId: mongoose.Types.ObjectId(userId) },
                        { mentionedUsers: mongoose.Types.ObjectId(userId) }
                    ]
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        return {
            totalActivities,
            unreadActivities,
            readActivities: totalActivities - unreadActivities,
            recentActivities,
            activitiesByType: activitiesByType.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {})
        };
    } catch (error) {
        console.error('Error getting activity statistics:', error);
        throw new Error('Failed to get activity statistics');
    }
};

export default {
    createActivity,
    getUserActivityFeed,
    getGroupActivityFeed,
    markActivitiesAsRead,
    markAllActivitiesAsRead,
    getUnreadNotificationCount,
    cleanupOldActivities,
    createExpenseActivity,
    createSettlementActivity,
    getActivityStatistics
};
