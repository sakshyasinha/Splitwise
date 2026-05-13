import Button from '../ui/Button.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

/**
 * Dashboard header component
 * @param {object} props - Component props
 * @param {function} props.onLogout - Logout handler
 * @param {function} props.onNotificationClick - Notification click handler
 * @param {number} props.notificationCount - Unread notification count
 */
export default function DashboardHeader({ onLogout, onNotificationClick, notificationCount = 0 }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">SS</div>
        <div>
          <div className="topbar-title">SplitSense</div>
          <div className="topbar-sub">Money clarity for your group life</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="notification-button"
          onClick={onNotificationClick}
          aria-label={`Open notifications${notificationCount > 0 ? ` (${notificationCount} unread)` : ''}`}
        >
          <span className="notification-icon">🔔</span>
          {notificationCount > 0 ? <span className="notification-count">{notificationCount}</span> : null}
        </button>
        <ThemeToggle />
        <Button variant="secondary" onClick={onLogout}>
          Sign out →
        </Button>
      </div>
    </header>
  );
}