import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

/**
 * Dashboard stats grid component
 * @param {object} props - Component props
 * @param {number} props.groupCount - Number of groups
 * @param {number} props.totalLent - Total amount lent
 * @param {number} props.totalOwed - Total amount owed
 * @param {number} props.expenseCount - Number of expenses
 * @param {number} props.totalSpend - Total spend amount
 */
export default function StatsGrid({ groupCount, totalLent, totalOwed, expenseCount, totalSpend }) {
  return (
    <section className="stats-grid">
      <Card className="stat-violet">
        <div className="card-content">
          <div className="metric-icon">👥</div>
          <div className="metric-label">Groups</div>
          <div className="metric">{groupCount}</div>
          <div className="metric-sub">Active shared circles</div>
        </div>
      </Card>
      <Card className="stat-green">
        <div className="card-content">
          <div className="metric-icon">🟢</div>
          <div className="metric-label">You Lent</div>
          <div className="metric" style={{ color: 'var(--success)' }}>{formatCurrency(totalLent)}</div>
          <div className="metric-sub">Others owe you</div>
        </div>
      </Card>
      <Card className="stat-red">
        <div className="card-content">
          <div className="metric-icon">🟠</div>
          <div className="metric-label">You Borrowed</div>
          <div className="metric" style={{ color: 'var(--danger)' }}>{formatCurrency(totalOwed)}</div>
          <div className="metric-sub">Pending dues</div>
        </div>
      </Card>
      <Card className="stat-amber">
        <div className="card-content">
          <div className="metric-icon">🧾</div>
          <div className="metric-label">Expenses</div>
          <div className="metric">{expenseCount}</div>
          <div className="metric-sub">Total spend {formatCurrency(totalSpend)}</div>
        </div>
      </Card>
    </section>
  );
}