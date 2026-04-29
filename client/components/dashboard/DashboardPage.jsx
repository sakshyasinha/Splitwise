import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useExpenses from '../../hooks/useExpenses.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import GroupForm from '../group/GroupForm.jsx';
import GroupEditForm from '../group/GroupEditForm.jsx';
import ExpenseForm from '../expense/ExpenseForm.jsx';
import ExpenseList from '../expense/ExpenseList.jsx';
import AIChatPanel from '../chat/AIChatPanel.jsx';
import ThemeToggle from '../ui/ThemeToggle.jsx';

const currency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
};

const getPersonLabel = (person, index, currentUser) => {
  if (person && typeof person === 'object') {
    const personId = String(person._id || person.id || '');
    const currentUserId = String(currentUser?._id || currentUser?.id || '');
    const currentUserEmail = String(currentUser?.email || '').toLowerCase();
    const currentUserName = String(currentUser?.name || '').toLowerCase();
    const personName = String(person.name || person.email || '').toLowerCase();

    if (
      (personId && personId === currentUserId) ||
      (currentUserEmail && personName === currentUserEmail) ||
      (currentUserName && personName === currentUserName)
    ) {
      return 'You';
    }

    return person.name || person.email || `Member ${index + 1}`;
  }

  return `Member ${index + 1}`;
};

const normalizeGroupName = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, '');

const normalizePersonLabel = (value) => String(value || '').trim();

const dedupeNames = (values = []) => {
  const seen = new Set();

  return values.filter((value) => {
    const normalized = normalizePersonLabel(value).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

const prettifyGroupType = (value) => {
  const normalized = String(value || 'other').trim().toLowerCase();
  if (!normalized) return 'Other';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const Modal = ({ isOpen, title, subtitle, onClose, children }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={`modal-overlay ${isClosing ? 'closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleClose}
    >
      <div
        className="modal-shell"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            aria-label="Close modal"
          >
            Close
          </Button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { logout, user } = useAuth();
  const {
    expenses,
    groups,
    myDues,
    myLents,
    totalOwed,
    totalLent,
    fetchExpenses,
    fetchMyDues,
    fetchMyLents,
    fetchGroups,
    settleDue,
  } = useExpenses();

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [settlingExpenseId, setSettlingExpenseId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);

  useEffect(() => {
    console.log('DashboardPage: Initial data load');
    fetchExpenses();
    fetchMyDues();
    fetchMyLents();
    fetchGroups();
  }, []);

  // Debug logging for expenses changes
  useEffect(() => {
    console.log('DashboardPage: Expenses updated, count:', expenses.length);
  }, [expenses]);

  useEffect(() => {
    if (!activeModal) {
      return undefined;
    }

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveModal(null);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [activeModal]);

  const totals = {
    expenseCount: expenses.length,
    totalSpend: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
  };

  const getDueGroupId = (due) => due.group?._id || due.group?.id || null;
  const getDueGroupName = (due) => due.group?.name || '';
  const getExpenseGroupId = (expense) => (typeof expense.group === 'object' ? expense.group?._id : expense.group);
  const getExpenseGroupName = (expense) => (typeof expense.group === 'object' ? expense.group?.name : '');

  const getExpensePeople = (expense) => {
    const people = [];

    if (expense?.paidBy) {
      people.push(expense.paidBy);
    }

    (expense?.participants || []).forEach((participant) => {
      if (participant?.userId) {
        people.push(participant.userId);
      }
    });

    return people;
  };

  const groupSummaries = groups.length > 0
    ? groups.map((group) => {
        const exactMatchedExpenses = expenses.filter((expense) => String(getExpenseGroupId(expense)) === String(group._id));
        const groupExpenses =
          exactMatchedExpenses.length > 0
            ? exactMatchedExpenses
            : expenses.filter((expense) => normalizeGroupName(getExpenseGroupName(expense)) === normalizeGroupName(group.name));

        const totalSpend = groupExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        const exactMatchedDues = myDues.filter((due) => String(getDueGroupId(due)) === String(group._id));
        const dues =
          exactMatchedDues.length > 0
            ? exactMatchedDues
            : myDues.filter((due) => normalizeGroupName(getDueGroupName(due)) === normalizeGroupName(group.name));
        const myTotalDue = dues.reduce((sum, due) => sum + Number(due.amount || 0), 0);
        const totalDue = groupExpenses.reduce(
          (sum, expense) =>
            sum +
            (expense.participants || []).reduce(
              (pendingSum, participant) =>
                participant?.status === 'pending' ? pendingSum + Number(participant.amount || 0) : pendingSum,
              0
            ),
          0
        );
        const memberDues = dues.map((due) => ({ name: due.paidTo?.name || due.paidTo?.email, amount: due.amount }));
        const memberNames = dedupeNames([
          ...(group.members || []).map((member, index) => getPersonLabel(member, index, user)),
          ...groupExpenses.flatMap((expense) =>
            getExpensePeople(expense).map((person, index) => getPersonLabel(person, index, user))
          ),
          ...dues.map((due) => getPersonLabel(due.paidTo, 0, user)),
        ]);
        const memberCount = Math.max(memberNames.length, 1);

        return {
          ...group,
          groupKey: String(group._id),
          totalSpend,
          totalDue,
          myTotalDue,
          memberDues,
          memberNames,
          memberCount,
          dues,
          groupExpenses,
        };
      })
    : [];

  const mergedGroupSummaries = useMemo(() => {
    const byName = new Map();

    for (const group of groupSummaries) {
      const key = `${normalizeGroupName(group.name) || String(group.groupKey)}::${String(group.type || 'other')}`;
      const existing = byName.get(key);

      if (!existing) {
        byName.set(key, {
          ...group,
          groupKey: key,
          _sourceGroupIds: [String(group._id)],
          groupExpenses: [...(group.groupExpenses || [])],
          dues: [...(group.dues || [])],
          memberNames: [...(group.memberNames || [])],
        });
        continue;
      }

      existing._sourceGroupIds = [...new Set([...existing._sourceGroupIds, String(group._id)])];
      const expenseMap = new Map((existing.groupExpenses || []).map((expense) => [String(expense._id), expense]));
      (group.groupExpenses || []).forEach((expense) => {
        expenseMap.set(String(expense._id), expense);
      });
      existing.groupExpenses = Array.from(expenseMap.values());

      const dueMap = new Map((existing.dues || []).map((due) => [String(due.expenseId), due]));
      (group.dues || []).forEach((due) => {
        dueMap.set(String(due.expenseId), due);
      });
      existing.dues = Array.from(dueMap.values());

      existing.memberNames = dedupeNames([...(existing.memberNames || []), ...(group.memberNames || [])]);
    }

    return Array.from(byName.values()).map((group) => {
      const totalSpend = (group.groupExpenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const totalDue = (group.groupExpenses || []).reduce(
        (sum, expense) =>
          sum +
          (expense.participants || []).reduce(
            (pendingSum, participant) =>
              participant?.status === 'pending' ? pendingSum + Number(participant.amount || 0) : pendingSum,
            0
          ),
        0
      );
      const myTotalDue = (group.dues || []).reduce((sum, due) => sum + Number(due.amount || 0), 0);
      const memberDues = (group.dues || []).map((due) => ({
        name: due.paidTo?.name || due.paidTo?.email,
        amount: due.amount,
      }));
      const memberNames = dedupeNames([
        ...(group.memberNames || []),
        ...(group.dues || []).map((due) => getPersonLabel(due.paidTo, 0, user)),
        ...(group.groupExpenses || []).map((expense) => getPersonLabel(expense.paidBy, 0, user)),
      ]);

      return {
        ...group,
        totalSpend,
        totalDue,
        myTotalDue,
        memberDues,
        memberNames,
        memberCount: Math.max(memberNames.length, 1),
      };
    });
  }, [groupSummaries, user?.name, user?.email]);

  const prioritizedGroups = useMemo(
    () =>
      [...mergedGroupSummaries].sort((a, b) => {
        const aScore = Number(a.myTotalDue || 0) + Number(a.totalDue || 0);
        const bScore = Number(b.myTotalDue || 0) + Number(b.totalDue || 0);
        if (bScore !== aScore) return bScore - aScore;
        return Number(b.totalSpend || 0) - Number(a.totalSpend || 0);
      }),
    [mergedGroupSummaries]
  );

  const selectedGroup = useMemo(
    () => prioritizedGroups.find((group) => String(group.groupKey) === String(selectedGroupId)) || prioritizedGroups[0] || null,
    [prioritizedGroups, selectedGroupId]
  );

  const selectedGroupExpenses = selectedGroup
    ? (() => {
        const canonicalKey = normalizeGroupName(selectedGroup.name);
        const selectedGroupIds = new Set((selectedGroup._sourceGroupIds || []).map(String));
        const exactMatchedExpenses = expenses.filter((expense) => selectedGroupIds.has(String(getExpenseGroupId(expense))));

        if (exactMatchedExpenses.length > 0) {
          return exactMatchedExpenses;
        }

        return expenses.filter((expense) => normalizeGroupName(getExpenseGroupName(expense)) === canonicalKey);
      })()
    : [];

  const selectedGroupMemberNames = selectedGroup
    ? dedupeNames([
        ...(selectedGroup.members || []).map((member, index) => getPersonLabel(member, index, user)),
        ...selectedGroupExpenses.flatMap((expense) =>
          getExpensePeople(expense).map((person, index) => getPersonLabel(person, index, user))
        ),
        ...(selectedGroup.dues || []).map((due) => getPersonLabel(due.paidTo, 0, user)),
      ])
    : [];

  const selectedGroupPosition = selectedGroup
    ? selectedGroup.myTotalDue > 0
      ? {
          tone: 'danger',
          badgeClass: 'badge-red',
          badgeText: 'Borrowed',
          amount: selectedGroup.myTotalDue,
        }
      : selectedGroup.totalDue > 0
        ? {
            tone: 'success',
            badgeClass: 'badge-green',
            badgeText: 'Lent',
            amount: selectedGroup.totalDue,
          }
        : {
            tone: 'success',
            badgeClass: 'badge-green',
            badgeText: 'Settled',
            amount: 0,
          }
    : null;

  const userId = String(user?._id || user?.id || '');
  const userEmail = String(user?.email || '').toLowerCase();
  const userName = String(user?.name || '').toLowerCase();

  const closeModal = () => {
    setActiveModal(null);
    setEditingExpense(null);
    setEditingGroup(null);
  };

  const openEditExpense = (expense) => {
    setEditingExpense(expense);
    setActiveModal('expense');
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setActiveModal('editGroup');
  };

  const openGroupDetailsFor = (groupKey) => {
    setSelectedGroupId(groupKey);
    setActiveModal('groupDetails');
  };

  const handleSettleDue = async (expenseId) => {
    try {
      setSettlingExpenseId(expenseId);
      await settleDue(expenseId);
      // Refresh all data after settling
      await Promise.all([fetchExpenses(), fetchMyDues(), fetchMyLents(), fetchGroups()]);
    } catch (_) {
    } finally {
      setSettlingExpenseId(null);
    }
  };

  const handleGroupUpdate = async () => {
    // Refresh groups after editing
    await fetchGroups();
  };

  const handleGroupDelete = async () => {
    try {
      // The deleteGroup function in the store already calls fetchGroups()
      // We just need to close the modal after it completes
      closeModal();
    } catch (error) {
      console.error('Error in handleGroupDelete:', error);
    }
  };

  const handleMemberChange = async () => {
    // Refresh groups after member changes without closing modal
    await fetchGroups();
  };

  return (
    <>
      <main className="dashboard-layout">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="topbar-logo">SS</div>
            <div>
              <div className="topbar-title">SplitSense</div>
              <div className="topbar-sub">Money clarity for your group life</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" onClick={logout}>
              Sign out →
            </Button>
          </div>
        </header>

        <section className="hero-strip">
          <div>
            <h1>Your shared finances,&nbsp;at a glance.</h1>
            <p>Shared money is less stressful when everyone sees the same truth.</p>
          </div>
          <span className="due-pill">
            {myDues.length === 0 ? '✓ All dues settled' : `${myDues.length} pending due${myDues.length !== 1 ? 's' : ''}`}
          </span>
        </section>

        <section className="stats-grid">
          <Card className="stat-violet">
            <div className="card-content">
              <div className="metric-icon">👥</div>
              <div className="metric-label">Groups</div>
              <div className="metric">{prioritizedGroups.length}</div>
              <div className="metric-sub">Active shared circles</div>
            </div>
          </Card>
          <Card className="stat-green">
            <div className="card-content">
              <div className="metric-icon">🟢</div>
              <div className="metric-label">You Lent</div>
              <div className="metric" style={{ color: 'var(--success)' }}>{currency(totalLent)}</div>
              <div className="metric-sub">Others owe you</div>
            </div>
          </Card>
          <Card className="stat-red">
            <div className="card-content">
              <div className="metric-icon">🟠</div>
              <div className="metric-label">You Borrowed</div>
              <div className="metric" style={{ color: 'var(--danger)' }}>{currency(totalOwed)}</div>
              <div className="metric-sub">Pending dues</div>
            </div>
          </Card>
          <Card className="stat-amber">
            <div className="card-content">
              <div className="metric-icon">🧾</div>
              <div className="metric-label">Expenses</div>
              <div className="metric">{totals.expenseCount}</div>
              <div className="metric-sub">Total spend {currency(totals.totalSpend)}</div>
            </div>
          </Card>
        </section>

        <section className="content-grid">
          <div className="left-column stack-lg">
            <Card>
              <div className="card-header">
                <h2>Quick Actions</h2>
                <p>Open focused modals and avoid long scroll forms</p>
              </div>
              <div className="card-content quick-actions-panel">
                <Button type="button" onClick={() => setActiveModal('group')}>
                  + Create Group
                </Button>
                <Button type="button" variant="ghost" onClick={() => setActiveModal('expense')}>
                  + Add Expense
                </Button>
                <div className="quick-actions-hints">
                  <span className="badge badge-green">Lent is Green</span>
                  <span className="badge badge-red">Borrowed is Red-Orange</span>
                </div>
              </div>
            </Card>

            <Card>
              <div className="card-header">
                <h2>Groups</h2>
                <p>Your active shared circles</p>
              </div>
              <div className="card-content">
                {prioritizedGroups.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    No groups yet. Create one to start splitting.
                  </div>
                ) : (
                  <div className="stack">
                    {prioritizedGroups.map((group) => (
                      <div
                        key={group.groupKey}
                        className="group-card"
                        onClick={() => openGroupDetailsFor(group.groupKey)}
                        style={{
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          width: '100%',
                          cursor: 'pointer',
                          border:
                            String(selectedGroup?.groupKey) === String(group.groupKey)
                              ? '1px solid var(--primary)'
                              : undefined,
                          boxShadow:
                            String(selectedGroup?.groupKey) === String(group.groupKey)
                              ? '0 0 0 3px rgba(74, 144, 226, 0.12)'
                              : undefined,
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
                              <span style={{ color: 'var(--danger)' }}>You borrowed {currency(group.myTotalDue)}</span>
                            ) : group.totalDue > 0 ? (
                              <span style={{ color: 'var(--success)' }}>You lent {currency(group.totalDue)}</span>
                            ) : (
                              <span style={{ color: 'var(--success)' }}>Settled</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-sm muted">Total Spend: {currency(group.totalSpend)}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditGroup(group);
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
                                <span style={{ color: 'var(--danger)' }}>{currency(person.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <ExpenseList onEdit={openEditExpense} />
          </div>

          <div className="right-column stack-lg">
            <Card>
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <div>
                    <h2>My Dues</h2>
                    <p>Settle up directly from here</p>
                  </div>
                  <span className={`badge ${myDues.length === 0 ? 'badge-green' : 'badge-red'}`}>
                    {myDues.length === 0 ? 'Settled' : `${myDues.length} pending`}
                  </span>
                </div>
              </div>
              <div className="card-content">
                {myDues.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    You're all clear — no pending dues.
                  </div>
                ) : (
                  <ul className="expense-list">
                    {myDues.map((due) => (
                      <li key={due.expenseId} className="expense-item">
                        <div className="due-avatar" style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                          {(due.paidTo?.name || due.paidTo?.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="expense-info">
                          <div className="expense-title">{due.description}</div>
                          <div className="expense-meta">
                            Pay → {due.paidTo?.name || due.paidTo?.email}
                            {due.group?.name ? ` · ${due.group.name}` : ''}
                          </div>
                          <div className="settle-row">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleSettleDue(due.expenseId)}
                              disabled={settlingExpenseId === due.expenseId}
                            >
                              {settlingExpenseId === due.expenseId ? 'Settling...' : 'Settle Up'}
                            </Button>
                          </div>
                        </div>
                        <div>
                          <div className="expense-amount debit">{currency(due.amount)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>

            <AIChatPanel />
          </div>
        </section>
      </main>

      <Modal
        isOpen={activeModal === 'group'}
        title="Create Group"
        subtitle="Set title, type, members, and people count in one focused flow"
        onClose={closeModal}
      >
        <GroupForm onSuccess={closeModal} />
      </Modal>

      <Modal
        isOpen={activeModal === 'editGroup'}
        title="Edit Group"
        subtitle="Update group details"
        onClose={closeModal}
      >
        {editingGroup && <GroupEditForm group={editingGroup} onSuccess={handleGroupUpdate} onDelete={handleGroupDelete} onMemberChange={handleMemberChange} />}
      </Modal>

      <Modal
        isOpen={activeModal === 'expense'}
        title={editingExpense ? "Edit Expense" : "Add Expense"}
        subtitle={editingExpense ? "Update expense details" : "Add a split in a distraction-free modal"}
        onClose={closeModal}
      >
        <ExpenseForm onSuccess={closeModal} editingExpense={editingExpense} />
      </Modal>

      <Modal
        isOpen={activeModal === 'groupDetails'}
        title={selectedGroup ? `Group Details · ${selectedGroup.name}` : 'Group Details'}
        subtitle={selectedGroup ? 'Deep dive into members, outstanding, and expenses' : 'Choose a group first'}
        onClose={closeModal}
      >
        {!selectedGroup ? (
          <div className="empty-state">
            <div className="empty-icon">👆</div>
            Select a group from the list to view details.
          </div>
        ) : (
          <Card>
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h2>Group Details</h2>
                  <p>{selectedGroup.name}</p>
                </div>
                <span className={`badge ${selectedGroupPosition.badgeClass}`}>
                  {selectedGroupPosition.badgeText}
                </span>
              </div>
            </div>
            <div className="card-content">
              <div className="stack-lg">
                <div className="group-detail-head">
                  <span className="badge badge-violet">{prettifyGroupType(selectedGroup.type)}</span>
                  <span className="badge badge-amber">{selectedGroup.memberCount || 1} people</span>
                </div>

                {selectedGroup.description && (
                  <div>
                    <div className="metric-label" style={{ marginBottom: 8 }}>Description</div>
                    <div className="text-sm" style={{ fontStyle: 'italic', color: 'var(--muted2)' }}>
                      {selectedGroup.description}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="metric-label">Members</div>
                    <div className="metric">{selectedGroup.memberCount || 1}</div>
                  </div>
                  <div>
                    <div className="metric-label">Spend</div>
                    <div className="metric">{currency(selectedGroup.totalSpend)}</div>
                  </div>
                </div>

                <div>
                  <div className="metric-label" style={{ marginBottom: 8 }}>Member names</div>
                  <div className="stack">
                    {selectedGroupMemberNames.length === 0 ? (
                      <div className="text-sm muted">No members found for this group.</div>
                    ) : (
                      selectedGroupMemberNames.map((memberName, index) => (
                        <div key={`${memberName}-${index}`} className="text-sm">
                          {memberName}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="metric-label" style={{ marginBottom: 8 }}>Outstanding</div>
                  <div
                    className="metric"
                    style={{ color: selectedGroupPosition.tone === 'danger' ? 'var(--danger)' : 'var(--success)' }}
                  >
                    {selectedGroupPosition.amount > 0 ? currency(selectedGroupPosition.amount) : 'Settled'}
                  </div>
                </div>

                <div>
                  <div className="metric-label" style={{ marginBottom: 8 }}>Recent expenses</div>
                  {selectedGroupExpenses.length === 0 ? (
                    <div className="empty-state" style={{ marginTop: 8 }}>
                      <div className="empty-icon">🧾</div>
                      No expenses in this group yet.
                    </div>
                  ) : (
                    <div className="stack">
                      {selectedGroupExpenses.slice(0, 8).map((expense) => {
                        const participants = (expense.participants || [])
                          .map((participant) => participant?.userId?.name || participant?.userId?.email)
                          .filter(Boolean);
                        const pendingParticipants = (expense.participants || []).filter(p => p?.status === 'pending');
                        const hasPending = pendingParticipants.length > 0;

                        return (
                          <div key={expense._id} className="group-expense-row">
                            <div>
                              <div className="text-sm" style={{ fontWeight: 700 }}>{expense.description}</div>
                              <div className="expense-meta">
                                Involved: {dedupeNames([
                                  expense.paidBy?.name || expense.paidBy?.email || 'Payer',
                                  ...participants,
                                ]).join(' · ')}
                              </div>
                              {!hasPending && (
                                <div className="expense-meta" style={{ marginTop: 4, color: 'var(--success)' }}>✓ Settled</div>
                              )}
                            </div>
                            <span className="text-sm" style={{ fontWeight: 700, color: hasPending ? 'var(--danger)' : 'var(--success)' }}>
                              {hasPending ? currency(expense.amount) : '✓'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </Modal>
    </>
  );
};

export default DashboardPage;
