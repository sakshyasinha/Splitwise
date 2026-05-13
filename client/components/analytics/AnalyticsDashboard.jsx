import { useState, useEffect } from 'react';
import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import API from '../../services/api.js';
import '../../styles/analytics.css';

const AnalyticsDashboard = ({ refreshKey = 0, balanceSnapshot = null }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange, refreshKey]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await API.get('/analytics/user', {
        params: { days: timeRange },
      });
      const data = response.data;
      setAnalytics(data);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="analytics-dashboard">
        <div className="loading-state">Loading analytics...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="analytics-dashboard">
        <div className="error-state">Error: {error}</div>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>Analytics Dashboard</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="time-range-selector"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      <OverviewStats overview={analytics.overview} balanceSnapshot={balanceSnapshot} />
      <SpendingTrends spending={analytics.spending} trends={analytics.trends} />
      <CategoryBreakdown categories={analytics.categories} />
      <GroupAnalytics groups={analytics.groups} />
      <RelationshipAnalytics relationships={analytics.relationships} />
      <TimeDistribution timeDistribution={analytics.timeDistribution} />
    </div>
  );
};


const OverviewStats = ({ overview, balanceSnapshot }) => {
  const owedToYou = Number(balanceSnapshot?.totalLent ?? overview.totalOwed ?? 0);
  const youOwe = Number(balanceSnapshot?.totalOwed ?? overview.totalOwe ?? 0);
  const netBalance = owedToYou - youOwe;

  return (
  <Card className="overview-stats">
    <h3>Overview</h3>
    <div className="stats-grid">
      <div className="stat-item">
        <div className="stat-label">Total Expenses</div>
        <div className="stat-value">{overview.totalExpenses}</div>
      </div>
      <div className="stat-item">
        <div className="stat-label">Total Amount</div>
        <div className="stat-value">{formatCurrency(overview.totalAmount)}</div>
      </div>
      <div className="stat-item">
        <div className="stat-label">Personal</div>
        <div className="stat-value">{formatCurrency(overview.personalTotal)}</div>
        <div className="stat-sub">{overview.personalCount} expenses</div>
      </div>
      <div className="stat-item">
        <div className="stat-label">Shared</div>
        <div className="stat-value">{formatCurrency(overview.sharedTotal)}</div>
        <div className="stat-sub">{overview.sharedCount} expenses</div>
      </div>
      <div className="stat-item positive">
        <div className="stat-label">Owed to You</div>
        <div className="stat-value">{formatCurrency(owedToYou)}</div>
      </div>
      <div className="stat-item negative">
        <div className="stat-label">You Owe</div>
        <div className="stat-value">{formatCurrency(youOwe)}</div>
      </div>
      <div className="stat-item">
        <div className="stat-label">Net Balance</div>
        <div className={`stat-value ${netBalance >= 0 ? 'positive' : 'negative'}`}>
          {formatCurrency(netBalance)}
        </div>
      </div>
    </div>
  </Card>
  );
};

const SpendingTrends = ({ spending = {}, trends = {} }) => {
  const trend = trends.trend || 'stable';
  const changePercent = Number(trends.changePercent ?? 0);
  const byMonth = spending.byMonth || {};
  const sortedMonths = Object.keys(byMonth).sort();
  const maxMonthlyAmount = Math.max(...Object.values(byMonth).map((amount) => Number(amount) || 0), 0);
  const normalizedMonthlyPoints = sortedMonths.map((month, index) => {
    const amount = Number(byMonth[month]) || 0;
    const x = sortedMonths.length > 1
      ? (index / (sortedMonths.length - 1)) * 100
      : 50;
    const y = maxMonthlyAmount > 0 ? 60 - (amount / maxMonthlyAmount) * 46 - 8 : 48;

    return { month, amount, x, y };
  });


const AnalyticsIntro = ({ overview, trends }) => {
  const netBalance = Number(overview?.netBalance || 0);
  const trendLabel = trends?.trend === 'increasing' ? 'Increasing' : trends?.trend === 'decreasing' ? 'Decreasing' : 'Stable';

  return (
    <section className="analytics-intro">
      <div className="analytics-intro-copy">
        <div className="analytics-intro-kicker">Insight snapshot</div>
        <h3>What changed in this window</h3>
        <p>
          This view condenses the last few days into the few signals that matter most: total spend, shared spend, and whether you are net positive or negative.
        </p>
      </div>

      <div className="analytics-intro-metrics" aria-label="Analytics summary">
        <div className="intro-pill">
          <span className="intro-pill-label">Spend</span>
          <span className="intro-pill-value">{formatCurrency(overview.totalAmount)}</span>
        </div>
        <div className="intro-pill">
          <span className="intro-pill-label">Shared</span>
          <span className="intro-pill-value">{formatCurrency(overview.sharedTotal)}</span>
        </div>
        <div className="intro-pill">
          <span className="intro-pill-label">Net</span>
          <span className={`intro-pill-value ${netBalance >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(netBalance)}
          </span>
        </div>
        <div className="intro-pill intro-pill-quiet">
          <span className="intro-pill-label">Trend</span>
          <span className="intro-pill-value">{trendLabel}</span>
        </div>
      </div>
    </section>
  );
};
  const linePath = normalizedMonthlyPoints.length > 1
    ? normalizedMonthlyPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : '';

  const areaPath = normalizedMonthlyPoints.length > 0
    ? [
        `M ${normalizedMonthlyPoints[0].x} 60`,
        `L ${normalizedMonthlyPoints[0].x} ${normalizedMonthlyPoints[0].y}`,
        ...normalizedMonthlyPoints.slice(1).map((point) => `L ${point.x} ${point.y}`),
        `L ${normalizedMonthlyPoints[normalizedMonthlyPoints.length - 1].x} 60`,
        'Z'
      ].join(' ')
    : '';

  return (
    <Card className="spending-trends">
      <h3>Spending Trends</h3>
      <div className="trend-info">
        <div className="trend-indicator">
          <span className={`trend-icon ${trend}`}>
            {trend === 'increasing' ? '📈' : trend === 'decreasing' ? '📉' : '➡️'}
          </span>
          <span className="trend-text">
            {trend === 'increasing' ? 'Increasing' : trend === 'decreasing' ? 'Decreasing' : 'Stable'}
          </span>
          <span className="trend-change">
            ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
          </span>
        </div>
        <div className="average-spending">
          <span className="average-label">Monthly Average:</span>
          <span className="average-value">{formatCurrency(spending.average?.monthly || 0)}</span>
        </div>
      </div>

      <div className="monthly-chart">
        <div className="chart-glow" aria-hidden="true" />
        <svg className="line-chart" viewBox="0 0 100 60" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              y1={60 - ratio * 60}
              x2="100"
              y2={60 - ratio * 60}
              stroke="#e0e0e0"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
          ))}

          {areaPath && (
            <path
              d={areaPath}
              fill="url(#trendAreaFill)"
              stroke="none"
            />
          )}

          {/* Line path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {normalizedMonthlyPoints.map((point) => (
            <g key={point.month}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.3"
                  fill="var(--card)"
                  stroke="var(--primary)"
                  strokeWidth="1.6"
                />
                <title>{point.month}: {formatCurrency(point.amount)}</title>
              </g>
          ))}

          <defs>
            <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
        </svg>

        {/* X-axis labels */}
        <div className="chart-labels">
          {normalizedMonthlyPoints.map((point) => (
            <div
              key={point.month}
              className="chart-label"
              style={{ left: `${point.x}%` }}
            >
              {point.month}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

const CategoryBreakdown = ({ categories }) => (
  <Card className="category-breakdown">
    <h3>Category Breakdown</h3>
    <div className="category-list">
      {categories.categories?.map((cat, index) => (
        <div key={cat.category} className="category-item">
          <div className="category-info">
            <div className="category-rank">#{index + 1}</div>
            <div className="category-name">{cat.category}</div>
            <div className="category-percentage">{cat.percentage.toFixed(1)}%</div>
          </div>
          <div className="category-amounts">
            <div className="category-total">{formatCurrency(cat.total)}</div>
            <div className="category-count">{cat.count} expenses</div>
          </div>
          <div className="category-bar">
            <div
              className="category-bar-fill"
              style={{ width: `${cat.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const GroupAnalytics = ({ groups }) => (
  <Card className="group-analytics">
    <h3>Group Analytics</h3>
    <div className="group-list">
      {groups.groups?.map((group, index) => (
        <div key={group.id} className="group-item">
          <div className="group-info">
            <div className="group-rank">#{index + 1}</div>
            <div className="group-name">{group.name}</div>
            <div className="group-type">{group.type}</div>
          </div>
          <div className="group-stats">
            <div className="group-total">{formatCurrency(group.total)}</div>
            <div className="group-count">{group.count} expenses</div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const RelationshipAnalytics = ({ relationships }) => (
  <Card className="relationship-analytics">
    <h3>Relationships</h3>
    <div className="relationship-summary">
      <div className="summary-item">
        <span className="summary-label">Total Relationships:</span>
        <span className="summary-value">{relationships.totalRelationships}</span>
      </div>
      <div className="summary-item positive">
        <span className="summary-label">Total Owed to You:</span>
        <span className="summary-value">{formatCurrency(relationships.totalOwedToMe)}</span>
      </div>
      <div className="summary-item negative">
        <span className="summary-label">Total You Owe:</span>
        <span className="summary-value">{formatCurrency(relationships.totalIOwe)}</span>
      </div>
    </div>

    <div className="relationship-list">
      {relationships.relationships?.map((rel) => (
        <div key={rel.id} className="relationship-item">
          <div className="relationship-info">
            <div className="relationship-name">{rel.name}</div>
            <div className="relationship-count">{rel.expenseCount} expenses</div>
          </div>
          <div className="relationship-balances">
            <div className="balance-item">
              <span className="balance-label">They owe you:</span>
              <span className="balance-value positive">{formatCurrency(rel.totalOwed)}</span>
            </div>
            <div className="balance-item">
              <span className="balance-label">You owe them:</span>
              <span className="balance-value negative">{formatCurrency(rel.totalOwe)}</span>
            </div>
            <div className="balance-item net">
              <span className="balance-label">Net:</span>
              <span className={`balance-value ${rel.netBalance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(rel.netBalance)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </Card>
);

const TimeDistribution = ({ timeDistribution }) => {
  const byHour = timeDistribution.byHour || {};
  const byDayOfWeek = timeDistribution.byDayOfWeek || {};
  const maxHourAmount = Math.max(...Object.values(byHour).map(Number), 0);
  const maxDayAmount = Math.max(...Object.values(byDayOfWeek).map(Number), 0);
  const peakHourAmount = Number(timeDistribution.peakHour?.amount ?? 0) || 0;
  const peakDayAmount = Number(timeDistribution.peakDay?.amount ?? 0) || 0;

  if (Object.keys(byHour).length === 0 && Object.keys(byDayOfWeek).length === 0) {
    return null;
  }

  return (
    <Card className="time-distribution">
      <h3>Time Distribution</h3>
      <div className="distribution-lede">
        When spend happens, at a glance.
      </div>
      <div className="time-sections">
        {Object.keys(byHour).length > 0 && (
          <div className="time-section">
            <h4>By Hour of Day</h4>
            <div className="distribution-summary">
              <div className="distribution-pill">
                <span className="distribution-pill-label">Peak hour</span>
                <span className="distribution-pill-value">
                  {timeDistribution.peakHour?.hour}:00 · {formatCurrency(peakHourAmount)}
                </span>
              </div>
            </div>
            <div className="hour-chart">
              {Object.entries(byHour).map(([hour, amount]) => {
                const numericAmount = Number(amount) || 0;
                const barHeight = maxHourAmount > 0 ? (numericAmount / maxHourAmount) * 100 : 0;

                return (
                  <div key={hour} className="hour-bar">
                    <div
                      className="hour-bar-fill"
                      style={{
                        height: `${Math.min(barHeight, 100)}%`
                      }}
                    />
                    <div className="hour-label">{hour}:00</div>
                  </div>
                );
              })}
            </div>
            {timeDistribution.peakHour && (
              <div className="peak-info">
                Peak: {timeDistribution.peakHour.hour}:00 ({formatCurrency(timeDistribution.peakHour.amount)})
              </div>
            )}
          </div>
        )}

        {Object.keys(byDayOfWeek).length > 0 && (
          <div className="time-section">
            <h4>By Day of Week</h4>
            <div className="distribution-summary">
              <div className="distribution-pill">
                <span className="distribution-pill-label">Peak day</span>
                <span className="distribution-pill-value">
                  {timeDistribution.peakDay?.day} · {formatCurrency(peakDayAmount)}
                </span>
              </div>
            </div>
            <div className="day-chart">
              {Object.entries(byDayOfWeek).map(([day, amount]) => {
                const numericAmount = Number(amount) || 0;
                const barHeight = maxDayAmount > 0 ? (numericAmount / maxDayAmount) * 100 : 0;

                return (
                  <div key={day} className="day-bar">
                    <div
                      className="day-bar-fill"
                      style={{
                        height: `${Math.min(barHeight, 100)}%`
                      }}
                    />
                    <div className="day-label">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}
                    </div>
                  </div>
                );
              })}
            </div>
            {timeDistribution.peakDay && (
              <div className="peak-info">
                Peak: {timeDistribution.peakDay.day} ({formatCurrency(timeDistribution.peakDay.amount)})
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default AnalyticsDashboard;