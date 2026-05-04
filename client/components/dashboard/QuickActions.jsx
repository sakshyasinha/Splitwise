import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

/**
 * Quick actions panel component
 * @param {object} props - Component props
 * @param {function} props.onCreateGroup - Create group handler
 * @param {function} props.onAddExpense - Add expense handler
 */
export default function QuickActions({ onCreateGroup, onAddExpense }) {
  return (
    <Card>
      <div className="card-header">
        <h2>Quick Actions</h2>
        <p>Open focused modals and avoid long scroll forms</p>
      </div>
      <div className="card-content quick-actions-panel">
        <Button type="button" onClick={onCreateGroup}>
          + Create Group
        </Button>
        <Button type="button" variant="ghost" onClick={onAddExpense}>
          + Add Expense
        </Button>
        <div className="quick-actions-hints">
          <span className="badge badge-green">Lent is Green</span>
          <span className="badge badge-red">Borrowed is Red-Orange</span>
        </div>
      </div>
    </Card>
  );
}