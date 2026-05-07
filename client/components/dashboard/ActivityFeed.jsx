import { useEffect, useMemo, useState } from 'react';
import { getActivityFeed, markAllActivitiesAsRead } from '../../services/activity.service.js';
import useToast from '../../hooks/useToast.js';
import useAuth from '../../hooks/useAuth.js';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

const ACTIVITY_META = {
  expense_created: { icon: '➕', label: 'Created', color: 'var(--success)' },
  expense_updated: { icon: '✏️', label: 'Updated', color: 'var(--primary)' },
  expense_deleted: { icon: '🗑️', label: 'Deleted', color: 'var(--danger)' },
  expense_settled: { icon: '✅', label: 'Settled', color: 'var(--success)' },
  split_changed: { icon: '🔄', label: 'Split Changed', color: 'var(--warning)' },
  payer_added: { icon: '💰', label: 'Payer Added', color: 'var(--success)' },
  payer_removed: { icon: '💸', label: 'Payer Removed', color: 'var(--danger)' },
  settlement_created: { icon: '🧾', label: 'Settlement Created', color: 'var(--primary)' },
  settlement_completed: { icon: '🏁', label: 'Settlement Completed', color: 'var(--success)' },
};

export default function ActivityFeed({ groupId = null, limit = 20 }) {
  const { user } = useAuth();
  const toast = useToast();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const inlineValueStyle = { marginLeft: 6 };

  function toIdString(value) {
    if (!value) return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      return String(value._id || value.id || value.userId || '');
    }
    return '';
  }

  const currentUserId = toIdString(user?._id || user?.id || user);

  function parseAmount(value) {
    if (value == null || value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const normalizedValue = String(value).replace(/[^\d.-]/g, '').trim();
    if (!normalizedValue || normalizedValue === '-' || normalizedValue === '.' || normalizedValue === '-.') {
      return null;
    }

    const numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  function extractAmountFromDescription(description) {
    if (!description) return null;

    const rupeeMatch = String(description).match(/₹\s*([\d,]+(?:\.\d+)?)/);
    if (rupeeMatch?.[1]) {
      const parsed = parseAmount(rupeeMatch[1]);
      if (parsed != null) {
        return parsed;
      }
    }

    return null;
  }

  const loadActivities = async ({ silent = false } = {}) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      setError('');

      const data = await getActivityFeed({
        limit,
        ...(groupId ? { groupId } : {}),
      });

      setActivities(Array.isArray(data?.activities) ? data.activities : []);
    } catch (activityError) {
      const message = activityError?.response?.data?.message || activityError.message || 'Failed to load activity feed';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [groupId, limit]);

  const unreadActivities = useMemo(() => activities.filter((activity) => !activity.isRead), [activities]);
  const visibleActivities = unreadActivities;

  const handleMarkAllRead = async () => {
    if (unreadActivities.length === 0) {
      return;
    }

    try {
      await markAllActivitiesAsRead();
      toast.success('Marked activity feed as read');
      await loadActivities({ silent: true });
    } catch (activityError) {
      const message = activityError?.response?.data?.message || activityError.message || 'Failed to mark activities as read';
      toast.error(message);
    }
  };

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups = {};

    visibleActivities.forEach((activity) => {
      const dateKey = formatDateKey(getActivityDate(activity));
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });

    return groups;
  }, [visibleActivities]);

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
  function getActivityDate(activity) {
    return new Date(activity.changedAt || activity.createdAt || activity.updatedAt || Date.now());
  }

  function getDisplayName(person, fallback = 'Someone') {
    if (!person) return fallback;
    if (typeof person === 'string') return person;
    return person.name || person.description || person.email || fallback;
  }

  function getActivityMeta(activity) {
    return ACTIVITY_META[activity.type] || {
      icon: '📝',
      label: activity.type || 'Activity',
      color: 'var(--text-muted)',
    };
  }

  function getActivityHeadline(activity) {
    return activity?.description || 'Activity updated';
  }

  function getActivitySummary(activity) {
    const parts = [];

    if (activity?.metadata?.expenseDescription) {
      parts.push(activity.metadata.expenseDescription);
    }

    if (activity?.groupId) {
      parts.push(getDisplayName(activity.groupId, 'Personal'));
    }

    return parts.length > 0 ? parts.join(' · ') : null;
  }

  function getActivityDetails(activity) {
    const details = [];
    const expenseAmount =
      parseAmount(activity?.metadata?.expenseAmount) ??
      parseAmount(activity?.metadata?.amount) ??
      extractAmountFromDescription(activity?.description);

    const participantBalances = activity?.metadata?.participantBalances || {};
    const participantShares = activity?.metadata?.participantShares || {};

    const getMappedAmount = (mapObject, id) => {
      if (!id || !mapObject || typeof mapObject !== 'object') {
        return null;
      }

      if (Object.prototype.hasOwnProperty.call(mapObject, id)) {
        return parseAmount(mapObject[id]);
      }

      const matchedKey = Object.keys(mapObject).find((key) => String(key) === String(id));
      return matchedKey ? parseAmount(mapObject[matchedKey]) : null;
    };

    const viewerBalance = getMappedAmount(participantBalances, currentUserId);
    let viewerShareAmount = getMappedAmount(participantShares, currentUserId);
    const settlementAmount = parseAmount(activity?.metadata?.settlementAmount);
    const actorId = toIdString(activity?.userId);
    const isViewerActor = currentUserId && actorId && currentUserId === actorId;

    if (viewerShareAmount == null && !isViewerActor && activity?.metadata?.splitType === 'equal' && expenseAmount != null) {
      const participantCount = (Array.isArray(activity?.mentionedUsers) ? activity.mentionedUsers.length : 0) + 1;
      if (participantCount > 1) {
        viewerShareAmount = expenseAmount / participantCount;
      }
    }

    if (viewerBalance != null && viewerBalance < 0) {
      details.push({ label: 'You owe', value: formatCurrency(Math.abs(viewerBalance)) });
    } else if (viewerBalance != null && viewerBalance > 0) {
      details.push({ label: 'You are owed', value: formatCurrency(viewerBalance) });
    } else if (viewerShareAmount != null && viewerShareAmount > 0) {
      details.push({ label: 'Your share', value: formatCurrency(viewerShareAmount) });
    } else if (expenseAmount != null) {
      details.push({ label: 'Amount', value: formatCurrency(expenseAmount) });
    }

    if (settlementAmount != null) {
      details.push({ label: 'Settlement', value: formatCurrency(settlementAmount) });
    }

    if (activity?.expenseId) {
      details.push({ label: 'Expense', value: getDisplayName(activity.expenseId, 'Untitled') });
    }

    if (activity?.reason) {
      details.push({ label: 'Reason', value: activity.reason });
    }

    return details;
  }

  if (loading) {
    return (
      <Card>
        <div className="card-header">
          <div className="activity-feed-titleblock">
            <h2>Activity Feed</h2>
            <p>Recent actions and changes</p>
          </div>
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

  if (error) {
    return (
      <Card>
        <div className="card-header">
          <div className="activity-feed-header">
            <div className="activity-feed-titleblock">
              <h2>Activity Feed</h2>
              <p>Recent actions and changes</p>
            </div>
            <Button variant="secondary" onClick={() => loadActivities({ silent: false })} disabled={refreshing}>
              Retry
            </Button>
          </div>
        </div>
        <div className="card-content">
          <div className="empty-state">{error}</div>
        </div>
      </Card>
    );
  }

  if (activities.length === 0) {
    return (
      <Card>
        <div className="card-header">
          <div className="activity-feed-header">
            <div className="activity-feed-titleblock">
              <h2>Activity Feed</h2>
              <p>Recent actions and changes</p>
            </div>
            <Button variant="secondary" onClick={() => loadActivities({ silent: false })} disabled={refreshing}>
              Refresh
            </Button>
          </div>
        </div>
        <div className="card-content">
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            No activity yet — start adding expenses or settlements!
          </div>
        </div>
      </Card>
    );
  }

  if (visibleActivities.length === 0) {
    return (
      <Card>
        <div className="card-header">
          <div className="activity-feed-header">
            <div className="activity-feed-titleblock">
              <h2>Activity Feed</h2>
              <p>Recent actions and changes</p>
            </div>
            <Button variant="secondary" onClick={() => loadActivities({ silent: false })} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
        <div className="card-content">
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            All caught up. No unread activity right now.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="card-header">
        <div className="activity-feed-header">
          <div className="activity-feed-titleblock">
            <h2>Activity Feed</h2>
            <p>Recent actions and changes</p>
          </div>
          <div className="activity-feed-actions">
            <span className="badge badge-violet">{visibleActivities.length} {visibleActivities.length === 1 ? 'activity' : 'activities'}</span>
            <Button variant="secondary" onClick={() => loadActivities({ silent: false })} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button variant="primary" onClick={handleMarkAllRead} disabled={unreadActivities.length === 0}>
              Mark all read
            </Button>
          </div>
        </div>
      </div>

      <div className="card-content">
        <div className="activity-feed">
          {Object.entries(groupedActivities).map(([dateKey, dayActivities]) => (
            <div key={dateKey} className="activity-day">
              <div className="activity-date-header">
                <span className="activity-date">{dateKey}</span>
                <span className="activity-count">{dayActivities.length} {dayActivities.length === 1 ? 'action' : 'actions'}</span>
              </div>

              <div className="activity-list">
                {dayActivities.map((activity) => {
                  const changedByName = getDisplayName(activity.userId, 'Someone');
                  const meta = getActivityMeta(activity);
                  const activityDate = getActivityDate(activity);
                  const activitySummary = getActivitySummary(activity);
                  const activityDetails = getActivityDetails(activity);
                  const unread = !activity.isRead;

                  return (
                    <div key={activity._id} className={`activity-item ${unread ? 'activity-item-unread' : ''}`.trim()}>
                      <div className="activity-icon" style={{ backgroundColor: meta.color }}>
                        <span>{meta.icon}</span>
                      </div>

                      <div className="activity-content">
                        <div className="activity-header">
                          <span className="activity-action">{meta.label}</span>
                          <span className="activity-time">{formatTime(activityDate)}</span>
                        </div>

                        <p className="activity-description">{getActivityHeadline(activity)}</p>

                        {activitySummary && <div className="activity-summary">{activitySummary}</div>}

                        {activityDetails.length > 0 && (
                          <div className="activity-meta-grid">
                            {activityDetails.map((detail) => (
                              <div key={`${activity._id}-${detail.label}`} className="activity-meta-chip">
                                <span className="activity-meta-label">{detail.label}</span>
                                <span className="activity-meta-value">{detail.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="activity-footer">
                          <div className="activity-user">
                            <span className="activity-user-label">By</span>
                            <span className="activity-user-name" style={inlineValueStyle}>{changedByName}</span>
                          </div>

                          {unread && <span className="badge badge-green">Unread</span>}
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