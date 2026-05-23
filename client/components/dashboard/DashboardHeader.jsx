import ThemeToggle from '../ui/ThemeToggle.jsx';
import { NavLink } from 'react-router-dom';

/**
 * Dashboard header component
 * @param {object} props - Component props
 * @param {function} props.onLogout - Logout handler
 * @param {function} props.onNotificationClick - Notification click handler
 * @param {number} props.notificationCount - Unread notification count
 * @param {object} props.user - Current authenticated user
 */
export default function DashboardHeader({
  user,
  onLogout,
  onNotificationClick,
  notificationCount = 0,
  searchQuery = '',
  onSearchChange,
}) {
  const userEmail = String(user?.email || '').trim();
  const emailName = userEmail.split('@')[0] || 'User';
  const profileInitials = emailName
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || emailName.slice(0, 2).toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">S</div>
        <div>
          <div className="topbar-title">SplitSense</div>
        </div>
      </div>
      <nav className="topbar-nav" aria-label="Dashboard navigation">
        <NavLink className={({ isActive }) => `topbar-nav-link${isActive ? ' active' : ''}`} to="/dashboard">
          Dashboard
        </NavLink>
        <NavLink className={({ isActive }) => `topbar-nav-link${isActive ? ' active' : ''}`} to="/groups">
          Groups
        </NavLink>
        <NavLink className={({ isActive }) => `topbar-nav-link${isActive ? ' active' : ''}`} to="/activity">
          Activity
        </NavLink>
        <NavLink className={({ isActive }) => `topbar-nav-link${isActive ? ' active' : ''}`} to="/analytics">
          Analytics
        </NavLink>
      </nav>
      <label className="topbar-search" aria-label="Search">
        <span>⌕</span>
        <input
          type="search"
          placeholder="Search groups, expenses, people..."
          value={searchQuery}
          onChange={(event) => onSearchChange?.(event.target.value)}
        />
      </label>
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
        <div className="profile-picture" aria-label="User menu" role="button" tabIndex={0}>
          <span className="profile-initials">{profileInitials}</span>
          <span className="profile-name">{emailName}</span>
          <div className="profile-dropdown" role="menu" aria-label="Profile actions">
            <NavLink to="/profile" role="menuitem">My Profile</NavLink>
            <NavLink to="/settings" role="menuitem">Settings</NavLink>
            <NavLink to="/activity" role="menuitem">Activity</NavLink>
            <button type="button" className="profile-logout" onClick={onLogout} role="menuitem">
              Logout
            </button>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
