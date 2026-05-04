import { useState } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useExpenses from '../../hooks/useExpenses.js';
import Card from '../ui/Card.jsx';
import { isValidEmail } from '../../utils/validation.js';

const QuickExpenseForm = ({ onSuccess }) => {
  const { user } = useAuth();
  const { addExpense } = useExpenses();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [expenseType, setExpenseType] = useState('split'); // 'split', 'personal', 'payment'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Get user ID - handle both _id and id fields
    const userId = user?._id || user?.id;
    if (!userId) {
      throw new Error('User ID not found. Please log in again.');
    }

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    setLoading(true);

    try {
      const numericAmount = Number(amount);

      if (expenseType === 'personal') {
        // Personal expense - no splitting, just record the expense
        await addExpense({
          userId,
          groupId: null,
          amount: numericAmount,
          description: description.trim(),
          participants: [userId], // Only the current user
          splitType: 'equal',
          currency: 'INR',
        });
      } else if (expenseType === 'payment') {
        // Direct payment - one person paying another
        if (!email.trim()) {
          setError('Please enter recipient email');
          setLoading(false);
          return;
        }

        if (!isValidEmail(email)) {
          setError('Please enter a valid email address');
          setLoading(false);
          return;
        }

        await addExpense({
          userId,
          groupId: null,
          amount: numericAmount,
          description: description.trim(),
          participants: [email.trim()], // Backend will resolve this email to a user
          splitType: 'payment', // Use custom split type for payments
          currency: 'INR',
        });
      } else {
        // Split expense - traditional behavior
        if (!email.trim()) {
          setError('Please enter recipient email');
          setLoading(false);
          return;
        }

        if (!isValidEmail(email)) {
          setError('Please enter a valid email address');
          setLoading(false);
          return;
        }

        await addExpense({
          userId,
          groupId: null,
          amount: numericAmount,
          description: description.trim(),
          participants: [email.trim()],
          splitType: 'equal',
          currency: 'INR',
        });
      }

      setEmail('');
      setAmount('');
      setDescription('');
      onSuccess?.();
    } catch (err) {
      console.error('Error creating quick expense:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to add expense';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <div className="card-header">
        <h2>Quick Expense</h2>
        <p>Add expenses instantly - no group needed</p>
      </div>
      <div className="card-content">
        <form onSubmit={handleSubmit} className="expense-form">
          {/* Expense Type Selection */}
          <div className="form-group">
            <label>Expense Type</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className={`btn ${expenseType === 'split' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExpenseType('split')}
                style={{ flex: 1, fontSize: 12 }}
              >
                Split 💸
              </button>
              <button
                type="button"
                className={`btn ${expenseType === 'personal' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExpenseType('personal')}
                style={{ flex: 1, fontSize: 12 }}
              >
                Personal 👤
              </button>
              <button
                type="button"
                className={`btn ${expenseType === 'payment' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setExpenseType('payment')}
                style={{ flex: 1, fontSize: 12 }}
              >
                Payment 💳
              </button>
            </div>
          </div>

          {/* Email field - only for split and payment types */}
          {(expenseType === 'split' || expenseType === 'payment') && (
            <div className="form-group">
              <label htmlFor="quick-email">
                {expenseType === 'split' ? "Their Email" : "Recipient Email"}
              </label>
              <input
                id="quick-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={expenseType === 'split' ? "friend@example.com" : "recipient@example.com"}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="quick-amount">Amount (₹)</label>
            <input
              id="quick-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="quick-description">Description</label>
            <input
              id="quick-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this for?"
              disabled={loading}
            />
          </div>

          {/* Help text based on expense type */}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8 }}>
            {expenseType === 'split' && "Split equally between you and them"}
            {expenseType === 'personal' && "Personal expense - just for tracking"}
            {expenseType === 'payment' && "Direct payment - they owe you the full amount"}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Adding...' : `Add ${expenseType === 'personal' ? 'Personal' : expenseType === 'payment' ? 'Payment' : 'Expense'}`}
          </button>
        </form>
      </div>
    </Card>
  );
};

export default QuickExpenseForm;