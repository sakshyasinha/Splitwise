/**
 * Dashboard hero strip component
 * @param {object} props - Component props
 * @param {number} props.pendingDuesCount - Number of pending dues
 */
export default function HeroStrip({ pendingDuesCount }) {
  return (
    <section className="hero-strip">
      <div>
        <h1>Your shared finances,&nbsp;at a glance.</h1>
        <p>Shared money is less stressful when everyone sees the same truth.</p>
      </div>
      <span className="due-pill">
        {pendingDuesCount === 0
          ? '✓ All dues settled'
          : `${pendingDuesCount} pending due${pendingDuesCount !== 1 ? 's' : ''}`}
      </span>
    </section>
  );
}