import { useMemo, useState } from 'react';
import useExpenses from '../../hooks/useExpenses.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Input from '../ui/Input.jsx';

export default function ExpenseForm() {
  const { addExpense, groups, loading, error, clearError } = useExpenses();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    groupId: '',
    participants: ''
  });
  const [success, setSuccess] = useState('');

  const canSubmit = useMemo(() => {
    return (
      form.description.trim() &&
      Number(form.amount) > 0 &&
      form.groupId.trim() &&
      form.participants.trim()
    );
  }, [form]);

  const onChange = (event) => {
    clearError();
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSuccess('');
    try {
      await addExpense({
        description: form.description,
        amount: Number(form.amount),
        groupId: form.groupId,
        participants: form.participants.split(',').map((item) => item.trim()).filter(Boolean)
      });
      setSuccess('Expense added.');
      setForm({ description: '', amount: '', groupId: '', participants: '' });
    } catch (_error) {
      // Error managed in store.
    }
  };

  return (
    <Card title="Add Expense" subtitle="Track shared spending instantly">
      <form className="stack" onSubmit={handleSubmit}>
        <Input
          id="expense-description"
          name="description"
          label="Description"
          value={form.description}
          onChange={onChange}
          placeholder="Dinner at Bistro"
          required
        />

        <Input
          id="expense-amount"
          name="amount"
          label="Amount"
          type="number"
          min="1"
          value={form.amount}
          onChange={onChange}
          placeholder="1600"
          required
        />

        <label className="input-block" htmlFor="group-id">
          <span className="input-label">Group</span>
          <select
            id="group-id"
            className="input"
            name="groupId"
            value={form.groupId}
            onChange={onChange}
            required
          >
            <option value="">Select a group</option>
            {groups.map((group) => (
              <option key={group._id || group.name} value={group._id || group.name}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <Input
          id="participants"
          name="participants"
          label="Participants (comma separated emails)"
          value={form.participants}
          onChange={onChange}
          placeholder="friend1@gmail.com,friend2@gmail.com"
          required
        />

        {error && <p className="banner error">{error}</p>}
        {success && <p className="banner success">{success}</p>}

        <Button type="submit" disabled={loading || !canSubmit}>
          {loading ? 'Saving...' : 'Save Expense'}
        </Button>
      </form>
    </Card>
  );
}