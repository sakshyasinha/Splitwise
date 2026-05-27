import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import { useMemo } from 'react';
import { formatCurrency } from '../../utils/formatCurrency.js';

/**
 * Dues list component
 * @param {object} props - Component props
 * @param {Array} props.dues - Array of dues
 * @param {string|null} props.settlingExpenseId - ID of expense being settled
 * @param {function} props.onSettleDue - Settle due handler
 * @param {boolean} props.grouped - Show dues grouped by group name
 */
export default function DuesList({ dues, settlingExpenseId, onSettleDue, grouped = false }) {
  const getRowKey = (due) => String(due?.transactionId || due?.sourceExpenseId || due?.expenseId || due?._id || '');
  const getDisplayName = (party) => party?.displayName || party?.name || party?.email || 'Unknown User';
  const getAvatarInitial = (party) => getDisplayName(party).trim().charAt(0).toUpperCase() || '?';

  const groupedDues = useMemo(() => {
    const groups = new Map();

    (dues || [])
  .filter((due) => due.group?._id || due.group?.id || due.group?.name)
  .forEach((due) => {
      const groupId =
  due.group?._id ||
  due.group?.id ||
  due.group?.name;

const groupName = due.group?.name;

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          groupId,
          groupName,
          dues: [],
        });
      }

      groups.get(groupId).dues.push(due);
    });

    return Array.from(groups.values()).sort((left, right) => left.groupName.localeCompare(right.groupName));
  }, [dues]);

  return (
    <div id="my-dues-card">
      <Card>
        <div className="card-header">
          <div className="flex items-center justify-between">
            <div>
              <h2>My Dues</h2>
              <p>{grouped ? 'Grouped by group for faster settling' : 'Settle up directly from here'}</p>
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
          ) : grouped ? (
            <div className="stack" style={{ gap: 14 }}>
              {groupedDues.map((group) => {
                const groupTotal = group.dues.reduce((sum, due) => sum + Number(due.amount || 0), 0);

                return (
                  <div key={group.groupId} className="card" style={{ padding: 12, border: '1px solid var(--border-muted)' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <div>
                        <div className="expense-title" style={{ fontSize: 14 }}>{group.groupName}</div>
                        <div className="expense-meta">{group.dues.length} due{group.dues.length === 1 ? '' : 's'}</div>
                      </div>
                      <div className="expense-amount debit">{formatCurrency(groupTotal)}</div>
                    </div>

                    <ul className="expense-list">
                      {group.dues.map((due) => (
                                <li key={getRowKey(due)} className="expense-item">
                          <div className="due-avatar" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                            {getAvatarInitial(due.paidTo)}
                          </div>
                          <div className="expense-info">
                            <div className="expense-title">{due.description}</div>
                            <div className="expense-meta">
                              {due.canSettle === false
                                ? (due.metaText || 'Outstanding group expense')
                                : `Pay -> ${getDisplayName(due.paidTo)}`}
                            </div>
                            {due.canSettle !== false && (
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
                            )}
                          </div>
                          <div>
                            <div className="expense-amount debit">{formatCurrency(due.amount)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <ul className="expense-list">
              {dues.map((due) => (
                <li key={getRowKey(due)} className="expense-item">
                  <div className="due-avatar" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                    {getAvatarInitial(due.paidTo)}
                  </div>
                  <div className="expense-info">
                    <div className="expense-title">{due.description}</div>
                    <div className="expense-meta">
                      {due.canSettle === false
                        ? (due.metaText || 'Outstanding group expense')
                        : `Pay -> ${getDisplayName(due.paidTo)}`}
                      {due.group?.name ? ` · ${due.group.name}` : ''}
                    </div>
                    {due.canSettle !== false && (
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
                    )}
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
    </div>
  );
}