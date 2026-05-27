const SETTLED_STATUSES = new Set(['settled', 'paid']);

export const isParticipantSettled = (participant) => {
  const status = String(participant?.status || 'pending').toLowerCase();
  return SETTLED_STATUSES.has(status);
};

export const getExpensePendingCount = (expense) => {
  return (expense?.participants || []).filter((participant) => !isParticipantSettled(participant)).length;
};

export const isExpenseFullySettled = (expense) => {
  if (!expense) return true;
  if (expense.isSettled) return true;

  const participants = Array.isArray(expense.participants) ? expense.participants : [];
  if (participants.length === 0) return false;

  return participants.every(isParticipantSettled);
};