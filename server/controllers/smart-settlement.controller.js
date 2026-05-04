import smartSettlementService from '../services/smart-settlement.service.js';
import Expense from '../models/expense.model.js';
import Group from '../models/group.model.js';
import User from '../models/user.model.js';

/**
 * Get smart settlement suggestions for a group
 */
export const getSmartSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Get group and its members
    const group = await Group.findById(groupId).populate('members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Get all expenses for this group
    const expenses = await Expense.find({ group: groupId, isDeleted: false })
      .populate('paidBy', 'name email')
      .populate('participants.userId', 'name email')
      .populate('createdBy', 'name email');

    // Get all users involved
    const users = await User.find({
      $or: [
        { _id: { $in: group.members } },
        { _id: { $in: expenses.flatMap(e => [
          e.paidBy?._id,
          ...(e.participants || []).map(p => p.userId?._id)
        ]).filter(Boolean) } }
      ]
    });

    // Generate settlement suggestions
    const suggestions = smartSettlementService.generateSettlementSuggestions(expenses, users);

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    console.error('Error getting smart settlements:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate settlement suggestions',
      error: error.message
    });
  }
};

/**
 * Get alternative payment suggestions
 */
export const getAlternativePayments = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Get group and its members
    const group = await Group.findById(groupId).populate('members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Get all expenses for this group
    const expenses = await Expense.find({ group: groupId, isDeleted: false });

    // Get all users involved
    const users = await User.find({
      $or: [
        { _id: { $in: group.members } },
        { _id: { $in: expenses.flatMap(e => [
          e.paidBy?._id,
          ...(e.participants || []).map(p => p.userId?._id)
        ]).filter(Boolean) } }
      ]
    });

    // Calculate balances
    const balances = smartSettlementService.calculateNetBalances(expenses, users);

    // Get alternative suggestions
    const alternatives = smartSettlementService.getAlternativePaymentSuggestions(balances, users);

    res.json({
      success: true,
      data: {
        alternatives,
        balances
      }
    });
  } catch (error) {
    console.error('Error getting alternative payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate alternative payment suggestions',
      error: error.message
    });
  }
};

/**
 * Get settlement optimization analysis
 */
export const getSettlementAnalysis = async (req, res) => {
  try {
    const { groupId } = req.params;

    // Get group and its members
    const group = await Group.findById(groupId).populate('members');
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Get all expenses for this group
    const expenses = await Expense.find({ group: groupId, isDeleted: false });

    // Get all users involved
    const users = await User.find({
      $or: [
        { _id: { $in: group.members } },
        { _id: { $in: expenses.flatMap(e => [
          e.paidBy?._id,
          ...(e.participants || []).map(p => p.userId?._id)
        ]).filter(Boolean) } }
      ]
    });

    // Generate comprehensive analysis
    const suggestions = smartSettlementService.generateSettlementSuggestions(expenses, users);
    const alternatives = smartSettlementService.getAlternativePaymentSuggestions(
      suggestions.balances,
      users
    );

    // Calculate additional metrics
    const totalExpenses = expenses.length;
    const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const avgExpenseAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;

    // Get expense breakdown by category
    const categoryBreakdown = {};
    expenses.forEach(expense => {
      const category = expense.category || 'Other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (Number(expense.amount) || 0);
    });

    res.json({
      success: true,
      data: {
        settlements: suggestions.settlements,
        suggestions: suggestions.suggestions,
        alternatives,
        summary: suggestions.summary,
        balances: suggestions.balances,
        metrics: {
          totalExpenses,
          totalAmount,
          avgExpenseAmount,
          categoryBreakdown
        }
      }
    });
  } catch (error) {
    console.error('Error getting settlement analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate settlement analysis',
      error: error.message
    });
  }
};

export default {
  getSmartSettlements,
  getAlternativePayments,
  getSettlementAnalysis
};