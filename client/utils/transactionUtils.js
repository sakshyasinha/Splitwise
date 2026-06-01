export const normalizeType = (tx) => String(tx?.type || tx?.transactionType || '').toLowerCase();

export const isExpense = (tx) => {
  if (!tx) return false;

  const t = normalizeType(tx);
  const splitType = String(tx?.splitType || '').toLowerCase();

  if (isPayment(tx)) return false;
  if (t === 'expense' || t === 'shared_expense' || t === 'expense_transaction' || t === 'shared' || t === 'shared-expense') {
    return true;
  }
  if (t.includes('expense')) {
    return true;
  }

  // Mongo expense documents may not carry a separate transaction type.
  // Treat rows with the core expense shape as expenses unless they are payments.
  if (!t && splitType && splitType !== 'payment') {
    return true;
  }
  if (!t && (tx?._id || tx?.expenseId) && (tx?.amount != null || tx?.description) && splitType !== 'payment') {
    return true;
  }

  return false;
};

export const isPayment = (tx) => {
  const t = normalizeType(tx);
  if (t === 'payment' || t === 'settlement' || t === 'settlement_payment') return true;
  if (t.includes('settlement') || t.includes('payment')) return true;
  // also respect splitType
  if (String(tx?.splitType || '').toLowerCase() === 'payment') return true;
  return false;
};
