import { useMemo, useState } from 'react';
import useExpenses from '../../hooks/useExpenses.js';
import useAuth from '../../hooks/useAuth.js';
import useToast from '../../hooks/useToast.js';
import Card from '../ui/Card.jsx';

function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(Number(value || 0));
}

const personName = (person, fallback = 'Unknown') => {
  if (!person) return fallback;
  if (typeof person === 'string') return person;
  return person.name || person.email || fallback;
};

const CAT_COLORS = {
  Food:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  Travel:    { bg: 'rgba(124,110,255,0.12)', color: '#a594ff' },
  Events:    { bg: 'rgba(244,63,94,0.12)',   color: '#f43f5e' },
  Utilities: { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
  Shopping:  { bg: 'rgba(56,189,248,0.12)',  color: '#38bdf8' },
  General:   { bg: 'rgba(122,121,138,0.12)', color: '#7a798a' },
};

const CAT_EMOJI = {
  Food: '🍕', Travel: '✈', Events: '🎉',
  Utilities: '🏠', Shopping: '🛒', General: '🧾',
};

function CategoryIcon({ category }) {
  const key = category || 'General';
  const style = CAT_COLORS[key] || CAT_COLORS.General;
  return (
    <div
      className="expense-icon"
      style={{ background: style.bg, color: style.color, fontSize: 17 }}
    >
      {CAT_EMOJI[key] || '🧾'}
    </div>
  );
}

export default function ExpenseList({ onEdit }) {
  const { user } = useAuth();
  const { expenses = [], loading, error, updateExpense, deleteExpense } = useExpenses();
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ description: '', amount: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const canSave = useMemo(
    () => form.description.trim() && Number(form.amount) > 0,
    [form]
  );

  const startEdit = (expense) => {
    setEditingId(expense._id);
    setForm({
      description: expense.description || '',
      amount: String(expense.amount || ''),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ description: '', amount: '' });
  };

  const saveEdit = async (expenseId) => {
    try {
      await updateExpense(expenseId, {
        description: form.description,
        amount: Number(form.amount),
      });
      toast.success('Expense updated successfully');
      cancelEdit();
    } catch (err) {
      toast.error('Failed to update expense');
    }
  };

  const removeExpense = async (expenseId) => {
    try {
      await deleteExpense(expenseId);
      toast.success('Expense deleted successfully');
      if (editingId === expenseId) cancelEdit();
      setConfirmDelete(null);
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense._id);
    setForm({
      description: expense.description || '',
      amount: String(expense.amount || ''),
    });
    if (onEdit) {
      onEdit(expense);
    }
  };

  return (
    <Card>
      {/* ── HEADER ── */}
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Recent Expenses</h2>
            <p>Add, edit, or delete your entries</p>
          </div>
          <span className="badge badge-violet">{expenses.length} items</span>
        </div>
      </div>

      <div className="card-content">
        {/* ── LOADING ── */}
        {loading && (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 20 }}>⟳</div>
            Syncing expenses…
          </div>
        )}

        {/* ── ERROR ── */}
        {error && <p className="banner error">{error}</p>}

        {/* ── EMPTY ── */}
        {!loading && expenses.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            No expenses yet — add your first one above.
          </div>
        )}

        {/* ── LIST ── */}
        {!loading && expenses.length > 0 && (
          <ul className="expense-list">
            {expenses.map((expense) => {
              const paidById = expense.paidBy?._id || expense.paidBy;
              const canManage = user?.id && String(paidById) === String(user.id);
              const isEditing = editingId === expense._id;
              const isConfirming = confirmDelete === expense._id;
              const involvedPeople = [
                personName(expense.paidBy, 'Payer'),
                ...(expense.participants || []).map((participant) => personName(participant?.userId, 'Member')),
              ];

              return (
                <li key={expense._id} className="expense-item" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>

                  {/* ICON */}
                  {!isEditing && <CategoryIcon category={expense.category} />}

                  {/* BODY */}
                  <div className="expense-info">
                    {isEditing ? (
                      /* ── EDIT MODE ── */
                      <div className="stack" style={{ gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Description"
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          autoFocus
                        />
                        <input
                          className="input"
                          type="number"
                          min="1"
                          placeholder="Amount"
                          value={form.amount}
                          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={loading || !canSave}
                            onClick={() => saveEdit(expense._id)}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={cancelEdit}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE ── */
                      <>
                        <div className="expense-title">{expense.description || 'Untitled expense'}</div>
                        <div className="expense-meta">
                          {expense.group?.name && <span>{expense.group.name}</span>}
                          {expense.group?.name && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                          <span>
                            Paid by {expense.paidBy?.name || expense.paidBy?.email || 'n/a'}
                          </span>
                        </div>
                        <div className="expense-meta" style={{ marginTop: 6 }}>
                          <strong style={{ fontWeight: 700 }}>Involved:</strong>
                          <span>{involvedPeople.join(' · ')}</span>
                        </div>
                        {/* Show pending vs settled status */}
                        {expense.participants?.length > 0 && (
                          <div className="expense-meta" style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                            {(() => {
                              const pendingCount = (expense.participants || []).filter(p => p?.status === 'pending').length;
                              const settledCount = (expense.participants || []).length - pendingCount;
                              return (
                                <>
                                  {pendingCount > 0 && <span style={{ color: 'var(--danger)' }}>{pendingCount} pending</span>}
                                  {pendingCount > 0 && settledCount > 0 && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                                  {settledCount > 0 && <span style={{ color: 'var(--success)' }}>{settledCount} settled</span>}
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {/* ACTION ROW */}
                        {canManage ? (
                          isConfirming ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                              <span className="text-sm" style={{ color: 'var(--danger)' }}>Delete?</span>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                disabled={loading}
                                onClick={() => removeExpense(expense._id)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => startEdit(expense)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)', borderColor: 'var(--danger-dim)' }}
                                disabled={loading}
                                onClick={() => setConfirmDelete(expense._id)}
                              >
                                Delete
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="text-sm muted" style={{ marginTop: 6 }}>View only</div>
                        )}
                      </>
                    )}
                  </div>

                  {/* AMOUNT — hidden in edit mode */}
                  {!isEditing && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {(() => {
                        const pendingParticipants = (expense.participants || []).filter(p => p?.status === 'pending');
                        const pendingCount = pendingParticipants.length;
                        const hasPending = pendingCount > 0;
                        return (
                          <>
                            <div className="expense-amount debit" style={{ color: hasPending ? 'var(--danger)' : 'var(--success)' }}>
                              {hasPending ? formatAmount(expense.amount) : '✓'}
                            </div>
                            {hasPending && (
                              <div className="expense-share">
                                ÷ {pendingCount + 1} people
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
