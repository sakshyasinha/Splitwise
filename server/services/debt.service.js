import Expense from '../models/expense.model.js';
import mongoose from 'mongoose';

/**
 * Debt Simplification Service
 * Implements graph algorithm to minimize total payments in a group
 */

/**
 * Calculate net balances for all users in a group
 * @param {string} groupId - Group ID
 * @returns {Map<string, number>} Map of userId -> net balance (positive = owed to, negative = owes)
 */
export const calculateGroupBalances = async (groupId) => {
    // Get all expenses for the group
    const expenses = await Expense.find({
        group: groupId,
        isDeleted: false
    }).populate('payers.userId', '_id')
      .populate('participants.userId', '_id');

    // Initialize balance map
    const balances = new Map();

    // Process each expense
    expenses.forEach(expense => {
        const expenseAmount = Number(expense.amount) || 0;

        // Process payers (people who paid)
        if (expense.payers && expense.payers.length > 0) {
            expense.payers.forEach(payer => {
                const userId = String(payer.userId);
                const paidAmount = Number(payer.amount) || 0;
                balances.set(userId, (balances.get(userId) || 0) + paidAmount);
            });
        } else if (expense.paidBy) {
            // Legacy support for single payer
            const userId = String(expense.paidBy);
            balances.set(userId, (balances.get(userId) || 0) + expenseAmount);
        }

        // Process participants (people who owe)
        if (expense.participants && expense.participants.length > 0) {
            expense.participants.forEach(participant => {
                const userId = String(participant.userId);
                const owesAmount = Number(participant.shareAmount || participant.amount) || 0;
                balances.set(userId, (balances.get(userId) || 0) - owesAmount);
            });
        }
    });

    // Filter out zero balances
    const filteredBalances = new Map();
    balances.forEach((balance, userId) => {
        if (Math.abs(balance) > 0.01) { // Only keep significant balances
            filteredBalances.set(userId, balance);
        }
    });

    return filteredBalances;
};

/**
 * Simplify debts using graph algorithm
 * Minimizes total number of transactions while settling all debts
 * @param {Map<string, number>} balances - Map of userId -> net balance
 * @returns {Array} Array of simplified payment instructions {from, to, amount}
 */
export const simplifyDebts = (balances) => {
    const debtors = [];
    const creditors = [];

    // Separate into debtors (negative balance) and creditors (positive balance)
    balances.forEach((balance, userId) => {
        if (balance < -0.01) {
            debtors.push({ userId, amount: -balance }); // Store as positive amount
        } else if (balance > 0.01) {
            creditors.push({ userId, amount: balance });
        }
    });

    // Sort by amount (descending) for optimal matching
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const simplifiedPayments = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    // Match debtors with creditors
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        // Calculate the payment amount
        const paymentAmount = Math.min(debtor.amount, creditor.amount);

        if (paymentAmount > 0.01) { // Only create payment if significant
            simplifiedPayments.push({
                from: debtor.userId,
                to: creditor.userId,
                amount: Math.round(paymentAmount * 100) / 100 // Round to 2 decimal places
            });
        }

        // Update remaining amounts
        debtor.amount -= paymentAmount;
        creditor.amount -= paymentAmount;

        // Move to next debtor if current debtor is settled
        if (debtor.amount < 0.01) {
            i++;
        }

        // Move to next creditor if current creditor is settled
        if (creditor.amount < 0.01) {
            j++;
        }
    }

    return simplifiedPayments;
};

/**
 * Get simplified payment plan for a group
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Object containing balances and simplified payments
 */
export const getGroupDebtSimplification = async (groupId) => {
    try {
        // Calculate current balances
        const balances = await calculateGroupBalances(groupId);

        // Simplify debts
        const simplifiedPayments = simplifyDebts(balances);

        // Calculate statistics
        const totalOwed = Array.from(balances.values())
            .filter(balance => balance < 0)
            .reduce((sum, balance) => sum + Math.abs(balance), 0);

        const totalToReceive = Array.from(balances.values())
            .filter(balance => balance > 0)
            .reduce((sum, balance) => sum + balance, 0);

        const originalTransactions = balances.size; // Number of people with non-zero balance
        const simplifiedTransactions = simplifiedPayments.length;

        return {
            groupId,
            balances: Array.from(balances.entries()).map(([userId, balance]) => ({
                userId,
                balance: Math.round(balance * 100) / 100,
                status: balance > 0 ? 'creditor' : 'debtor'
            })),
            simplifiedPayments,
            statistics: {
                totalOwed: Math.round(totalOwed * 100) / 100,
                totalToReceive: Math.round(totalToReceive * 100) / 100,
                originalTransactions,
                simplifiedTransactions,
                transactionsReduced: originalTransactions - simplifiedTransactions,
                reductionPercentage: originalTransactions > 0
                    ? Math.round(((originalTransactions - simplifiedTransactions) / originalTransactions) * 100)
                    : 0
            }
        };
    } catch (error) {
        console.error('Error calculating debt simplification:', error);
        throw new Error('Failed to calculate debt simplification');
    }
};

/**
 * Get user's net balance across all groups
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Object containing total balance and breakdown by group
 */
export const getUserNetBalance = async (userId) => {
    try {
        // Get all expenses where user is involved
        const expenses = await Expense.find({
            $or: [
                { 'payers.userId': userId },
                { paidBy: userId },
                { 'participants.userId': userId }
            ],
            isDeleted: false
        }).populate('group', '_id name');

        // Calculate balance by group
        const groupBalances = new Map();

        expenses.forEach(expense => {
            const groupId = String(expense.group?._id);
            const groupName = String(expense.group?.name || '');
            const expenseAmount = Number(expense.amount) || 0;

            if (!groupBalances.has(groupId)) {
                groupBalances.set(groupId, {
                    groupId,
                    groupName,
                    balance: 0
                });
            }

            const groupBalance = groupBalances.get(groupId);

            // Check if user paid
            let userPaid = 0;
            if (expense.payers) {
                const userPayer = expense.payers.find(p => String(p.userId) === userId);
                if (userPayer) {
                    userPaid = Number(userPayer.amount) || 0;
                }
            } else if (String(expense.paidBy) === userId) {
                userPaid = expenseAmount;
            }

            // Check if user owes
            let userOwes = 0;
            if (expense.participants) {
                const userParticipant = expense.participants.find(p => String(p.userId) === userId);
                if (userParticipant) {
                    userOwes = Number(userParticipant.shareAmount || userParticipant.amount) || 0;
                }
            }

            // Update group balance (positive = owed to, negative = owes)
            groupBalance.balance += (userPaid - userOwes);
        });

        // Calculate total balance
        let totalBalance = 0;
        groupBalances.forEach(groupBalance => {
            totalBalance += groupBalance.balance;
            groupBalance.balance = Math.round(groupBalance.balance * 100) / 100;
        });

        // Separate into groups where user owes and is owed
        const owesTo = [];
        const owedBy = [];

        groupBalances.forEach(groupBalance => {
            if (groupBalance.balance < -0.01) {
                owesTo.push({
                    ...groupBalance,
                    amount: Math.abs(groupBalance.balance)
                });
            } else if (groupBalance.balance > 0.01) {
                owedBy.push({
                    ...groupBalance,
                    amount: groupBalance.balance
                });
            }
        });

        return {
            userId,
            totalBalance: Math.round(totalBalance * 100) / 100,
            totalOwed: owesTo.reduce((sum, group) => sum + group.amount, 0),
            totalToReceive: owedBy.reduce((sum, group) => sum + group.amount, 0),
            owesTo,
            owedBy,
            groupBreakdown: Array.from(groupBalances.values())
        };
    } catch (error) {
        console.error('Error calculating user net balance:', error);
        throw new Error('Failed to calculate user net balance');
    }
};

/**
 * Get optimal payment suggestions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of suggested payments
 */
export const getPaymentSuggestions = async (userId) => {
    try {
        const netBalance = await getUserNetBalance(userId);

        // If user owes money, suggest payments to creditors
        if (netBalance.totalOwed > 0.01) {
            // Get detailed debt information for each group
            const suggestions = [];

            for (const group of netBalance.owesTo) {
                // Get simplified payments for this group
                const groupSimplification = await getGroupDebtSimplification(group.groupId);

                // Find payments where this user is the debtor
                const userPayments = groupSimplification.simplifiedPayments.filter(
                    payment => String(payment.from) === userId
                );

                userPayments.forEach(payment => {
                    suggestions.push({
                        groupId: group.groupId,
                        groupName: group.groupName,
                        to: payment.to,
                        amount: payment.amount,
                        priority: 'high' // Can add priority logic based on amount/age
                    });
                });
            }

            // Sort by amount (highest first)
            suggestions.sort((a, b) => b.amount - a.amount);

            return suggestions;
        }

        // If user is owed money, suggest who should pay them
        if (netBalance.totalToReceive > 0.01) {
            const suggestions = [];

            for (const group of netBalance.owedBy) {
                const groupSimplification = await getGroupDebtSimplification(group.groupId);

                // Find payments where this user is the creditor
                const userPayments = groupSimplification.simplifiedPayments.filter(
                    payment => String(payment.to) === userId
                );

                userPayments.forEach(payment => {
                    suggestions.push({
                        groupId: group.groupId,
                        groupName: group.groupName,
                        from: payment.from,
                        amount: payment.amount,
                        priority: 'high'
                    });
                });
            }

            // Sort by amount (highest first)
            suggestions.sort((a, b) => b.amount - a.amount);

            return suggestions;
        }

        // User is all settled up
        return [];
    } catch (error) {
        console.error('Error getting payment suggestions:', error);
        throw new Error('Failed to get payment suggestions');
    }
};

export default {
    calculateGroupBalances,
    simplifyDebts,
    getGroupDebtSimplification,
    getUserNetBalance,
    getPaymentSuggestions
};
