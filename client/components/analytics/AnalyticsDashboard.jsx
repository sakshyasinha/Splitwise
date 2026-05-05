import { useState, useEffect } from 'react';
import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import API from '../../services/api.js';
import '../../styles/analytics.css';

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

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

      <OverviewStats overview={analytics.overview} />
      <SpendingTrends spending={analytics.spending} trends={analytics.trends} />
      <CategoryBreakdown categories={analytics.categories} />
      <GroupAnalytics groups={analytics.groups} />
      <RelationshipAnalytics relationships={analytics.relationships} />
      <TimeDistribution timeDistribution={analytics.timeDistribution} />
    </div>
  );
};

const OverviewStats = ({ overview }) => (
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
        <div className="stat-value">{formatCurrency(overview.totalOwed)}</div>
      </div>
      <div className="stat-item negative">
        <div className="stat-label">You Owe</div>
        <div className="stat-value">{formatCurrency(overview.totalOwe)}</div>
      </div>
      <div className="stat-item">
        <div className="stat-label">Net Balance</div>
        <div className={`stat-value ${overview.netBalance >= 0 ? 'positive' : 'negative'}`}>
          {formatCurrency(overview.netBalance)}
        </div>
      </div>
    </div>
  </Card>
);

const SpendingTrends = ({ spending = {}, trends = {} }) => {
  const trend = trends.trend || 'stable';
  const changePercent = Number(trends.changePercent ?? 0);
  const byMonth = spending.byMonth || {};
  const sortedMonths = Object.keys(byMonth).sort();
  const maxMonthlyAmount = Math.max(...Object.values(byMonth).map((amount) => Number(amount) || 0), 0);

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

          {/* Line path */}
          {sortedMonths.length > 1 && (
            <path
              d={sortedMonths.map((month, index) => {
                const amount = byMonth[month];
                const x = (index / (sortedMonths.length - 1)) * 100;
                const y = 60 - (amount / maxMonthlyAmount) * 55 - 2;
                return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ')}
              fill="none"
              stroke="#4CAF50"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {sortedMonths.map((month, index) => {
            const amount = byMonth[month];
            const x = sortedMonths.length > 1
              ? (index / (sortedMonths.length - 1)) * 100
              : 50;
            const y = 60 - (amount / maxMonthlyAmount) * 55 - 2;

            return (
              <g key={month}>
                <circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#4CAF50"
                  stroke="#fff"
                  strokeWidth="1"
                />
                <title>{month}: {formatCurrency(amount)}</title>
              </g>
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="chart-labels">
          {sortedMonths.map((month, index) => {
            const x = sortedMonths.length > 1
              ? (index / (sortedMonths.length - 1)) * 100
              : 50;
            return (
              <div
                key={month}
                className="chart-label"
                style={{ left: `${x}%` }}
              >
                {month}
              </div>
            );
          })}
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

  if (Object.keys(byHour).length === 0 && Object.keys(byDayOfWeek).length === 0) {
    return null;
  }

  return (
    <Card className="time-distribution">
      <h3>Time Distribution</h3>
      <div className="time-sections">
        {Object.keys(byHour).length > 0 && (
          <div className="time-section">
            <h4>By Hour of Day</h4>
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