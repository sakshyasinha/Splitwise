/**
 * Smart Settlement Optimization Service
 * Calculates optimal payment chains to minimize transactions
 */

/**
 * Calculate net balances for all users in a group
 * @param {Array} expenses - Array of expense objects
 * @param {Array} users - Array of user objects
 * @returns {Object} Map of userId -> net balance (positive = owed, negative = owes)
 */
export const calculateNetBalances = (expenses, users) => {
  const balances = {};

  // Initialize balances for all users
  users.forEach(user => {
    balances[user._id] = 0;
  });

  // Calculate balances from expenses
  expenses.forEach(expense => {
    const amount = Number(expense.amount) || 0;

    // Add amount to payer's balance (they are owed this amount)
    if (expense.paidBy) {
      const payerId = expense.paidBy._id || expense.paidBy;
      if (balances[payerId] !== undefined) {
        balances[payerId] += amount;
      }
    }

    // Subtract each participant's share from their balance
    if (expense.participants && Array.isArray(expense.participants)) {
      expense.participants.forEach(participant => {
        const userId = participant.userId?._id || participant.userId;
        const shareAmount = Number(participant.amount) || 0;

        if (balances[userId] !== undefined) {
          balances[userId] -= shareAmount;
        }
      });
    }
  });

  return balances;
};

/**
 * Separate users into debtors and creditors
 * @param {Object} balances - Map of userId -> net balance
 * @returns {Object} { debtors: Array, creditors: Array }
 */
export const separateDebtorsAndCreditors = (balances) => {
  const debtors = [];
  const creditors = [];

  Object.entries(balances).forEach(([userId, balance]) => {
    // Round to avoid floating point issues
    const roundedBalance = Math.round(balance * 100) / 100;

    if (roundedBalance < -0.01) {
      debtors.push({
        userId,
        amount: Math.abs(roundedBalance)
      });
    } else if (roundedBalance > 0.01) {
      creditors.push({
        userId,
        amount: roundedBalance
      });
    }
  });

  return { debtors, creditors };
};

/**
 * Calculate optimal settlements using greedy algorithm
 * @param {Object} balances - Map of userId -> net balance
 * @returns {Array} Array of settlement objects { from, to, amount }
 */
export const calculateOptimalSettlements = (balances) => {
  const { debtors, creditors } = separateDebtorsAndCreditors(balances);
  const settlements = [];

  // Sort debtors by amount (descending) and creditors by amount (descending)
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let debtorIndex = 0;
  let creditorIndex = 0;

  // Match debtors to creditors
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];

    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0.01) {
      settlements.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: Math.round(amount * 100) / 100
      });
    }

    // Update remaining amounts
    debtor.amount -= amount;
    creditor.amount -= amount;

    // Move to next debtor if current one is settled
    if (debtor.amount < 0.01) {
      debtorIndex++;
    }

    // Move to next creditor if current one is settled
    if (creditor.amount < 0.01) {
      creditorIndex++;
    }
  }

  return settlements;
};

/**
 * Calculate payment chains to further reduce transactions
 * @param {Array} settlements - Array of settlement objects
 * @returns {Array} Array of optimized settlement chains
 */
export const calculatePaymentChains = (settlements) => {
  if (settlements.length <= 1) {
    return settlements;
  }

  // Build a graph of payments
  const graph = {};
  const reverseGraph = {};

  settlements.forEach(settlement => {
    if (!graph[settlement.from]) {
      graph[settlement.from] = [];
    }
    if (!reverseGraph[settlement.to]) {
      reverseGraph[settlement.to] = [];
    }

    graph[settlement.from].push({ to: settlement.to, amount: settlement.amount });
    reverseGraph[settlement.to].push({ from: settlement.from, amount: settlement.amount });
  });

  // Find chains where A -> B -> C can be optimized to A -> C
  const optimizedSettlements = [];
  const processed = new Set();

  settlements.forEach(settlement => {
    if (processed.has(settlement.from)) {
      return;
    }

    // Check if this debtor can pay directly to someone who owes them
    const creditors = graph[settlement.from] || [];
    const debtors = reverseGraph[settlement.from] || [];

    for (const creditor of creditors) {
      for (const debtor of debtors) {
        // If debtor owes creditor, we can create a direct payment
        if (graph[debtor.from]?.some(c => c.to === creditor.to)) {
          const directAmount = Math.min(settlement.amount, debtor.amount);

          if (directAmount > 0.01) {
            optimizedSettlements.push({
              from: debtor.from,
              to: creditor.to,
              amount: Math.round(directAmount * 100) / 100
            });

            processed.add(debtor.from);
            processed.add(settlement.from);
          }
        }
      }
    }

    if (!processed.has(settlement.from)) {
      optimizedSettlements.push(settlement);
      processed.add(settlement.from);
    }
  });

  return optimizedSettlements;
};

/**
 * Generate settlement suggestions with explanations
 * @param {Array} expenses - Array of expense objects
 * @param {Array} users - Array of user objects
 * @returns {Object} { settlements, suggestions, summary }
 */
export const generateSettlementSuggestions = (expenses, users) => {
  const balances = calculateNetBalances(expenses, users);
  const settlements = calculateOptimalSettlements(balances);
  const optimizedSettlements = calculatePaymentChains(settlements);

  const suggestions = [];

  // Generate suggestions for each settlement
  optimizedSettlements.forEach(settlement => {
    const fromUser = users.find(u => u._id === settlement.from);
    const toUser = users.find(u => u._id === settlement.to);

    if (fromUser && toUser) {
      suggestions.push({
        type: 'direct_payment',
        from: fromUser,
        to: toUser,
        amount: settlement.amount,
        message: `${fromUser.name || fromUser.email} should pay ${toUser.name || toUser.email} ₹${settlement.amount.toFixed(2)}`
      });
    }
  });

  // Calculate summary statistics
  const totalTransactions = optimizedSettlements.length;
  const totalAmount = optimizedSettlements.reduce((sum, s) => sum + s.amount, 0);
  const avgTransactionAmount = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

  // Calculate potential savings
  const originalTransactions = settlements.length;
  const transactionsSaved = originalTransactions - totalTransactions;
  const percentageSaved = originalTransactions > 0
    ? Math.round((transactionsSaved / originalTransactions) * 100)
    : 0;

  return {
    settlements: optimizedSettlements,
    suggestions,
    summary: {
      totalTransactions,
      totalAmount,
      avgTransactionAmount,
      originalTransactions,
      transactionsSaved,
      percentageSaved,
      usersInvolved: Object.keys(balances).filter(id => Math.abs(balances[id]) > 0.01).length
    },
    balances
  };
};

/**
 * Get alternative payment suggestions
 * @param {Object} balances - Map of userId -> net balance
 * @param {Array} users - Array of user objects
 * @returns {Array} Array of alternative payment suggestions
 */
export const getAlternativePaymentSuggestions = (balances, users) => {
  const alternatives = [];

  // Find users with similar balances that could be combined
  const positiveBalances = Object.entries(balances)
    .filter(([_, balance]) => balance > 0.01)
    .map(([userId, balance]) => ({ userId, balance }))
    .sort((a, b) => b.balance - a.balance);

  const negativeBalances = Object.entries(balances)
    .filter(([_, balance]) => balance < -0.01)
    .map(([userId, balance]) => ({ userId, balance: Math.abs(balance) }))
    .sort((a, b) => b.balance - a.balance);

  // Suggest combining payments
  for (let i = 0; i < Math.min(positiveBalances.length, negativeBalances.length); i++) {
    const creditor = positiveBalances[i];
    const debtor = negativeBalances[i];

    const creditorUser = users.find(u => u._id === creditor.userId);
    const debtorUser = users.find(u => u._id === debtor.userId);

    if (creditorUser && debtorUser) {
      alternatives.push({
        type: 'combine',
        from: debtorUser,
        to: creditorUser,
        amount: Math.min(creditor.balance, debtor.balance),
        message: `Combine payments: ${debtorUser.name || debtorUser.email} pays ${creditorUser.name || creditorUser.email}`
      });
    }
  }

  return alternatives;
};

export default {
  calculateNetBalances,
  separateDebtorsAndCreditors,
  calculateOptimalSettlements,
  calculatePaymentChains,
  generateSettlementSuggestions,
  getAlternativePaymentSuggestions
};