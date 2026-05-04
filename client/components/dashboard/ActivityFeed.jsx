import { useMemo } from 'react';
import useExpenses from '../../hooks/useExpenses.js';
import useAuth from '../../hooks/useAuth.js';
import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getPersonName } from '../../utils/personUtils.js';

const ACTION_ICONS = {
  created: '➕',
  updated: '✏️',
  deleted: '🗑️',
  settled: '✅',
  split_changed: '🔄',
  payer_added: '💰',
  payer_removed: '💸'
};

const ACTION_COLORS = {
  created: 'var(--success)',
  updated: 'var(--primary)',
  deleted: 'var(--danger)',
  settled: 'var(--success)',
  split_changed: 'var(--warning)',
  payer_added: 'var(--success)',
  payer_removed: 'var(--danger)'
};

const ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  settled: 'Settled',
  split_changed: 'Split Changed',
  payer_added: 'Payer Added',
  payer_removed: 'Payer Removed'
};

export default function ActivityFeed({ groupId = null, limit = 20 }) {
  const { user } = useAuth();
  const { expenses = [], loading } = useExpenses();

  // Extract and sort all audit logs from expenses
  const activities = useMemo(() => {
    const allActivities = [];

    expenses.forEach(expense => {
      // Filter by group if specified
      if (groupId && expense.group?._id !== groupId && expense.group !== groupId) {
        return;
      }

      // Add expense creation activity
      if (expense.createdAt) {
        allActivities.push({
          id: `expense-created-${expense._id}`,
          type: 'expense_created',
          action: 'created',
          expenseId: expense._id,
          expense: expense,
          changedBy: expense.createdBy || expense.paidBy,
          changedAt: new Date(expense.createdAt),
          description: `Created expense: ${expense.description}`,
          amount: expense.amount,
          icon: '➕',
          color: 'var(--success)'
        });
      }

      // Add audit log activities
      if (expense.auditLog && Array.isArray(expense.auditLog)) {
        expense.auditLog.forEach((log, index) => {
          allActivities.push({
            id: `audit-${expense._id}-${index}`,
            type: 'audit_log',
            action: log.action,
            expenseId: expense._id,
            expense: expense,
            changedBy: log.changedBy,
            changedAt: new Date(log.changedAt),
            changes: log.changes,
            previousValues: log.previousValues,
            reason: log.reason,
            description: getActivityDescription(log, expense),
            icon: ACTION_ICONS[log.action] || '📝',
            color: ACTION_COLORS[log.action] || 'var(--text-muted)'
          });
        });
      }

      // Add settlement activities from participants
      if (expense.participants && Array.isArray(expense.participants)) {
        expense.participants.forEach((participant, index) => {
          if (participant.settledAt && participant.status === 'settled') {
            allActivities.push({
              id: `settlement-${expense._id}-${index}`,
              type: 'settlement',
              action: 'settled',
              expenseId: expense._id,
              expense: expense,
              changedBy: participant.userId,
              changedAt: new Date(participant.settledAt),
              description: `Settled payment for: ${expense.description}`,
              amount: participant.amount,
              icon: '✅',
              color: 'var(--success)'
            });
          }
        });
      }
    });

    // Sort by date (most recent first)
    return allActivities
      .sort((a, b) => b.changedAt - a.changedAt)
      .slice(0, limit);
  }, [expenses, groupId, limit]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups = {};

    activities.forEach(activity => {
      const dateKey = formatDateKey(activity.changedAt);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });

    return groups;
  }, [activities]);

  function formatDateKey(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function getActivityDescription(log, expense) {
    const action = log.action;
    const changedByName = getPersonName(log.changedBy, 'Someone');

    switch (action) {
      case 'created':
        return `${changedByName} created this expense`;
      case 'updated':
        const updateDetails = Object.keys(log.changes || {}).join(', ');
        return `${changedByName} updated ${updateDetails || 'details'}`;
      case 'deleted':
        return `${changedByName} deleted this expense${log.reason ? `: ${log.reason}` : ''}`;
      case 'settled':
        return `${changedByName} settled this expense`;
      case 'split_changed':
        return `${changedByName} changed the split type`;
      case 'payer_added':
        return `${changedByName} added a payer`;
      case 'payer_removed':
        return `${changedByName} removed a payer`;
      default:
        return `${changedByName} performed ${action}`;
    }
  }

  function getChangeDetails(activity) {
    if (!activity.changes || Object.keys(activity.changes).length === 0) {
      return null;
    }

    const details = [];
    for (const [field, value] of Object.entries(activity.changes)) {
      const previousValue = activity.previousValues?.[field];
      if (previousValue !== undefined && previousValue !== value) {
        if (field === 'amount') {
          details.push(`Amount: ${formatCurrency(previousValue)} → ${formatCurrency(value)}`);
        } else if (field === 'description') {
          details.push(`Description: "${previousValue}" → "${value}"`);
        } else {
          details.push(`${field}: ${previousValue} → ${value}`);
        }
      }
    }

    return details.length > 0 ? details : null;
  }

  if (loading) {
    return (
      <Card>
        <div className="card-header">
          <h2>Activity Feed</h2>
          <p>Recent actions and changes</p>
        </div>
        <div className="card-content">
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 20 }}>⟳</div>
            Loading activity…
          </div>
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <div className="card-header">
          <h2>Activity Feed</h2>
          <p>Recent actions and changes</p>
        </div>
        <div className="card-content">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            No activity yet — start adding expenses!
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Activity Feed</h2>
            <p>Recent actions and changes</p>
          </div>
          <span className="badge badge-violet">{activities.length} activities</span>
        </div>
      </div>

      <div className="card-content">
        <div className="activity-feed">
          {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
            <div key={dateKey} className="activity-day">
              <div className="activity-date-header">
                <span className="activity-date">{dateKey}</span>
                <span className="activity-count">{dayActivities.length} actions</span>
              </div>

              <div className="activity-list">
                {dayActivities.map((activity) => {
                  const changedByName = getPersonName(activity.changedBy, 'Someone');
                  const changeDetails = getChangeDetails(activity);

                  return (
                    <div key={activity.id} className="activity-item">
                      <div
                        className="activity-icon"
                        style={{ backgroundColor: activity.color }}
                      >
                        {activity.icon}
                      </div>

                      <div className="activity-content">
                        <div className="activity-header">
                          <span className="activity-action">
                            {ACTION_LABELS[activity.action] || activity.action}
                          </span>
                          <span className="activity-time">{formatTime(activity.changedAt)}</span>
                        </div>

                        <p className="activity-description">{activity.description}</p>

                        {activity.amount && (
                          <div className="activity-amount">
                            {formatCurrency(activity.amount)}
                          </div>
                        )}

                        {activity.expense && (
                          <div className="activity-expense">
                            <span className="activity-expense-label">Expense:</span>
                            <span className="activity-expense-name">
                              {activity.expense.description || 'Untitled'}
                            </span>
                            {activity.expense.group?.name && (
                              <span className="activity-expense-group">
                                in {activity.expense.group.name}
                              </span>
                            )}
                          </div>
                        )}

                        {changeDetails && (
                          <div className="activity-changes">
                            {changeDetails.map((detail, index) => (
                              <div key={index} className="activity-change">
                                {detail}
                              </div>
                            ))}
                          </div>
                        )}

                        {activity.reason && (
                          <div className="activity-reason">
                            <span className="activity-reason-label">Reason:</span>
                            <span className="activity-reason-text">{activity.reason}</span>
                          </div>
                        )}

                        <div className="activity-user">
                          <span className="activity-user-label">By:</span>
                          <span className="activity-user-name">{changedByName}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}