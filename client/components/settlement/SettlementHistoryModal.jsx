import { useEffect, useState } from 'react';
import Card from '../ui/Card.jsx';

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const currency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

export default function SettlementHistoryModal({ settlements = [] }) {
  return (
    <Card>
      <div className="card-header">
        <h2>Settlement History</h2>
        <p>Track your payments and settlements</p>
      </div>

      <div className="card-content">
        {settlements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            No settlement history yet.
          </div>
        ) : (
          <ul className="expense-list">
            {settlements.map((settlement) => (
              <li key={settlement._id} className="expense-item">
                <div
                  style={{
                    background: 'var(--success-dim)',
                    color: 'var(--success)',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <div className="expense-info">
                  <div className="expense-title">
                    Settled with {settlement.to?.name || settlement.to?.email || 'User'}
                  </div>
                  <div className="expense-meta">
                    {settlement.description && <span>{settlement.description}</span>}
                    {settlement.description && settlement.settledAt && (
                      <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>
                    )}
                    {settlement.settledAt && (
                      <span>{formatDate(settlement.settledAt)}</span>
                    )}
                  </div>
                </div>
                <div className="expense-amount" style={{ color: 'var(--success)' }}>
                  {currency(settlement.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
