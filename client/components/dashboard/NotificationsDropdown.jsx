import { useEffect, useRef, useMemo, useState } from 'react';
import { getActivityFeed, markActivitiesAsRead, markAllActivitiesAsRead, getUnreadNotificationCount } from '../../services/activity.service.js';
import useToast from '../../hooks/useToast.js';
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
  if (activity?.type === 'settlement_created' || activity?.type === 'settlement_completed') {
    const amount = activity?.metadata?.settlementAmount;
    if (amount) {
      return activity.type === 'settlement_created' ? `₹${amount} sent` : `₹${amount} transferred`;
    }
  }

  return activity.description || 'Something changed in your account.';
}

export default function NotificationsDropdown({ onClose, onUnreadCountChange }) {
  const toast = useToast();
  const dropdownRef = useRef(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadNotifications = useMemo(
    () => activities.filter((activity) => !activity.isRead),
    [activities]
  );

  const loadNotifications = async ({ silent = false } = {}) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      const data = await getActivityFeed({ limit: 12, unreadOnly: true });
      const items = Array.isArray(data?.activities) ? data.activities : [];
      setActivities(items);
      // Use the dedicated unread-count endpoint to avoid mismatches
      try {
        const unreadData = await getUnreadNotificationCount();
        onUnreadCountChange?.(Number(unreadData?.count ?? data?.total ?? items.length ?? 0));
      } catch (countErr) {
        // Fallback to feed total if unread-count endpoint fails
        onUnreadCountChange?.(Number(data?.total ?? items.length ?? 0));
      }
    } catch (notificationError) {
      toast.error(notificationError?.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshNotifications = () => {
    loadNotifications({ silent: true });
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(refreshNotifications, 15000);

    const handleNotificationsUpdated = () => {
      refreshNotifications();
    };

    window.addEventListener('splitwise:notifications-updated', handleNotificationsUpdated);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('splitwise:notifications-updated', handleNotificationsUpdated);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleMarkAllRead = async () => {
    if (unreadNotifications.length === 0) {
      onUnreadCountChange?.(0);
      return;
    }

    try {
      await markAllActivitiesAsRead();
      toast.success('Notifications marked as read');
      onUnreadCountChange?.(0);
      await loadNotifications({ silent: true });
    } catch (notificationError) {
      toast.error(notificationError?.response?.data?.message || 'Failed to mark notifications as read');
    }
  };

  const handleMarkOneRead = async (activityId) => {
    try {
      await markActivitiesAsRead([activityId]);
      toast.success('Notification marked as read');
      onUnreadCountChange?.(Math.max(unreadNotifications.length - 1, 0));
      window.dispatchEvent(new Event('splitwise:notifications-updated'));
    } catch (notificationError) {
      toast.error(notificationError?.response?.data?.message || 'Failed to mark notification as read');
    }
  };

  if (loading) {
    return (
      <div ref={dropdownRef} className="notifications-dropdown">
        <div className="notifications-dropdown-content">
          <div className="notification-loading">⟳ Loading…</div>
        </div>
      </div>
    );
  }

  if (unreadNotifications.length === 0) {
    return (
      <div ref={dropdownRef} className="notifications-dropdown">
        <div className="notifications-dropdown-content">
          <div className="notification-empty">
            <div className="empty-icon"></div>
            <div>You are all caught up</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="notifications-dropdown">
      <div className="notifications-dropdown-header">
        <span className="notifications-count">{unreadNotifications.length} unread</span>
      </div>

      <div className="notifications-dropdown-content">
        <div className="notification-list">
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
                    <span className="notification-item-time">{formatTime(activityDate)}</span>
                  </div>
                  <p className="notification-item-text">{getNotificationText(activity)}</p>
                  {summary ? <div className="notification-item-summary">{summary}</div> : null}
                  <div style={{ marginTop: 8 }}>
                    <Button
                      variant="secondary"
                      onClick={() => handleMarkOneRead(activity._id)}
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                    >
                      Mark read
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="notifications-dropdown-footer">
        <Button
          variant="secondary"
          onClick={() => loadNotifications({ silent: true })}
          disabled={refreshing}
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
        <Button
          variant="primary"
          onClick={handleMarkAllRead}
          disabled={unreadNotifications.length === 0}
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          Mark all read
        </Button>
      </div>
    </div>
  );
}
