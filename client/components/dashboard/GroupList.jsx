import Card from '../ui/Card.jsx';
import GroupCard from './GroupCard.jsx';

/**
 * Group list component
 * @param {object} props - Component props
 * @param {Array} props.groups - Array of groups
 * @param {string|null} props.selectedGroupId - Selected group ID
 * @param {string|null} props.currentUserId - Current user ID
 * @param {function} props.onGroupClick - Group click handler
 * @param {function} props.onGroupEdit - Group edit handler
 * @param {function} props.onGroupAddExpense - Add expense handler
 */
export default function GroupList({ groups, selectedGroupId, currentUserId, onGroupClick, onGroupEdit, onGroupAddExpense }) {
  const isSelectedGroup = (group) => {
    const sourceGroupIds = Array.isArray(group._sourceGroupIds) ? group._sourceGroupIds.map(String) : [];
    return String(selectedGroupId) === String(group.groupKey) || sourceGroupIds.includes(String(selectedGroupId));
  };

  return (
    <Card>
      <div className="card-header">
        <h2>Groups</h2>
        <p>Your active shared circles</p>
      </div>
      <div className="card-content">
        {groups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            No groups yet. Create one to start splitting.
          </div>
        ) : (
          <div className="stack">
            {groups.map((group) => (
              <GroupCard
                key={group.groupKey}
                group={group}
                isSelected={isSelectedGroup(group)}
                currentUserId={currentUserId}
                onClick={() => onGroupClick(group.groupKey)}
                onEdit={onGroupEdit}
                onAddExpense={onGroupAddExpense}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}