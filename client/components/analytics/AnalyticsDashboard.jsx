import { useState, useEffect } from 'react';
import Card from '../ui/Card.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';

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
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/analytics/user?days=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
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
      <SpendingTrends spending={analytics.spending} />
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

const SpendingTrends = ({ spending }) => (
  <Card className="spending-trends">
    <h3>Spending Trends</h3>
    <div className="trend-info">
      <div className="trend-indicator">
        <span className={`trend-icon ${spending.trend}`}>
          {spending.trend === 'increasing' ? '📈' : spending.trend === 'decreasing' ? '📉' : '➡️'}
        </span>
        <span className="trend-text">
          {spending.trend === 'increasing' ? 'Increasing' : spending.trend === 'decreasing' ? 'Decreasing' : 'Stable'}
        </span>
        <span className="trend-change">
          ({spending.changePercent >= 0 ? '+' : ''}{spending.changePercent.toFixed(1)}%)
        </span>
      </div>
      <div className="average-spending">
        <span className="average-label">Monthly Average:</span>
        <span className="average-value">{formatCurrency(spending.average?.monthly || 0)}</span>
      </div>
    </div>

    <div className="monthly-chart">
      {Object.entries(spending.byMonth || {}).map(([month, amount]) => (
        <div key={month} className="month-bar">
          <div className="bar-container">
            <div
              className="bar"
              style={{
                height: `${Math.min((amount / Math.max(...Object.values(spending.byMonth))) * 100, 100)}%`
              }}
            />
          </div>
          <div className="month-label">{month}</div>
          <div className="amount-label">{formatCurrency(amount)}</div>
        </div>
      ))}
    </div>
  </Card>
);

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

const TimeDistribution = ({ timeDistribution }) => (
  <Card className="time-distribution">
    <h3>Time Distribution</h3>
    <div className="time-sections">
      <div className="time-section">
        <h4>By Hour of Day</h4>
        <div className="hour-chart">
          {Object.entries(timeDistribution.byHour || {}).map(([hour, amount]) => (
            <div key={hour} className="hour-bar">
              <div
                className="hour-bar-fill"
                style={{
                  height: `${Math.min((amount / Math.max(...Object.values(timeDistribution.byHour))) * 100, 100)}%`
                }}
              />
              <div className="hour-label">{hour}:00</div>
            </div>
          ))}
        </div>
        {timeDistribution.peakHour && (
          <div className="peak-info">
            Peak: {timeDistribution.peakHour.hour}:00 ({formatCurrency(timeDistribution.peakHour.amount)})
          </div>
        )}
      </div>

      <div className="time-section">
        <h4>By Day of Week</h4>
        <div className="day-chart">
          {Object.entries(timeDistribution.byDayOfWeek || {}).map(([day, amount]) => (
            <div key={day} className="day-bar">
              <div
                className="day-bar-fill"
                style={{
                  height: `${Math.min((amount / Math.max(...Object.values(timeDistribution.byDayOfWeek))) * 100, 100)}%`
                }}
              />
              <div className="day-label">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}
              </div>
            </div>
          ))}
        </div>
        {timeDistribution.peakDay && (
          <div className="peak-info">
            Peak: {timeDistribution.peakDay.day} ({formatCurrency(timeDistribution.peakDay.amount)})
          </div>
        )}
      </div>
    </div>
  </Card>
);

export default AnalyticsDashboard;