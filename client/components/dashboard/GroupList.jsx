import Card from '../ui/Card.jsx';
import GroupCard from './GroupCard.jsx';

/**
 * Group list component
 * @param {object} props - Component props
 * @param {Array} props.groups - Array of groups
 * @param {string|null} props.selectedGroupId - Selected group ID
 * @param {function} props.onGroupClick - Group click handler
 * @param {function} props.onGroupEdit - Group edit handler
 */
export default function GroupList({ groups, selectedGroupId, onGroupClick, onGroupEdit }) {
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
                isSelected={String(selectedGroupId) === String(group.groupKey)}
                onClick={() => onGroupClick(group.groupKey)}
                onEdit={onGroupEdit}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}