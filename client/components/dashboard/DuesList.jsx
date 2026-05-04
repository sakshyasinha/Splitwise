import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

/**
 * Dues list component
 * @param {object} props - Component props
 * @param {Array} props.dues - Array of dues
 * @param {string|null} props.settlingExpenseId - ID of expense being settled
 * @param {function} props.onSettleDue - Settle due handler
 */
export default function DuesList({ dues, settlingExpenseId, onSettleDue }) {
  return (
    <Card>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>My Dues</h2>
            <p>Settle up directly from here</p>
          </div>
          <span className={`badge ${dues.length === 0 ? 'badge-green' : 'badge-red'}`}>
            {dues.length === 0 ? 'Settled' : `${dues.length} pending`}
          </span>
        </div>
      </div>
      <div className="card-content">
        {dues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            You're all clear — no pending dues.
          </div>
        ) : (
          <ul className="expense-list">
            {dues.map((due) => (
              <li key={due.expenseId} className="expense-item">
                <div className="due-avatar" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                  {(due.paidTo?.name || due.paidTo?.email || '?')[0].toUpperCase()}
                </div>
                <div className="expense-info">
                  <div className="expense-title">{due.description}</div>
                  <div className="expense-meta">
                    Pay → {due.paidTo?.name || due.paidTo?.email}
                    {due.group?.name ? ` · ${due.group.name}` : ''}
                  </div>
                  <div className="settle-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => onSettleDue(due.expenseId)}
                      disabled={settlingExpenseId === due.expenseId}
                    >
                      {settlingExpenseId === due.expenseId ? 'Settling...' : 'Settle Up'}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="expense-amount debit">{formatCurrency(due.amount)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}