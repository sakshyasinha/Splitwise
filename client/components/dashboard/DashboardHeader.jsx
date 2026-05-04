import Button from '../ui/Button.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

/**
 * Dashboard header component
 * @param {object} props - Component props
 * @param {function} props.onLogout - Logout handler
 */
export default function DashboardHeader({ onLogout }) {
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
        <ThemeToggle />
        <Button variant="ghost" onClick={onLogout}>
          Sign out →
        </Button>
      </div>
    </header>
  );
}