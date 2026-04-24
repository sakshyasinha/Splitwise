import { useMemo, useState } from 'react';
import useExpenses from '../../hooks/useExpenses.js';
import Card from '../ui/Card.jsx';

function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(value || 0));
}

export default function ExpenseList() {
  const { expenses = [], loading, error, updateExpense, deleteExpense } = useExpenses();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ description: '', amount: '' });

  const canSave = useMemo(() => form.description.trim() && Number(form.amount) > 0, [form]);

  const startEdit = (expense) => {
    setEditingId(expense._id);
    setForm({
      description: expense.description || '',
      amount: String(expense.amount || '')
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
        amount: Number(form.amount)
      });
      cancelEdit();
    } catch (_error) {
      // Error is handled in store.
    }
  };

  const removeExpense = async (expenseId) => {
    try {
      await deleteExpense(expenseId);
      if (editingId === expenseId) {
        cancelEdit();
      }
    } catch (_error) {
      // Error is handled in store.
    }
  };

  return (
    <Card title="Recent Expenses" subtitle="Add, edit, or delete your entries">
      {loading && <p className="muted">Syncing expenses...</p>}
      {error && <p className="banner error">{error}</p>}

      {!loading && expenses.length === 0 && (
        <p className="muted">No expenses yet. Add your first one above.</p>
      )}

      {!loading && expenses.length > 0 && (
        <ul className="expense-list">
          {expenses.map((expense) => (
            <li key={expense._id} className="expense-item">
              <div className="stack" style={{ width: '100%' }}>
                {editingId === expense._id ? (
                  <>
                    <input
                      className="input"
                      value={form.description}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, description: event.target.value }))
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                    />
                  </>
                ) : (
                  <>
                    <p className="expense-title">{expense.description || 'Untitled expense'}</p>
                    <p className="muted">Group: {expense.group?.name || expense.groupId || 'n/a'}</p>
                    <p className="muted">Paid by: {expense.paidBy?.name || expense.paidBy?.email || 'n/a'}</p>
                  </>
                )}

                <div className="stack" style={{ gridTemplateColumns: 'repeat(3, max-content)', gap: '0.5rem' }}>
                  {editingId === expense._id ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={loading || !canSave}
                        onClick={() => saveEdit(expense._id)}
                      >
                        Save
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-ghost" onClick={() => startEdit(expense)}>
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={loading}
                    onClick={() => removeExpense(expense._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="expense-amount">{formatAmount(expense.amount)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}