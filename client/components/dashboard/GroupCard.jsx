import Button from '../ui/Button.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { prettifyGroupType } from '../../utils/stringUtils.js';

/**
 * Group card component
 * @param {object} props - Component props
 * @param {object} props.group - Group data
 * @param {boolean} props.isSelected - Whether group is selected
 * @param {string|null} props.currentUserId - Current user ID
 * @param {function} props.onClick - Click handler
 * @param {function} props.onEdit - Edit handler
 * @param {function} props.onAddExpense - Add expense handler
 */
export default function GroupCard({ group, isSelected, currentUserId, onClick, onEdit, onAddExpense }) {
  const creatorId = Array.isArray(group.createdBy)
    ? group.createdBy[0]?._id || group.createdBy[0]?.id || group.createdBy[0]
    : group.createdBy?._id || group.createdBy?.id || group.createdBy;
  const canEdit = Boolean(currentUserId) && String(creatorId || '') === String(currentUserId);

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
          {Number(group.netBalance || 0) < 0 ? (
            <span style={{ color: 'var(--danger)' }}>You borrowed {formatCurrency(Math.abs(Number(group.netBalance || 0)))}</span>
          ) : Number(group.netBalance || 0) > 0 ? (
            <span style={{ color: 'var(--success)' }}>You lent {formatCurrency(Number(group.netBalance || 0))}</span>
          ) : (
            <span style={{ color: 'var(--success)' }}>Settled</span>
          )}
        </div>
      </div>
      <div className="mt-2 text-sm muted">Total Spend: {formatCurrency(group.totalSpend)}</div>
      <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => onAddExpense(group._sourceGroupIds?.[0] || group._id || group.groupKey)}
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          Add Expense
        </Button>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onEdit(group)}
            style={{ padding: '4px 8px', fontSize: '12px' }}
          >
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}