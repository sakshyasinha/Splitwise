import Button from '../ui/Button.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { prettifyGroupType } from '../../utils/stringUtils.js';

/**
 * Group card component
 * @param {object} props - Component props
 * @param {object} props.group - Group data
 * @param {boolean} props.isSelected - Whether group is selected
 * @param {function} props.onClick - Click handler
 * @param {function} props.onEdit - Edit handler
 */
export default function GroupCard({ group, isSelected, onClick, onEdit }) {
  return (
    <div
      className="group-card"
      onClick={onClick}
      style={{
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        cursor: 'pointer',
        border: isSelected ? '1px solid var(--primary)' : undefined,
        boxShadow: isSelected ? '0 0 0 3px rgba(74, 144, 226, 0.12)' : undefined,
      }}
    >
      <div className="flex items-center gap-3 justify-between" style={{ width: '100%' }}>
        <div className="flex items-center gap-3">
          <div className="group-emoji">{group.name?.[0]?.toUpperCase() || 'G'}</div>
          <div>
            <div className="group-name">{group.name}</div>
            <div className="group-meta">
              {prettifyGroupType(group.type)} · {group.memberCount || 1} member
              {(group.memberCount || 1) !== 1 ? 's' : ''}
            </div>
            {group.description && (
              <div className="group-description">{group.description}</div>
            )}
          </div>
        </div>
        <div className="text-sm font-syne">
          {group.myTotalDue > 0 ? (
            <span style={{ color: 'var(--danger)' }}>You borrowed {formatCurrency(group.myTotalDue)}</span>
          ) : group.totalDue > 0 ? (
            <span style={{ color: 'var(--success)' }}>You lent {formatCurrency(group.totalDue)}</span>
          ) : (
            <span style={{ color: 'var(--success)' }}>Settled</span>
          )}
        </div>
      </div>
      <div className="mt-2 text-sm muted">Total Spend: {formatCurrency(group.totalSpend)}</div>
      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(group);
          }}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Edit
        </Button>
      </div>
      {group.memberDues.length > 0 && (
        <div className="mt-2 stack">
          {group.memberDues.map((person, index) => (
            <div
              key={`${person.name}-${index}`}
              className="text-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'fit-content' }}
            >
              <span>{person.name}</span>
              <span style={{ color: 'var(--danger)' }}>{formatCurrency(person.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}