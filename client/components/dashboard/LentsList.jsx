import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

/**
 * Money owed to you component
 * @param {object} props - Component props
 * @param {Array} props.lents - Array of lent items
 */
export default function LentsList({ lents }) {
  return (
    <Card>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Money Owed to Me</h2>
            <p>Track who needs to pay you back</p>
          </div>
          <span className={`badge ${lents.length === 0 ? 'badge-green' : 'badge-red'}`}>
            {lents.length === 0 ? 'Settled' : `${lents.length} pending`}
          </span>
        </div>
      </div>
      <div className="card-content">
        {lents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            Nobody owes you right now.
          </div>
        ) : (
          <ul className="expense-list">
            {lents.map((lent) => (
              <li key={lent.expenseId} className="expense-item">
                <div className="due-avatar" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
                  {(lent.owedBy?.[0]?.name || lent.owedBy?.[0]?.email || '?')[0].toUpperCase()}
                </div>
                <div className="expense-info">
                  <div className="expense-title">{lent.description}</div>
                  <div className="expense-meta">
                    Collect ← {lent.owedBy?.map((person) => person.name || person.email).filter(Boolean).join(', ') || 'Group members'}
                    {lent.group?.name ? ` · ${lent.group.name}` : ''}
                  </div>
                </div>
                <div>
                  <div className="expense-amount credit">{formatCurrency(lent.amount)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}