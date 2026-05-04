import * as analyticsService from '../services/analytics.service.js';

/**
 * Get user analytics
 */
export const getUserAnalytics = async (req, res) => {
  try {
    const { days, startDate, endDate, groupId, category, currency } = req.query;

    const options = {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      groupId: groupId || undefined,
      category: category || undefined,
      currency: currency || undefined
    };

    // If days is specified, calculate startDate
    if (days && !startDate) {
      const daysNum = parseInt(days);
      if (!isNaN(daysNum)) {
        const now = new Date();
        const past = new Date(now.getTime() - daysNum * 24 * 60 * 60 * 1000);
        options.startDate = past.toISOString();
        options.endDate = now.toISOString();
      }
    }

    const analytics = await analyticsService.getUserAnalytics(req.user?.id, options);
    res.json(analytics);
  } catch (error) {
    console.error('Error in getUserAnalytics controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get group analytics
 */
export const getGroupAnalytics = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    const options = {
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    const analytics = await analyticsService.getGroupAnalytics(groupId, options);
    res.json(analytics);
  } catch (error) {
    console.error('Error in getGroupAnalytics controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

/**
 * Get system analytics (admin)
 */
export const getSystemAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const options = {
      startDate: startDate || undefined,
      endDate: endDate || undefined
    };

    const analytics = await analyticsService.getSystemAnalytics(options);
    res.json(analytics);
  } catch (error) {
    console.error('Error in getSystemAnalytics controller:', error);
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};