import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useExpenses from '../../hooks/useExpenses.js';
import useAuth from '../../hooks/useAuth.js';
import useToast from '../../hooks/useToast.js';
import Card from '../ui/Card.jsx';
import CategoryIcon from '../ui/CategoryIcon.jsx';
import ChatModal from './ChatModal.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getPersonName } from '../../utils/personUtils.js';

const CATEGORIES = ['Food', 'Travel', 'Events', 'Utilities', 'Shopping', 'General', 'Rent', 'Transport', 'Entertainment', 'Healthcare', 'Education', 'Other'];
const SPLIT_TYPES = ['equal', 'percentage', 'shares', 'itemized', 'adjustment', 'custom', 'payment'];

export default function ExpenseList({ onEdit }) {
  const { user, token } = useAuth();
  const { expenses = [], loading, error, updateExpense, deleteExpense } = useExpenses();
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ description: '', amount: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeExpense, setActiveExpense] = useState(null);
  const [chatInitialUnreadCount, setChatInitialUnreadCount] = useState(0);
  const [unreadByExpense, setUnreadByExpense] = useState({});
  const socketRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());
  const activeChatExpenseIdRef = useRef('');

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSplitType, setSelectedSplitType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);

  // Debug logging to track expenses changes
  console.log('ExpenseList: Current expenses count:', expenses.length);
  console.log('ExpenseList: Expenses:', expenses);

  const canSave = useMemo(
    () => form.description.trim() && Number(form.amount) > 0,
    [form]
  );

  // Filter expenses based on search and filter criteria
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const description = (expense.description || '').toLowerCase();
        const groupName = (expense.group?.name || '').toLowerCase();
        const paidByName = (expense.paidBy?.name || expense.paidBy?.email || '').toLowerCase();

        if (!description.includes(query) && !groupName.includes(query) && !paidByName.includes(query)) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory && expense.category !== selectedCategory) {
        return false;
      }

      // Split type filter
      if (selectedSplitType && expense.splitType !== selectedSplitType) {
        return false;
      }

      // Status filter
      if (selectedStatus) {
        const pendingCount = (expense.participants || []).filter(p => p?.status === 'pending').length;
        const totalParticipants = (expense.participants || []).length;
        const isPersonalExpense = totalParticipants === 1;
        const isPayment = expense.splitType === 'payment';

        if (selectedStatus === 'pending' && (pendingCount === 0 || isPersonalExpense)) {
          return false;
        }
        if (selectedStatus === 'settled' && pendingCount > 0) {
          return false;
        }
        if (selectedStatus === 'personal' && !isPersonalExpense) {
          return false;
        }
        if (selectedStatus === 'payment' && !isPayment) {
          return false;
        }
      }

      // Amount range filter
      const amount = Number(expense.amount) || 0;
      if (amountRange.min && amount < Number(amountRange.min)) {
        return false;
      }
      if (amountRange.max && amount > Number(amountRange.max)) {
        return false;
      }

      // Date range filter
      const expenseDate = new Date(expense.date || expense.createdAt);
      if (dateRange.start && expenseDate < new Date(dateRange.start)) {
        return false;
      }
      if (dateRange.end && expenseDate > new Date(dateRange.end)) {
        return false;
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedSplitType, selectedStatus, amountRange, dateRange]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSplitType('');
    setSelectedStatus('');
    setAmountRange({ min: '', max: '' });
    setDateRange({ start: '', end: '' });
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery || selectedCategory || selectedSplitType || selectedStatus ||
           amountRange.min || amountRange.max || dateRange.start || dateRange.end;
  }, [searchQuery, selectedCategory, selectedSplitType, selectedStatus, amountRange, dateRange]);

  useEffect(() => {
    activeChatExpenseIdRef.current = chatOpen && activeExpense?._id ? String(activeExpense._id) : '';
  }, [chatOpen, activeExpense?._id]);

  useEffect(() => {
    if (!token || socketRef.current) return;

    const socket = io('/messages', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    const onMessageReceived = (message) => {
      const expenseId = String(message?.expenseId || '');
      if (!expenseId) return;
      if (activeChatExpenseIdRef.current === expenseId) return;

      setUnreadByExpense((prev) => ({
        ...prev,
        [expenseId]: (prev[expenseId] || 0) + 1,
      }));
    };

    const onUnreadUpdated = (payload) => {
      try {
        const { expenseId, unreadByUser } = payload || {};
        const userId = String(user?.id || user?._id || '');
        if (!expenseId || !userId) return;
        const count = unreadByUser?.[userId] || 0;
        setUnreadByExpense((prev) => ({ ...prev, [String(expenseId)]: Number(count) }));
      } catch (err) {
        console.error('Failed to handle unread-updated', err);
      }
    };

    socket.on('message-received', onMessageReceived);
    socket.on('unread-updated', onUnreadUpdated);

    return () => {
      socket.off('message-received', onMessageReceived);
      socket.off('unread-updated', onUnreadUpdated);
      socket.disconnect();
      socketRef.current = null;
      joinedRoomsRef.current.clear();
    };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const joined = joinedRoomsRef.current;
    const currentExpenseIds = new Set(
      (expenses || [])
        .map((expense) => String(expense?._id || ''))
        .filter(Boolean)
    );

    currentExpenseIds.forEach((expenseId) => {
      if (!joined.has(expenseId)) {
        socket.emit('join-expense', expenseId);
        joined.add(expenseId);
      }
    });

    Array.from(joined).forEach((expenseId) => {
      if (!currentExpenseIds.has(expenseId)) {
        socket.emit('leave-expense', expenseId);
        joined.delete(expenseId);
      }
    });
  }, [expenses]);

  const openChat = (expense) => {
    const expenseId = String(expense?._id || '');
    const currentUnread = unreadByExpense[expenseId] || 0;
    setChatInitialUnreadCount(currentUnread);
    setActiveExpense(expense);
    setChatOpen(true);
    setUnreadByExpense((prev) => {
      if (!prev[expenseId]) return prev;
      const next = { ...prev };
      delete next[expenseId];
      return next;
    });
  };

  const startEdit = (expense) => {
    setEditingId(expense._id);
    setForm({
      description: expense.description || '',
      amount: String(expense.amount || ''),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ description: '', amount: '' });
  };

  const saveEdit = async (expenseId) => {
    try {
      await updateExpense(expenseId, {
        description: form.description,
        amount: Number(form.amount),
      });
      toast.success('Expense updated successfully');
      cancelEdit();
    } catch (err) {
      toast.error('Failed to update expense');
    }
  };

  const removeExpense = async (expenseId) => {
    try {
      console.log('Deleting expense:', expenseId);
      console.log('Current expenses count:', expenses.length);
      await deleteExpense(expenseId);
      console.log('Delete completed');
      toast.success('Expense deleted successfully');
      if (editingId === expenseId) cancelEdit();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete expense');
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense._id);
    setForm({
      description: expense.description || '',
      amount: String(expense.amount || ''),
    });
    if (onEdit) {
      onEdit(expense);
    }
  };

  return (
    <Card>
      {/* ── HEADER ── */}
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Recent Expenses</h2>
            <p>Add, edit, or delete your entries</p>
          </div>
          <span className="badge badge-violet">{filteredExpenses.length} of {expenses.length} items</span>
        </div>
      </div>

      <div className="card-content">
        {/* ── SEARCH AND FILTER BAR ── */}
        <div style={{ marginBottom: 16 }}>
          {/* Search Input */}
          <div className="input-row" style={{ marginBottom: 12 }}>
            <input
              type="text"
              className="input"
              placeholder="Search expenses by description, group, or person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowFilters(!showFilters)}
              style={{ marginLeft: 8 }}
            >
              {showFilters ? '▲ Filters' : '▼ Filters'}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearFilters}
                style={{ marginLeft: 8, color: 'var(--danger)' }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="card" style={{ padding: 12, marginBottom: 12, border: '1px solid #e0e0e0', borderRadius: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {/* Category Filter */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Category</label>
                  <select
                    className="input"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Split Type Filter */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Split Type</label>
                  <select
                    className="input"
                    value={selectedSplitType}
                    onChange={(e) => setSelectedSplitType(e.target.value)}
                  >
                    <option value="">All Types</option>
                    {SPLIT_TYPES.map(type => (
                      <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Status</label>
                  <select
                    className="input"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="settled">Settled</option>
                    <option value="personal">Personal</option>
                    <option value="payment">Payment</option>
                  </select>
                </div>

                {/* Amount Range Filter */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Amount Range (₹)</label>
                  <div className="input-row">
                    <input
                      type="number"
                      className="input"
                      placeholder="Min"
                      value={amountRange.min}
                      onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value }))}
                      style={{ width: '80px' }}
                    />
                    <span style={{ margin: '10px 6px' }}>to</span>
                    <input
                      type="number"
                      className="input"
                      placeholder="Max"
                      value={amountRange.max}
                      onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value }))}
                      style={{ width: '80px' }}
                    />
                  </div>
                </div>

                {/* Date Range Filter */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>Date Range</label>
                  <div className="input-row">
                    <input
                      type="date"
                      className="input"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      style={{ width: '140px' }}
                    />
                    <span style={{ margin: '10px 6px' }}>to</span>
                    <input
                      type="date"
                      className="input"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      style={{ width: '140px' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ── LOADING ── */}
        {loading && (
          <div className="empty-state">
            <div className="empty-icon" style={{ fontSize: 20 }}>⟳</div>
            Syncing expenses…
          </div>
        )}

        {/* ── ERROR ── */}
        {error && <p className="banner error">{error}</p>}

        {/* ── EMPTY FILTERED RESULTS ── */}
        {!loading && filteredExpenses.length === 0 && expenses.length > 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            No expenses match your filters — try adjusting your search criteria.
          </div>
        )}

        {/* ── EMPTY ── */}
        {!loading && expenses.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            No expenses yet — add your first one above.
          </div>
        )}

        {/* ── LIST ── */}
        {!loading && filteredExpenses.length > 0 && (
          <ul className="expense-list">
            {filteredExpenses.map((expense) => {
              const paidById = expense.paidBy?._id || expense.paidBy;
              const canManage = user?.id && String(paidById) === String(user.id);
              const isEditing = editingId === expense._id;
              const isConfirming = confirmDelete === expense._id;
              const involvedPeople = (expense.participants || [])
                .map((participant) => getPersonName(participant?.userId, 'Member'))
                .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates

              // Check if expense is settled
              const pendingCount = (expense.participants || []).filter(p => p?.status === 'pending').length;
              const totalParticipants = (expense.participants || []).length;
              const isPersonalExpense = totalParticipants === 1;
              const isPayment = expense.splitType === 'payment';
              const isSettled = !isPersonalExpense && !isPayment && pendingCount === 0;
              const currentUserId = String(user?.id || user?._id || '');
              const currentUserParticipant = (expense.participants || []).find((participant) => {
                const participantUserId = participant?.userId?._id || participant?.userId;
                return String(participantUserId) === currentUserId;
              });
              const currentUserBalance = Number(currentUserParticipant?.balance || 0);
              const unreadCount = unreadByExpense[String(expense._id)] || 0;

              return (
                <li key={expense._id} className="expense-item" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>

                  {/* ICON */}
                  {!isEditing && (
                    <div style={{ position: 'relative' }}>
                      <CategoryIcon category={expense.category} />
                      {expense.splitType === 'payment' && (
                        <div style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          color: 'white',
                          fontSize: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          border: '2px solid var(--card-strong)'
                        }}>
                          💳
                        </div>
                      )}
                      {expense.participants?.length === 1 && (
                        <div style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: 'var(--success)',
                          color: 'white',
                          fontSize: 10,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          border: '2px solid var(--card-strong)'
                        }}>
                          👤
                        </div>
                      )}
                    </div>
                  )}

                  {/* BODY */}
                  <div className="expense-info">
                    {isEditing ? (
                      /* ── EDIT MODE ── */
                      <div className="stack" style={{ gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Description"
                          value={form.description}
                          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                          autoFocus
                        />
                        <input
                          className="input"
                          type="number"
                          min="1"
                          placeholder="Amount"
                          value={form.amount}
                          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                        />
                        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={loading || !canSave}
                            onClick={() => saveEdit(expense._id)}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={cancelEdit}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE ── */
                      <>
                        <div className="expense-title">{expense.description || 'Untitled expense'}</div>
                        <div className="expense-meta">
                          {expense.group?.name && <span>{expense.group.name}</span>}
                          {expense.group?.name && <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>}
                          <span>
                            Paid by {expense.paidBy?.name || expense.paidBy?.email || 'n/a'}
                          </span>
                        </div>
                        <div className="expense-meta" style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontWeight: 700 }}>Involved:</strong>
                            <span>{involvedPeople.join(' · ')}</span>
                          </div>
                          <div style={{ marginLeft: 'auto', position: 'relative' }}>
                          </div>
                        </div>
                        {(expense.tags?.length > 0 || expense.notes || expense.receiptUrl || expense.images?.length > 0) && (
                          <div className="expense-meta" style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {expense.tags?.slice(0, 4).map((tag) => (
                              <span key={`${expense._id}-${tag}`} className="badge">#{tag}</span>
                            ))}
                            {expense.notes && <span title={expense.notes}>Notes added</span>}
                            {expense.receiptUrl && (
                              <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                                Receipt
                              </a>
                            )}
                            {expense.images?.length > 0 && <span>{expense.images.length} image(s)</span>}
                          
                          </div>
                        )}
                        {/* Show pending vs settled status */}
                        {expense.participants?.length > 0 && (
                          <div className="expense-meta" style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                            {(() => {
                              const pendingCount = (expense.participants || []).filter(p => p?.status === 'pending').length;
                              const totalParticipants = (expense.participants || []).length;
                              const isPersonalExpense = totalParticipants === 1;
                              const isPayment = expense.splitType === 'payment';

                              if (isPersonalExpense) {
                                return <span style={{ color: 'var(--success)' }}>Personal expense</span>;
                              }

                              if (isPayment) {
                                if (pendingCount === 0) {
                                  return <span style={{ color: 'var(--success)' }}>Payment settled</span>;
                                }
                                return <span style={{ color: 'var(--danger)' }}>Payment pending</span>;
                              }

                             if (pendingCount === 0) {
                                return <span style={{ color: 'var(--success)' }}>All settled</span>;
                              }

                              return <span style={{ color: 'var(--danger)' }}>{pendingCount} pending</span>;
                            })()}
                          </div>
                        )}

                        {/* ACTION ROW */}
                        {canManage && !isSettled ? (
                          isConfirming ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                              <span className="text-sm" style={{ color: 'var(--danger)' }}>Delete?</span>
                              <button
                                type="button"
                                className="btn btn-danger"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                disabled={loading}
                                onClick={() => removeExpense(expense._id)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={() => onEdit(expense)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)', borderColor: 'var(--danger-dim)' }}
                                disabled={loading}
                                onClick={() => setConfirmDelete(expense._id)}
                              >
                                Delete
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="text-sm muted" style={{ marginTop: 6 }}>
                            {isSettled ? '' : 'View only'}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* AMOUNT — hidden in edit mode */}
                  {!isEditing && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {(() => {
                        const pendingParticipants = (expense.participants || []).filter(p => p?.status === 'pending');
                        const pendingCount = pendingParticipants.length;
                        const totalParticipants = (expense.participants || []).length;
                        const isPersonalExpense = totalParticipants === 1;
                        const isPayment = expense.splitType === 'payment';
                        const hasPending = pendingCount > 0;
                        const paymentAmountColor = hasPending ? 'var(--danger)' : 'var(--success)';
                        const expenseAmountColor = isPersonalExpense
                          ? 'var(--text)'
                          : (isPayment
                            ? paymentAmountColor
                            : (currentUserBalance > 0
                              ? 'var(--success)'
                              : currentUserBalance < 0
                                ? 'var(--danger)'
                                : (hasPending ? 'var(--danger)' : 'var(--success)')));

                        return (
                          <>
                            <div className="expense-amount" style={{ color: expenseAmountColor }}>
                              {formatCurrency(expense.amount)}
                            </div>
                            {!isPersonalExpense && !isPayment && hasPending && (
                              <div className="expense-share">
                                ÷ {totalParticipants} people
                              </div>
                            )}
                            {isPayment && (
                              <div className="expense-share" style={{ fontSize: 11, opacity: 0.7 }}>
                                Direct payment
                              </div>
                            )}
                            {/* small chat button below amount for easier access */}
                            <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 12, padding: '4px 8px' }}
                                onClick={() => openChat(expense)}
                                aria-label={`Open chat for ${expense.description || 'expense'}`}
                              >
                                 Chat
                              </button>
                              {unreadCount > 0 && (
                                <span className="chat-badge" title={`${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`}>
                                  {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ChatModal
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatInitialUnreadCount(0); }}
        expense={activeExpense}
        currentUser={user}
        token={token}
        initialUnreadCount={chatInitialUnreadCount}
      />
    </Card>
  );
}
