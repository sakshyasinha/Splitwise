/**
 * Dashboard hero strip component
 * @param {object} props - Component props
 * @param {number} props.pendingDuesCount - Number of pending dues
 * @param {number} props.pendingReceivablesCount - Number of pending receivables
 */
import { formatCurrency } from '../../utils/formatCurrency.js';

export default function HeroStrip({ pendingDuesCount, pendingReceivablesCount = 0, totalSpend = 0, totalOwed = 0, totalLent = 0 }) {
  const isSettled = pendingDuesCount === 0 && pendingReceivablesCount === 0;
  const pendingTotal = pendingDuesCount + pendingReceivablesCount;

  return (
    <section className="hero-strip">
      <div className="hero-copy">
        <h1>Shared finances,&nbsp;without the chaos.</h1>
        <p>Track expenses, settle smarter, and keep friendships healthy.</p>
        <span className="due-pill">
          {isSettled
            ? 'All dues settled'
            : `${pendingTotal} pending item${pendingTotal !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="hero-summary-card" aria-label="Current balance overview">
        <div className="hero-summary-item">
          <span>Total Spend</span>
          <strong>{formatCurrency(totalSpend)}</strong>
        </div>
        <div className="hero-summary-item">
          <span>You Owe</span>
          <strong className="danger">{formatCurrency(totalOwed)}</strong>
        </div>
        <div className="hero-summary-item">
          <span>You Are Owed</span>
          <strong className="success">{formatCurrency(totalLent)}</strong>
        </div>
      </div>
    </section>
  );
}
