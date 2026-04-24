import useExpenses from '../../hooks/useExpenses.js';
import Card from '../ui/Card.jsx';

function formatAmount(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(Number(value || 0));
}

export default function ExpenseList() {
  const { expenses } = useExpenses();

  return (
    <Card title="Recent Expenses" subtitle="Latest activity in this session">
      {expenses.length === 0 ? (
        <p className="muted">No expenses yet. Add your first one above.</p>
      ) : (
        <ul className="expense-list">
          {expenses.map((expense, index) => (
            <li key={expense._id || `${expense.description}-${index}`} className="expense-item">
              <div>
                <p className="expense-title">{expense.description || 'Untitled expense'}</p>
                <p className="muted">Group: {expense.group?.name || expense.groupId || expense.group || 'n/a'}</p>
              </div>
              <p className="expense-amount">{formatAmount(expense.amount)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}