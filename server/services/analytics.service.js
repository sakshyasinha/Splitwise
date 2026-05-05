import Expense from '../models/expense.model.js';
import Group from '../models/group.model.js';
import User from '../models/user.model.js';
import RecurringExpense from '../models/recurring-expense.model.js';

/**
 * Get comprehensive analytics for a user
 */
export const getUserAnalytics = async (userId, options = {}) => {
  try {
    const {
      startDate,
      endDate,
      groupId,
      category,
      currency = 'INR'
    } = options;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Build additional filters
    const additionalFilters = {};
    if (groupId) additionalFilters.group = groupId;
    if (category) additionalFilters.category = category;

    // Find all expenses where user is involved
    const expenses = await Expense.find({
      $or: [
        { paidBy: userId },
        { createdBy: userId },
        { 'payers.userId': userId },
        { "participants.userId": userId }
      ],
      isDeleted: false,
      ...dateFilter,
      ...additionalFilters
    })
      .populate('group', 'name type')
      .populate('paidBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('participants.userId', 'name email')
      .sort({ date: -1 });

    // Calculate analytics
    const analytics = {
      overview: calculateOverview(expenses, userId),
      spending: calculateSpendingAnalytics(expenses, userId),
      categories: calculateCategoryAnalytics(expenses, userId),
      groups: calculateGroupAnalytics(expenses, userId),
      trends: calculateTrendAnalytics(expenses, userId),
      relationships: calculateRelationshipAnalytics(expenses, userId),
      timeDistribution: calculateTimeDistribution(expenses, userId)
    };

    return analytics;
  } catch (error) {
    console.error('Error in getUserAnalytics:', error);
    throw error;
  }
};

/**
 * Get overview statistics
 */
const calculateOverview = (expenses, userId) => {
  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

  // Calculate personal vs shared
  let personalTotal = 0;
  let sharedTotal = 0;
  let personalCount = 0;
  let sharedCount = 0;

  expenses.forEach(exp => {
    const participants = exp.participants || [];
    const isPersonal = participants.length === 1 &&
      String(participants[0].userId?._id || participants[0].userId) === String(userId);

    // Get user's share of this expense
    const participant = participants?.find(
      p => String(p.userId?._id || p.userId) === String(userId)
    );

    // Use user's share amount for shared expenses, full amount for personal expenses
    const userShare = participant?.shareAmount || participant?.amount || 0;
    const amount = Number(userShare || exp.amount || 0);

    if (isPersonal) {
      personalTotal += amount;
      personalCount++;
    } else {
      sharedTotal += amount;
      sharedCount++;
    }
  });

  // Calculate balance
  let totalOwed = 0;
  let totalOwe = 0;

  expenses.forEach(exp => {
    const participant = exp.participants?.find(
      p => String(p.userId?._id || p.userId) === String(userId)
    );

    if (participant) {
      const balance = Number(participant.balance || 0);
      if (balance > 0) {
        totalOwed += balance; // Others owe me
      } else if (balance < 0) {
        totalOwe += Math.abs(balance); // I owe others
      }
    }
  });

  return {
    totalExpenses,
    totalAmount,
    personalTotal,
    sharedTotal,
    personalCount,
    sharedCount,
    totalOwed,
    totalOwe,
    netBalance: totalOwed - totalOwe
  };
};

/**
 * Calculate spending analytics
 */
const calculateSpendingAnalytics = (expenses, userId) => {
  const spendingByMonth = {};
  const spendingByDay = {};
  const averageSpending = {};

  expenses.forEach(exp => {
    // Get user's share of this expense
    const participant = exp.participants?.find(
      p => String(p.userId?._id || p.userId) === String(userId)
    );

    // Use user's share amount if available, otherwise use full amount for personal expenses
    const userShare = participant?.shareAmount || participant?.amount || 0;
    const amount = Number(userShare || exp.amount || 0);
    const date = new Date(exp.date);

    // By month
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    spendingByMonth[monthKey] = (spendingByMonth[monthKey] || 0) + amount;

    // By day of week
    const dayKey = date.getDay(); // 0-6 (Sunday-Saturday)
    spendingByDay[dayKey] = (spendingByDay[dayKey] || 0) + amount;
  });

  // Calculate averages
  const months = Object.keys(spendingByMonth);
  if (months.length > 0) {
    averageSpending.monthly = Object.values(spendingByMonth).reduce((a, b) => a + b, 0) / months.length;
  }

  const days = Object.keys(spendingByDay);
  if (days.length > 0) {
    averageSpending.daily = Object.values(spendingByDay).reduce((a, b) => a + b, 0) / days.length;
  }

  // Find highest and lowest spending
  const monthEntries = Object.entries(spendingByMonth);
  const highestMonth = monthEntries.length > 0
    ? monthEntries.reduce((a, b) => a[1] > b[1] ? a : b)
    : null;
  const lowestMonth = monthEntries.length > 0
    ? monthEntries.reduce((a, b) => a[1] < b[1] ? a : b)
    : null;

  return {
    byMonth: spendingByMonth,
    byDay: spendingByDay,
    average: averageSpending,
    highestMonth: highestMonth ? { month: highestMonth[0], amount: highestMonth[1] } : null,
    lowestMonth: lowestMonth ? { month: lowestMonth[0], amount: lowestMonth[1] } : null
  };
};

/**
 * Calculate category analytics
 */
const calculateCategoryAnalytics = (expenses, userId) => {
  const categoryTotals = {};
  const categoryCounts = {};

  expenses.forEach(exp => {
    // Get user's share of this expense
    const participant = exp.participants?.find(
      p => String(p.userId?._id || p.userId) === String(userId)
    );

    // Use user's share amount if available, otherwise use full amount for personal expenses
    const userShare = participant?.shareAmount || participant?.amount || 0;
    const amount = Number(userShare || exp.amount || 0);
    const category = exp.category || 'Other';

    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // Convert to array and sort
  const categories = Object.keys(categoryTotals).map(category => ({
    category,
    total: categoryTotals[category],
    count: categoryCounts[category],
    average: categoryCounts[category] > 0 ? categoryTotals[category] / categoryCounts[category] : 0
  })).sort((a, b) => b.total - a.total);

  // Calculate percentages
  const totalAmount = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
  categories.forEach(cat => {
    cat.percentage = totalAmount > 0 ? (cat.total / totalAmount) * 100 : 0;
  });

  return {
    categories,
    total: totalAmount,
    topCategory: categories.length > 0 ? categories[0] : null
  };
};

/**
 * Calculate group analytics
 */
const calculateGroupAnalytics = (expenses, userId) => {
  const groupTotals = {};
  const groupCounts = {};

  expenses.forEach(exp => {
    const group = exp.group;
    const groupId = group?._id || 'ungrouped';
    const groupName = group?.name || 'Quick Expenses';
    const groupType = group?.type || 'other';

    // Get user's share of this expense
    const participant = exp.participants?.find(
      p => String(p.userId?._id || p.userId) === String(userId)
    );

    // Use user's share amount if available, otherwise use full amount for personal expenses
    const userShare = participant?.shareAmount || participant?.amount || 0;
    const amount = Number(userShare || exp.amount || 0);

    if (!groupTotals[groupId]) {
      groupTotals[groupId] = {
        id: groupId,
        name: groupName,
        type: groupType,
        total: 0,
        count: 0
      };
    }

    groupTotals[groupId].total += amount;
    groupTotals[groupId].count += 1;
  });

  // Convert to array and sort
  const groups = Object.values(groupTotals).sort((a, b) => b.total - a.total);

  return {
    groups,
    totalGroups: groups.length,
    topGroup: groups.length > 0 ? groups[0] : null
  };
};

/**
 * Calculate trend analytics
 */
const calculateTrendAnalytics = (expenses, userId) => {
  if (expenses.length === 0) {
    return {
      trend: 'stable',
      change: 0,
      changePercent: 0,
      recentTrend: []
    };
  }

  // Calculate spending by month (same as in calculateSpendingAnalytics)
  const spendingByMonth = {};
  expenses.forEach(exp => {
    const amount = Number(exp.amount || 0);
    const date = new Date(exp.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    spendingByMonth[monthKey] = (spendingByMonth[monthKey] || 0) + amount;
  });

  // Sort months chronologically
  const sortedMonths = Object.keys(spendingByMonth).sort();

  let trend = 'stable';
  let change = 0;
  let changePercent = 0;

  // Calculate trend by comparing most recent month with previous month
  if (sortedMonths.length >= 2) {
    const recentMonth = sortedMonths[sortedMonths.length - 1];
    const previousMonth = sortedMonths[sortedMonths.length - 2];
    const recentTotal = spendingByMonth[recentMonth];
    const previousTotal = spendingByMonth[previousMonth];

    change = recentTotal - previousTotal;
    changePercent = previousTotal > 0 ? (change / previousTotal) * 100 : 0;

    // Determine trend based on percentage change
    if (changePercent > 1) {
      trend = 'increasing';
    } else if (changePercent < -1) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }
  }

  // Build recent trend array (last 6 months)
  const recentTrend = sortedMonths.slice(-6).map(month => ({
    month,
    amount: spendingByMonth[month]
  }));

  return {
    trend,
    change,
    changePercent,
    recentTrend
  };
};

/**
 * Calculate relationship analytics
 */
const calculateRelationshipAnalytics = (expenses, userId) => {
  const relationships = new Map();

  expenses.forEach(exp => {
    const participants = exp.participants || [];

    participants.forEach(participant => {
      const participantId = String(participant.userId?._id || participant.userId);
      if (participantId === String(userId)) return; // Skip self

      const participantName = participant.userId?.name || participant.userId?.email || 'Unknown';
      const balance = Number(participant.balance || 0);

      if (!relationships.has(participantId)) {
        relationships.set(participantId, {
          id: participantId,
          name: participantName,
          totalOwed: 0,    // They owe me
          totalOwe: 0,      // I owe them
          expenseCount: 0,
          lastExpense: null
        });
      }

      const rel = relationships.get(participantId);
      rel.expenseCount += 1;

      if (balance < 0) {
        rel.totalOwed += Math.abs(balance); // They owe me (their negative balance means they owe money)
      } else if (balance > 0) {
        rel.totalOwe += balance; // I owe them (their positive balance means they are owed money)
      }

      // Track last expense
      if (!rel.lastExpense || new Date(exp.date) > new Date(rel.lastExpense)) {
        rel.lastExpense = exp.date;
      }
    });
  });

  // Convert to array and sort
  const relationshipArray = Array.from(relationships.values())
    .map(rel => ({
      ...rel,
      netBalance: rel.totalOwed - rel.totalOwe
    }))
    .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance));

  // Calculate totals
  const totalOwedToMe = relationshipArray.reduce((sum, rel) => sum + rel.totalOwed, 0);
  const totalIOwe = relationshipArray.reduce((sum, rel) => sum + rel.totalOwe, 0);

  return {
    relationships: relationshipArray,
    totalRelationships: relationshipArray.length,
    totalOwedToMe,
    totalIOwe,
    netBalance: totalOwedToMe - totalIOwe
  };
};

/**
 * Calculate time distribution analytics
 */
const calculateTimeDistribution = (expenses, userId) => {
  const byHour = {};
  const byDayOfWeek = {};
  const byMonth = {};

  expenses.forEach(exp => {
    // Get user's share of this expense
    const participant = exp.participants?.find(
      p => String(p.userId?._id || p.userId) === String(userId)
    );

    // Use user's share amount if available, otherwise use full amount for personal expenses
    const userShare = participant?.shareAmount || participant?.amount || 0;
    const amount = Number(userShare || exp.amount || 0);
    const date = new Date(exp.date);

    // By hour
    const hour = date.getHours();
    byHour[hour] = (byHour[hour] || 0) + amount;

    // By day of week
    const dayOfWeek = date.getDay();
    byDayOfWeek[dayOfWeek] = (byDayOfWeek[dayOfWeek] || 0) + amount;

    // By month
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + amount;
  });

  // Find peak times
  const hourEntries = Object.entries(byHour);
  const peakHour = hourEntries.length > 0
    ? hourEntries.reduce((a, b) => a[1] > b[1] ? a : b)
    : null;

  const dayEntries = Object.entries(byDayOfWeek);
  const peakDay = dayEntries.length > 0
    ? dayEntries.reduce((a, b) => a[1] > b[1] ? a : b)
    : null;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    byHour,
    byDayOfWeek,
    byMonth,
    peakHour: peakHour ? { hour: parseInt(peakHour[0]), amount: peakHour[1] } : null,
    peakDay: peakDay ? { day: dayNames[parseInt(peakDay[0])], amount: peakDay[1] } : null
  };
};

/**
 * Get group analytics
 */
export const getGroupAnalytics = async (groupId, options = {}) => {
  try {
    const {
      startDate,
      endDate
    } = options;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Find all expenses for the group
    const expenses = await Expense.find({
      group: groupId,
      isDeleted: false,
      ...dateFilter
    })
      .populate('paidBy', 'name email')
      .populate('createdBy', 'name email')
      .populate('participants.userId', 'name email')
      .sort({ date: -1 });

    // Get group details
    const group = await Group.findById(groupId).populate('members', 'name email');

    if (!group) {
      const error = new Error('Group not found');
      error.statusCode = 404;
      throw error;
    }

    // Calculate group-specific analytics
    const memberAnalytics = {};
    const categoryTotals = {};

    expenses.forEach(exp => {
      const amount = Number(exp.amount || 0);
      const category = exp.category || 'Other';

      // Track by category
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;

      // Track by member
      const participants = exp.participants || [];
      participants.forEach(participant => {
        const memberId = String(participant.userId?._id || participant.userId);
        const memberName = participant.userId?.name || participant.userId?.email || 'Unknown';

        if (!memberAnalytics[memberId]) {
          memberAnalytics[memberId] = {
            id: memberId,
            name: memberName,
            totalPaid: 0,
            totalOwed: 0,
            totalShare: 0,
            expenseCount: 0,
            balance: 0
          };
        }

        const member = memberAnalytics[memberId];
        member.expenseCount += 1;
        member.totalShare += Number(participant.shareAmount || participant.amount || 0);

        // Check if this member paid
        const isPayer = String(participant.userId?._id || participant.userId) === String(exp.paidBy);
        if (isPayer) {
          member.totalPaid += amount;
        }

        // Calculate balance
        member.balance = member.totalPaid - member.totalShare;
      });
    });

    // Convert to array
    const members = Object.values(memberAnalytics).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    // Calculate totals
    const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
    const totalExpenses = expenses.length;

    return {
      group: {
        id: group._id,
        name: group.name,
        type: group.type,
        memberCount: group.members.length
      },
      overview: {
        totalAmount,
        totalExpenses,
        averageExpense: totalExpenses > 0 ? totalAmount / totalExpenses : 0
      },
      members,
      categories: Object.entries(categoryTotals).map(([category, total]) => ({
        category,
        total,
        percentage: totalAmount > 0 ? (total / totalAmount) * 100 : 0
      })).sort((a, b) => b.total - a.total)
    };
  } catch (error) {
    console.error('Error in getGroupAnalytics:', error);
    throw error;
  }
};

/**
 * Get system-wide analytics (admin)
 */
export const getSystemAnalytics = async (options = {}) => {
  try {
    const {
      startDate,
      endDate
    } = options;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Get counts
    const totalUsers = await User.countDocuments();
    const totalGroups = await Group.countDocuments();
    const totalExpenses = await Expense.countDocuments({ isDeleted: false, ...dateFilter });
    const totalRecurringExpenses = await RecurringExpense.countDocuments({ isDeleted: false, isActive: true });

    // Get totals
    const expenses = await Expense.find({ isDeleted: false, ...dateFilter });
    const totalAmount = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);

    // Get active users (users with expenses in date range)
    const activeUserIds = new Set();
    expenses.forEach(exp => {
      if (exp.paidBy) activeUserIds.add(String(exp.paidBy));
      if (exp.createdBy) activeUserIds.add(String(exp.createdBy));
      exp.participants?.forEach(p => activeUserIds.add(String(p.userId)));
    });

    // Get category distribution
    const categoryTotals = {};
    expenses.forEach(exp => {
      const category = exp.category || 'Other';
      const amount = Number(exp.amount || 0);
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });

    return {
      users: {
        total: totalUsers,
        active: activeUserIds.size
      },
      groups: {
        total: totalGroups
      },
      expenses: {
        total: totalExpenses,
        totalAmount,
        averageAmount: totalExpenses > 0 ? totalAmount / totalExpenses : 0
      },
      recurringExpenses: {
        total: totalRecurringExpenses
      },
      categories: Object.entries(categoryTotals).map(([category, total]) => ({
        category,
        total,
        percentage: totalAmount > 0 ? (total / totalAmount) * 100 : 0
      })).sort((a, b) => b.total - a.total)
    };
  } catch (error) {
    console.error('Error in getSystemAnalytics:', error);
    throw error;
  }
};