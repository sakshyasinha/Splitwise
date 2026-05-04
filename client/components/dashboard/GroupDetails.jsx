import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { prettifyGroupType, dedupeValues } from '../../utils/stringUtils.js';

/**
 * Group details component
 * @param {object} props - Component props
 * @param {object|null} props.group - Group data
 * @param {Array} props.memberNames - Array of member names
 * @param {Array} props.expenses - Array of group expenses
 * @param {object} props.position - Position data (amount, badgeClass, badgeText, tone)
 */
export default function GroupDetails({ group, memberNames, expenses, position }) {
  if (!group) {
    return (
      <div className="empty-state">
        <div className="empty-icon">👆</div>
        Select a group from the list to view details.
      </div>
    );
  }

  return (
    <Card>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Group Details</h2>
            <p>{group.name}</p>
          </div>
          <span className={`badge ${position.badgeClass}`}>
            {position.badgeText}
          </span>
        </div>
      </div>
      <div className="card-content">
        <div className="stack-lg">
          <div className="group-detail-head">
            <span className="badge badge-violet">{prettifyGroupType(group.type)}</span>
            <span className="badge badge-amber">{group.memberCount || 1} people</span>
          </div>

          {group.description && (
            <div>
              <div className="metric-label" style={{ marginBottom: 8 }}>Description</div>
              <div className="text-sm" style={{ fontStyle: 'italic', color: 'var(--muted2)' }}>
                {group.description}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <div className="metric-label">Members</div>
              <div className="metric">{group.memberCount || 1}</div>
            </div>
            <div>
              <div className="metric-label">Spend</div>
              <div className="metric">{formatCurrency(group.totalSpend)}</div>
            </div>
          </div>

          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>Member names</div>
            <div className="stack">
              {memberNames.length === 0 ? (
                <div className="text-sm muted">No members found for this group.</div>
              ) : (
                memberNames.map((memberName, index) => (
                  <div key={`${memberName}-${index}`} className="text-sm">
                    {memberName}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>Outstanding</div>
            <div
              className="metric"
              style={{ color: position.tone === 'danger' ? 'var(--danger)' : 'var(--success)' }}
            >
              {position.amount > 0 ? formatCurrency(position.amount) : 'Settled'}
            </div>
          </div>

          <div>
            <div className="metric-label" style={{ marginBottom: 8 }}>Recent expenses</div>
            {expenses.length === 0 ? (
              <div className="empty-state" style={{ marginTop: 8 }}>
                <div className="empty-icon">🧾</div>
                No expenses in this group yet.
              </div>
            ) : (
              <div className="stack">
                {expenses.slice(0, 8).map((expense) => {
                  const participants = (expense.participants || [])
                    .map((participant) => participant?.userId?.name || participant?.userId?.email)
                    .filter(Boolean);
                  const pendingParticipants = (expense.participants || []).filter(p => p?.status === 'pending');
                  const hasPending = pendingParticipants.length > 0;

                  return (
                    <div key={expense._id} className="group-expense-row">
                      <div>
                        <div className="text-sm" style={{ fontWeight: 700 }}>{expense.description}</div>
                        <div className="expense-meta">
                          Involved: {dedupeValues([
                            expense.paidBy?.name || expense.paidBy?.email || 'Payer',
                            ...participants,
                          ]).join(' · ')}
                        </div>
                        {!hasPending && (
                          <div className="expense-meta" style={{ marginTop: 4, color: 'var(--success)' }}>✓ Settled</div>
                        )}
                      </div>
                      <span className="text-sm" style={{ fontWeight: 700, color: hasPending ? 'var(--danger)' : 'var(--success)' }}>
                        {hasPending ? formatCurrency(expense.amount) : '✓'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}