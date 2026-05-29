export const normalizeType = (tx) => String(tx?.type || tx?.transactionType || '').toLowerCase();

export const isExpense = (tx) => {
  const t = normalizeType(tx);
  if (!t) return false;
  // common expense-like types
  if (t === 'expense' || t === 'shared_expense' || t === 'expense_transaction' || t === 'shared' || t === 'shared-expense') return true;
  // fallback: any type string that contains 'expense'
  if (t.includes('expense')) return true;
  return false;
};

export const isPayment = (tx) => {
  const t = normalizeType(tx);
  if (!t) return false;
  if (t === 'payment' || t === 'settlement' || t === 'settlement_payment') return true;
  if (t.includes('settlement') || t.includes('payment')) return true;
  // also respect splitType
  if (String(tx?.splitType || '').toLowerCase() === 'payment') return true;
  return false;
};
