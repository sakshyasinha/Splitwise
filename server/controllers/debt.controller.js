import * as debtService from '../services/debt.service.js';

/**
 * Get simplified debt plan for a group
 * @route GET /api/debt/group/:groupId/simplify
 */
export const getGroupDebtSimplification = async (req, res) => {
    try {
        const { groupId } = req.params;
        const result = await debtService.getGroupDebtSimplification(groupId);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Get user's net balance across all groups
 * @route GET /api/debt/user/balance
 */
export const getUserNetBalance = async (req, res) => {
    try {
        const userId = req.user?.id;
        const result = await debtService.getUserNetBalance(userId);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Get payment suggestions for a user
 * @route GET /api/debt/user/suggestions
 */
export const getPaymentSuggestions = async (req, res) => {
    try {
        const userId = req.user?.id;
        const result = await debtService.getPaymentSuggestions(userId);
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

/**
 * Get group balances (raw, not simplified)
 * @route GET /api/debt/group/:groupId/balances
 */
export const getGroupBalances = async (req, res) => {
    try {
        const { groupId } = req.params;
        const balances = await debtService.calculateGroupBalances(groupId);

        // Convert to array format
        const balanceArray = Array.from(balances.entries()).map(([userId, balance]) => ({
            userId,
            balance: Math.round(balance * 100) / 100,
            status: balance > 0 ? 'creditor' : 'debtor'
        }));

        res.json({
            groupId,
            balances: balanceArray,
            totalUsers: balanceArray.length
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

export default {
    getGroupDebtSimplification,
    getUserNetBalance,
    getPaymentSuggestions,
    getGroupBalances
};
