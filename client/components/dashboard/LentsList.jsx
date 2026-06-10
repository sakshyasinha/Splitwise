import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { sendPaymentReminder } from '../../services/activity.service.js';
import useAuth from '../../hooks/useAuth.js';
import useToast from '../../hooks/useToast.js';
import { useState } from 'react';

/**
 * Money owed to you component
 * @param {object} props - Component props
 * @param {Array} props.lents - Array of lent items
 */
export default function LentsList({ lents }) {
  const { user } = useAuth();
  const toast = useToast();
  const [nudgingId, setNudgingId] = useState(null);
  const getRowKey = (lent) => String(lent?.transactionId || lent?.sourceExpenseId || lent?.expenseId || lent?._id || '');

  const handleNudge = async (lent) => {
    if (!lent.owedBy || lent.owedBy.length === 0) {
      toast.error('No one to nudge for this expense');
      return;
    }

    const debtorRaw = lent.owedBy[0]; // Nudge the first person who owes money
    // Debt entry may contain different shapes: { id }, { _id }, { userId }, or a raw user object.
    const debtorId = debtorRaw?.id || debtorRaw?._id || (debtorRaw?.userId && (debtorRaw.userId._id || debtorRaw.userId)) || null;
    if (!debtorId) {
      toast.error('Could not find user to nudge');
      return;
    }

    try {
      console.log('LentsList handleNudge lent payload:', {
        lentId: getRowKey(lent),
        lent,
        owedBy: lent?.owedBy,
      });
      const rowKey = getRowKey(lent);
      setNudgingId(rowKey);
        await sendPaymentReminder(
          debtorId,
          lent.amount,
          lent.group?.id || null,
          `Hey! Just reminding you about the ₹${lent.amount} you owe for "${lent.description}"`
        );
      toast.success(`Reminder sent to ${debtorRaw?.name || debtorRaw?.email || 'user'}`);
        // Let notifications refresh
        try { window.dispatchEvent(new Event('splitwise:notifications-updated')); } catch (e) { /* ignore */ }
    } catch (error) {
      console.error('Error sending nudge:', error);
      const retryAfter = error?.response?.data?.retryAfter || error?.response?.data?.resetTime;
      const message = error?.response?.data?.message || error.message || 'Failed to send reminder';
      toast.error(retryAfter ? `${message} Try again in ${retryAfter}s.` : message);
    } finally {
      setNudgingId(null);
    }
  };

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
              <li key={getRowKey(lent)} className="expense-item">
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div className="expense-amount credit">{formatCurrency(lent.amount)}</div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => handleNudge(lent)}
                    disabled={nudgingId === getRowKey(lent)}
                    style={{ fontSize: 11, padding: '4px 8px', minWidth: 'auto' }}
                  >
                    {nudgingId === getRowKey(lent) ? 'Sending…' : ' Nudge'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}