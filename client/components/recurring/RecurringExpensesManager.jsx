import { useState, useEffect } from 'react';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

const RecurringExpensesManager = () => {
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    category: 'General',
    recurrence: {
      type: 'monthly',
      interval: 1,
      dayOfMonth: 1
    },
    notes: ''
  });

  useEffect(() => {
    fetchRecurringExpenses();
    fetchStats();
  }, []);

  const fetchRecurringExpenses = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/recurring-expenses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setRecurringExpenses(data);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/recurring-expenses/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingExpense
        ? `/api/recurring-expenses/${editingExpense._id}`
        : '/api/recurring-expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowModal(false);
        setEditingExpense(null);
        resetForm();
        fetchRecurringExpenses();
        fetchStats();
      }
    } catch (error) {
      console.error('Error saving recurring expense:', error);
    }
  };

  const handlePause = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/recurring-expenses/${id}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Paused by user' })
      });
      fetchRecurringExpenses();
      fetchStats();
    } catch (error) {
      console.error('Error pausing recurring expense:', error);
    }
  };

  const handleResume = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/recurring-expenses/${id}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Resumed by user' })
      });
      fetchRecurringExpenses();
      fetchStats();
    } catch (error) {
      console.error('Error resuming recurring expense:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this recurring expense?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/recurring-expenses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Deleted by user' })
      });
      fetchRecurringExpenses();
      fetchStats();
    } catch (error) {
      console.error('Error deleting recurring expense:', error);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      category: expense.category,
      recurrence: expense.recurrence,
      notes: expense.notes || ''
    });
    setShowModal(true);
  };

  const handleGenerateNow = async (id) => {
    if (!confirm('Generate expense now? This will create a new expense instance.')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/recurring-expenses/${id}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Expense generated successfully!');
      fetchRecurringExpenses();
    } catch (error) {
      console.error('Error generating expense:', error);
      alert('Failed to generate expense');
    }
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      currency: 'INR',
      category: 'General',
      recurrence: {
        type: 'monthly',
        interval: 1,
        dayOfMonth: 1
      },
      notes: ''
    });
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getRecurrenceText = (recurrence) => {
    const { type, interval } = recurrence;
    const intervalText = interval > 1 ? `every ${interval} ` : '';

    switch (type) {
      case 'daily': return `${intervalText}day${interval > 1 ? 's' : ''}`;
      case 'weekly': return `${intervalText}week${interval > 1 ? 's' : ''}`;
      case 'biweekly': return `${intervalText}2 weeks`;
      case 'monthly': return `${intervalText}month${interval > 1 ? 's' : ''}`;
      case 'quarterly': return `${intervalText}quarter${interval > 1 ? 's' : ''}`;
      case 'yearly': return `${intervalText}year${interval > 1 ? 's' : ''}`;
      default: return type;
    }
  };

  if (loading) {
    return <div className="loading">Loading recurring expenses...</div>;
  }

  return (
    <div className="recurring-expenses-manager">
      <div className="recurring-header">
        <h2>Recurring Expenses</h2>
        <Button onClick={() => { resetForm(); setEditingExpense(null); setShowModal(true); }}>
          + Add Recurring Expense
        </Button>
      </div>

      {stats && (
        <Card className="recurring-stats">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-label">Total</div>
              <div className="stat-value">{stats.total}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Active</div>
              <div className="stat-value">{stats.active}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Paused</div>
              <div className="stat-value">{stats.paused}</div>
            </div>
            <div className="stat-item">
              <div className="stat-label">Monthly Total</div>
              <div className="stat-value">{formatCurrency(stats.totalMonthlyAmount)}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="recurring-list">
        {recurringExpenses.length === 0 ? (
          <Card className="empty-state">
            <p>No recurring expenses yet. Create one to automate your regular expenses!</p>
          </Card>
        ) : (
          recurringExpenses.map((expense) => (
            <Card key={expense._id} className={`recurring-item ${!expense.isActive ? 'inactive' : ''}`}>
              <div className="recurring-item-header">
                <div className="recurring-info">
                  <h3>{expense.description}</h3>
                  <div className="recurring-meta">
                    <span className="amount">{formatCurrency(expense.amount)}</span>
                    <span className="category">{expense.category}</span>
                    <span className="recurrence">{getRecurrenceText(expense.recurrence)}</span>
                  </div>
                </div>
                <div className="recurring-status">
                  {!expense.isActive && <span className="status-badge inactive">Inactive</span>}
                  {expense.isPaused && <span className="status-badge paused">Paused</span>}
                </div>
              </div>

              <div className="recurring-details">
                <div className="detail-item">
                  <span className="detail-label">Next Occurrence:</span>
                  <span className="detail-value">{formatDate(expense.nextOccurrence)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Occurrences:</span>
                  <span className="detail-value">{expense.occurrenceCount}</span>
                </div>
                {expense.lastOccurrence && (
                  <div className="detail-item">
                    <span className="detail-label">Last Generated:</span>
                    <span className="detail-value">{formatDate(expense.lastOccurrence)}</span>
                  </div>
                )}
              </div>

              <div className="recurring-actions">
                {expense.isActive && !expense.isPaused && (
                  <>
                    <Button variant="secondary" onClick={() => handleGenerateNow(expense._id)}>
                      Generate Now
                    </Button>
                    <Button variant="secondary" onClick={() => handlePause(expense._id)}>
                      Pause
                    </Button>
                  </>
                )}
                {expense.isPaused && (
                  <Button variant="secondary" onClick={() => handleResume(expense._id)}>
                    Resume
                  </Button>
                )}
                <Button variant="secondary" onClick={() => handleEdit(expense)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => handleDelete(expense._id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={showModal}
        title={editingExpense ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
        onClose={() => { setShowModal(false); setEditingExpense(null); resetForm(); }}
      >
        <form onSubmit={handleSubmit} className="recurring-form">
          <Input
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />

          <Input
            label="Amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />

          <div className="form-group">
            <label>Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
            </select>
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="General">General</option>
              <option value="Food">Food</option>
              <option value="Travel">Travel</option>
              <option value="Events">Events</option>
              <option value="Utilities">Utilities</option>
              <option value="Shopping">Shopping</option>
              <option value="Rent">Rent</option>
              <option value="Transport">Transport</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Recurrence Type</label>
            <select
              value={formData.recurrence.type}
              onChange={(e) => setFormData({
                ...formData,
                recurrence: { ...formData.recurrence, type: e.target.value }
              })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="form-group">
            <label>Interval (every X days/weeks/months)</label>
            <Input
              type="number"
              min="1"
              value={formData.recurrence.interval}
              onChange={(e) => setFormData({
                ...formData,
                recurrence: { ...formData.recurrence, interval: parseInt(e.target.value) }
              })}
            />
          </div>

          {formData.recurrence.type === 'monthly' && (
            <div className="form-group">
              <label>Day of Month</label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.recurrence.dayOfMonth}
                onChange={(e) => setFormData({
                  ...formData,
                  recurrence: { ...formData.recurrence, dayOfMonth: parseInt(e.target.value) }
                })}
              />
            </div>
          )}

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <Button type="submit">
              {editingExpense ? 'Update' : 'Create'} Recurring Expense
            </Button>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecurringExpensesManager;