import { formatDate, formatCurrency } from './dateFormatter.js';

export const exportToCSV = (data, filename = 'export.csv') => {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  downloadBlob(blob, filename);
};

export const exportExpensesAsCSV = (expenses, groupName = 'expenses') => {
  const data = expenses.map((exp) => ({
    Date: formatDate(exp.date || exp.createdAt),
    Description: exp.description,
    Amount: exp.amount,
    Category: exp.category || 'General',
    'Paid By': exp.paidBy?.name || exp.paidBy?.email || '',
    Participants: (exp.participants || [])
      .map((p) => p.userId?.name || p.userId?.email || '')
      .join('; '),
    Status: (exp.participants || []).some((p) => p.status === 'pending') ? 'Pending' : 'Settled',
  }));

  const filename = `${groupName}-expenses-${new Date().toISOString().split('T')[0]}.csv`;
  exportToCSV(data, filename);
};

export const exportSettlementsAsCSV = (settlements, filename = 'settlements.csv') => {
  const data = settlements.map((settle) => ({
    Date: formatDate(settle.settledAt),
    From: settle.from?.name || settle.from?.email || '',
    To: settle.to?.name || settle.to?.email || '',
    Amount: settle.amount,
    Description: settle.description || '',
  }));

  exportToCSV(data, filename);
};

export const generateExpenseReport = (expenses) => {
  const totalSpend = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const byCategory = {};
  const byPayer = {};

  expenses.forEach((exp) => {
    const cat = exp.category || 'General';
    byCategory[cat] = (byCategory[cat] || 0) + (exp.amount || 0);

    const payer = exp.paidBy?.name || exp.paidBy?.email || 'Unknown';
    byPayer[payer] = (byPayer[payer] || 0) + (exp.amount || 0);
  });

  return {
    totalSpend,
    expenseCount: expenses.length,
    byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })),
    byPayer: Object.entries(byPayer).map(([payer, amount]) => ({ payer, amount })),
  };
};

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
