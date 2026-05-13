import { useEffect, useMemo, useState } from 'react';
import { getActivityFeed, markAllActivitiesAsRead, markActivitiesAsRead } from '../../services/activity.service.js';
import useToast from '../../hooks/useToast.js';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';

const ACTIVITY_META = {
  expense_created: { icon: '➕', label: 'Created' },
  expense_updated: { icon: '✏️', label: 'Updated' },
  expense_deleted: { icon: '🗑️', label: 'Deleted' },
  expense_settled: { icon: '✅', label: 'Settled' },
  split_changed: { icon: '🔄', label: 'Split changed' },
  payer_added: { icon: '💰', label: 'Payer added' },
  payer_removed: { icon: '💸', label: 'Payer removed' },
  settlement_created: { icon: '🧾', label: 'Payment sent' },
  settlement_completed: { icon: '🏁', label: 'Payment completed' },
  payment_reminder: { icon: '🔔', label: 'Payment reminder' },
};

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getDisplayName(person, fallback = 'Someone') {
  if (!person) return fallback;
  if (typeof person === 'string') return person;
  return person.name || person.description || person.email || fallback;
}

function getNotificationDate(activity) {
  return new Date(activity.changedAt || activity.createdAt || activity.updatedAt || Date.now());
}

function getNotificationSummary(activity) {
  const parts = [];

  // Handle settlement activities with recipient name
  if (activity?.type === 'settlement_created' || activity?.type === 'settlement_completed') {
    const amount = activity?.metadata?.settlementAmount;
    const toUser = activity?.metadata?.toUser;

    if (amount && toUser) {
      const recipientName = getDisplayName(toUser, 'someone');
      parts.push(`₹${amount} to ${recipientName}`);
    } else if (amount) {
      parts.push(`₹${amount}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  if (activity?.metadata?.expenseDescription) {
    parts.push(activity.metadata.expenseDescription);
  }

  if (activity?.groupId) {
    parts.push(getDisplayName(activity.groupId, 'Personal'));
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

function getNotificationText(activity) {
  // Handle settlement activities with concise description
  if (activity?.type === 'settlement_created' || activity?.type === 'settlement_completed') {
    const amount = activity?.metadata?.settlementAmount;
    if (amount) {
      return activity.type === 'settlement_created' ? `₹${amount} sent` : `₹${amount} transferred`;
    }
  }

  return activity.description || 'Something changed in your account.';
}

export default function NotificationsPanel({ onClose, onUnreadCountChange }) {
  const toast = useToast();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const unreadNotifications = useMemo(
    () => activities.filter((activity) => !activity.isRead),
    [activities]
  );

  const loadNotifications = async ({ silent = false } = {}) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      setError('');

      const data = await getActivityFeed({ limit: 12 });
      const items = Array.isArray(data?.activities) ? data.activities : [];
      const unread = items.filter((activity) => !activity.isRead);
      setActivities(unread);
      return unread;
    } catch (notificationError) {
      const message = notificationError?.response?.data?.message || notificationError.message || 'Failed to load notifications';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    if (unreadNotifications.length === 0) {
      onUnreadCountChange?.(0);
      return;
    }

    try {
      await markAllActivitiesAsRead();
      toast.success('Notifications marked as read');
      const unread = await loadNotifications({ silent: true });
      onUnreadCountChange?.((unread && unread.length) || 0);
    } catch (notificationError) {
      const message = notificationError?.response?.data?.message || notificationError.message || 'Failed to mark notifications as read';
      toast.error(message);
    }
  };

  const handleMarkOneRead = async (activityId) => {
    try {
      await markActivitiesAsRead([activityId]);
      toast.success('Notification marked as read');
      const unread = await loadNotifications({ silent: true });
      onUnreadCountChange?.((unread && unread.length) || 0);
    } catch (notificationError) {
      const message = notificationError?.response?.data?.message || notificationError.message || 'Failed to mark notification as read';
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="card-header">
          <div className="activity-feed-titleblock">
            <h2>Notifications</h2>
            <p>Unread updates and reminders</p>
          </div>
        </div>
        <div className="card-content">
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 20 }}>⟳</div>
            Loading notifications…
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
              <h2>Notifications</h2>
              <p>Unread updates and reminders</p>
            </div>
            <Button variant="secondary" onClick={() => loadNotifications({ silent: false })} disabled={refreshing}>
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

  if (unreadNotifications.length === 0) {
    return (
      <Card>
        <div className="card-header">
          <div className="activity-feed-header">
            <div className="activity-feed-titleblock">
              <h2>Notifications</h2>
              <p>Unread updates and reminders</p>
            </div>
            <Button variant="secondary" onClick={() => loadNotifications({ silent: false })} disabled={refreshing}>
              Refresh
            </Button>
          </div>
        </div>
        <div className="card-content">
          <div className="empty-state">
            <div className="empty-icon">🔔</div>
            You are all caught up.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="notifications-dropdown" role="dialog" aria-label="Notifications">
      <div className="notifications-dropdown-header">
        <div className="activity-feed-titleblock">
          <h2>Notifications</h2>
          <p>Unread updates and reminders</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="notifications-count">{unreadNotifications.length} unread</span>
          <Button variant="secondary" onClick={() => loadNotifications({ silent: false })} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="primary" onClick={handleMarkAllRead} disabled={unreadNotifications.length === 0}>
            Mark all read
          </Button>
        </div>
      </div>

      <div className="notifications-dropdown-content">
        {unreadNotifications.map((activity) => {
          const meta = ACTIVITY_META[activity.type] || { icon: '📝', label: 'Update' };
          const activityDate = getNotificationDate(activity);
          const summary = getNotificationSummary(activity);

          return (
            <div key={activity._id} className="notification-item-dropdown">
              <div className="notification-item-icon">
                <span>{meta.icon}</span>
              </div>
              <div className="notification-item-body">
                <div className="notification-item-toprow">
                  <span className="notification-item-title">{meta.label}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="notification-item-time">{formatTime(activityDate)}</span>
                    <Button variant="ghost" onClick={() => handleMarkOneRead(activity._id)}>
                      Mark read
                    </Button>
                  </div>
                </div>
                <p className="notification-item-text">{getNotificationText(activity)}</p>
                {summary ? <div className="notification-item-summary">{summary}</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="notifications-dropdown-footer">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}