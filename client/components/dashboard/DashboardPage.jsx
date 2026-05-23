import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useExpenses from '../../hooks/useExpenses.js';
import Card from '../ui/Card.jsx';
import Modal from '../ui/Modal.jsx';
import GroupForm from '../group/GroupForm.jsx';
import GroupEditForm from '../group/GroupEditForm.jsx';
import ExpenseForm from '../expense/ExpenseForm.jsx';
import ExpenseList from '../expense/ExpenseList.jsx';
import AIChatPanel from '../chat/AIChatPanel.jsx';
import DashboardHeader from './DashboardHeader.jsx';
import HeroStrip from './HeroStrip.jsx';
import StatsGrid from './StatsGrid.jsx';
import QuickActions from './QuickActions.jsx';
import GroupList from './GroupList.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import DuesList from './DuesList.jsx';
import LentsList from './LentsList.jsx';
import GroupDetails from './GroupDetails.jsx';
import NotificationsDropdown from './NotificationsDropdown.jsx';
import EmailActions from './EmailActions.jsx';
import AnalyticsDashboard from '../analytics/AnalyticsDashboard.jsx';
import RecurringExpensesManager from '../recurring/RecurringExpensesManager.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getPersonLabel } from '../../utils/personUtils.js';
import { normalizeGroupName, dedupeValues, prettifyGroupType } from '../../utils/stringUtils.js';
import { getUnreadNotificationCount } from '../../services/activity.service.js';

const DashboardPage = ({ view = 'dashboard' }) => {
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
    fetchExpenseBreakdown,
    fetchFriendsList,
  } = useExpenses();

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [settlingExpenseId, setSettlingExpenseId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');

  const refreshNotificationCount = async () => {
    try {
      const data = await getUnreadNotificationCount();
      setNotificationCount(Number(data?.count || 0));
    } catch (error) {
      console.error('Error loading unread notification count:', error);
    }
  };

  useEffect(() => {
    console.log('DashboardPage: Initial data load');
    const loadData = async () => {
      try {
        await Promise.all([
          fetchExpenses(),
          fetchMyDues(),
          fetchMyLents(),
          fetchGroups(),
          fetchExpenseBreakdown(),
          fetchFriendsList()
        ]);
        await refreshNotificationCount();
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };
    loadData();
  }, []);

  // Debug logging for expenses changes
  useEffect(() => {
    console.log('DashboardPage: Expenses updated, count:', expenses.length);
  }, [expenses]);

  useEffect(() => {
    refreshNotificationCount();
  }, []);

  useEffect(() => {
    const refresh = () => refreshNotificationCount();
    const intervalId = window.setInterval(refresh, 15000);

    window.addEventListener('splitwise:notifications-updated', refresh);
    window.addEventListener('focus', refresh);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('splitwise:notifications-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

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

  const userId = String(user?._id || user?.id || '');
  const userEmail = String(user?.email || '').toLowerCase();
  const userName = String(user?.name || '').toLowerCase();

  const getDueGroupId = (due) => due.group?._id || due.group?.id || null;
  const getDueGroupName = (due) => due.group?.name || '';
  const getExpenseGroupId = (expense) => (typeof expense.group === 'object' ? expense.group?._id : expense.group);
  const getExpenseGroupName = (expense) => (typeof expense.group === 'object' ? expense.group?.name : '');

  const visibleDues = useMemo(() => {
    const fromExpenses = expenses.flatMap((expense) => {
      const participant = (expense.participants || []).find((entry) => {
        if (!entry?.userId) return false;
        const entryUserId = typeof entry.userId === 'object' ? entry.userId._id : entry.userId;
        return String(entryUserId) === String(userId);
      });

      if (!participant) {
        return [];
      }

      const balance = Number(
        participant.balance ??
        (Number(participant.paidAmount || 0) - Number(participant.shareAmount || participant.amount || 0))
      );

      if (balance >= 0) {
        return [];
      }

      return [{
        expenseId: expense._id,
        description: expense.description || 'Unknown expense',
        amount: Math.abs(balance),
        status: participant.status || 'pending',
        group: {
          id: expense.group?._id,
          name: expense.group?.name || '',
        },
        paidTo: {
          id: expense.paidBy?._id || expense.createdBy?._id,
          name: expense.paidBy?.name || expense.createdBy?.name || 'Unknown User',
          email: expense.paidBy?.email || expense.createdBy?.email || '',
        },
        createdAt: expense.createdAt,
      }];
    });

    const mergedDues = new Map();
    [...fromExpenses, ...myDues].forEach((due) => {
      if (!due) return;
      const key = String(due.expenseId || due._id || `${due.description || ''}-${due.amount || 0}`);
      mergedDues.set(key, due);
    });

    return Array.from(mergedDues.values());
  }, [expenses, myDues, userId]);

  const visibleTotalOwed = useMemo(
    () => visibleDues.reduce((sum, due) => sum + Number(due.amount || 0), 0),
    [visibleDues]
  );

  const getUserBalanceForExpense = (expense, targetUserId) => {
    if (!expense?.participants) return 0;
    
    const targetIdStr = String(targetUserId);
    const participant = (expense.participants || []).find((entry) => {
      if (!entry?.userId) return false;
      const entryUserId = typeof entry.userId === 'object' ? entry.userId._id : entry.userId;
      return String(entryUserId) === targetIdStr;
    });

    if (!participant) return 0;
    
    // Return balance field if available, else calculate from share and paid amounts
    const balance = Number(participant.balance ?? 
      (Number(participant.paidAmount || 0) - Number(participant.shareAmount || participant.amount || 0)));
    
    return balance;
  };

  const getGroupBalanceBreakdown = (groupExpenses, targetUserId) => {
    return (groupExpenses || []).reduce(
      (totals, expense) => {
        const balance = getUserBalanceForExpense(expense, targetUserId);

        if (balance > 0) {
          totals.lentAmount += balance;
        } else if (balance < 0) {
          totals.borrowedAmount += Math.abs(balance);
        }

        return totals;
      },
      { borrowedAmount: 0, lentAmount: 0 }
    );
  };

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
        const exactMatchedDues = visibleDues.filter((due) => String(getDueGroupId(due)) === String(group._id));
        const dues =
          exactMatchedDues.length > 0
            ? exactMatchedDues
            : visibleDues.filter((due) => normalizeGroupName(getDueGroupName(due)) === normalizeGroupName(group.name));
        const myTotalDue = dues.reduce((sum, due) => sum + Number(due.amount || 0), 0);
        const balanceBreakdown = userId ? getGroupBalanceBreakdown(groupExpenses, userId) : { borrowedAmount: 0, lentAmount: 0 };
        const netBalance = balanceBreakdown.lentAmount - balanceBreakdown.borrowedAmount;
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
        const memberNames = dedupeValues([
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
          netBalance,
          borrowedAmount: balanceBreakdown.borrowedAmount,
          lentAmount: balanceBreakdown.lentAmount,
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

      existing.memberNames = dedupeValues([...(existing.memberNames || []), ...(group.memberNames || [])]);
    }

    return Array.from(byName.values()).map((group) => {
      const totalSpend = (group.groupExpenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
      const balanceBreakdown = userId ? getGroupBalanceBreakdown(group.groupExpenses || [], userId) : { borrowedAmount: 0, lentAmount: 0 };
      const netBalance = balanceBreakdown.lentAmount - balanceBreakdown.borrowedAmount;
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
      const memberNames = dedupeValues([
        ...(group.memberNames || []),
        ...(group.dues || []).map((due) => getPersonLabel(due.paidTo, 0, user)),
        ...(group.groupExpenses || []).map((expense) => getPersonLabel(expense.paidBy, 0, user)),
      ]);

      return {
        ...group,
        totalSpend,
        totalDue,
        myTotalDue,
        netBalance,
        borrowedAmount: balanceBreakdown.borrowedAmount,
        lentAmount: balanceBreakdown.lentAmount,
        memberDues,
        memberNames,
        memberCount: Math.max(memberNames.length, 1),
      };
    });
  }, [groupSummaries, user?.name, user?.email]);

  const prioritizedGroups = useMemo(
    () =>
      [...mergedGroupSummaries].sort((a, b) => {
        const aScore = Math.abs(Number(a.netBalance || 0));
        const bScore = Math.abs(Number(b.netBalance || 0));
        if (bScore !== aScore) return bScore - aScore;
        return Number(b.totalSpend || 0) - Number(a.totalSpend || 0);
      }),
    [mergedGroupSummaries]
  );

  const normalizedDashboardSearch = dashboardSearchQuery.trim().toLowerCase();

  const visibleGroupsForSearch = useMemo(() => {
    if (!normalizedDashboardSearch) {
      return prioritizedGroups;
    }

    return prioritizedGroups.filter((group) => {
      const searchableText = [
        group.name,
        group.description,
        group.type,
        ...(group.memberNames || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedDashboardSearch);
    });
  }, [prioritizedGroups, normalizedDashboardSearch]);

  const selectedGroup = useMemo(
    () => prioritizedGroups.find((group) => {
      const sourceGroupIds = Array.isArray(group._sourceGroupIds) ? group._sourceGroupIds.map(String) : [];
      return String(group.groupKey) === String(selectedGroupId) || sourceGroupIds.includes(String(selectedGroupId));
    }) || prioritizedGroups[0] || null,
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
    : [];890

  const selectedGroupMemberNames = selectedGroup
    ? dedupeValues([
        ...(selectedGroup.members || []).map((member, index) => getPersonLabel(member, index, user)),
        ...selectedGroupExpenses.flatMap((expense) =>
          getExpensePeople(expense).map((person, index) => getPersonLabel(person, index, user))
        ),
        ...(selectedGroup.dues || []).map((due) => getPersonLabel(due.paidTo, 0, user)),
      ])
    : [];

  const selectedGroupPosition = selectedGroup
    ? Number(selectedGroup.borrowedAmount || 0) > 0
      ? {
          tone: 'danger',
          badgeClass: 'badge-red',
          badgeText: 'Borrowed',
          amount: Number(selectedGroup.borrowedAmount || 0),
          secondaryText: Number(selectedGroup.lentAmount || 0) > 0
            ? `Others owe you ${formatCurrency(Number(selectedGroup.lentAmount || 0))}`
            : '',
        }
      : Number(selectedGroup.lentAmount || 0) > 0
        ? {
            tone: 'success',
            badgeClass: 'badge-green',
            badgeText: 'Lent',
          amount: Number(selectedGroup.lentAmount || 0),
          secondaryText: Number(selectedGroup.borrowedAmount || 0) > 0
            ? `You owe ${formatCurrency(Number(selectedGroup.borrowedAmount || 0))}`
            : '',
          }
        : {
            tone: 'success',
            badgeClass: 'badge-green',
            badgeText: 'Settled',
            amount: 0,
          secondaryText: '',
          }
    : null;

  const closeModal = () => {
    setActiveModal(null);
    setEditingExpense(null);
    setEditingGroup(null);
  };

  const openAddExpense = (groupId = null) => {
    setEditingExpense(null);
    setEditingGroup(null);
    setSelectedGroupId(groupId);
    setActiveModal('expense');
  };

  const openEditExpense = (expense) => {
    setEditingExpense(expense);
    setActiveModal('expense');
  };

  const openEditGroup = (group) => {
    setEditingGroup(group);
    setActiveModal('editGroup');
  };

  const openAddExpenseForGroup = (groupId) => {
    openAddExpense(groupId);
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

  const openNotifications = () => {
    setIsNotificationsOpen(true);
  };

  const closeNotifications = () => {
    setIsNotificationsOpen(false);
  };

  const handleNotificationsRead = (nextCount = 0) => {
    setNotificationCount(nextCount);
  };

  const isDashboardView = view === 'dashboard';
  const isGroupsView = view === 'groups';
  const isActivityView = view === 'activity';
  const isAnalyticsView = view === 'analytics';
  const isProfileView = view === 'profile';
  const isSettingsView = view === 'settings';
  const isAccountView = isProfileView || isSettingsView;
  const profileDisplayName = userEmail ? userEmail.split('@')[0] : user?.name || 'User';

  return (
    <>
      <main className="dashboard-layout">
        <DashboardHeader
          user={user}
          onLogout={logout}
          onNotificationClick={openNotifications}
          notificationCount={notificationCount}
          searchQuery={dashboardSearchQuery}
          onSearchChange={setDashboardSearchQuery}
        />

        {!isAccountView && (
          <HeroStrip
            pendingDuesCount={visibleDues.length}
            totalSpend={totals.totalSpend}
            totalOwed={visibleTotalOwed}
            totalLent={totalLent}
          />
        )}

        {(isDashboardView || isGroupsView) && (
          <StatsGrid
            groupCount={prioritizedGroups.length}
            totalLent={totalLent}
            totalOwed={visibleTotalOwed}
            expenseCount={totals.expenseCount}
            totalSpend={totals.totalSpend}
          />
        )}

        {isDashboardView && (
          <section className="content-grid">
            <div className="left-column stack-lg">
              <QuickActions
                onCreateGroup={() => setActiveModal('group')}
                onAddExpense={() => setActiveModal('expense')}
                onManageRecurring={() => setActiveModal('recurring')}
              />

              <ExpenseList onEdit={openEditExpense} externalSearchQuery={dashboardSearchQuery} />
            </div>

            <div className="right-column stack-lg">
              <DuesList
                dues={visibleDues}
                settlingExpenseId={settlingExpenseId}
                onSettleDue={handleSettleDue}
              />

              <LentsList lents={myLents} />

              <AIChatPanel />
            </div>
          </section>
        )}

        {isGroupsView && (
          <section className="content-grid dashboard-route-grid">
            <div className="left-column stack-lg">
              <QuickActions
                onCreateGroup={() => setActiveModal('group')}
                onAddExpense={() => setActiveModal('expense')}
                onManageRecurring={() => setActiveModal('recurring')}
              />

              <GroupList
                groups={visibleGroupsForSearch}
                selectedGroupId={selectedGroupId}
                currentUserId={userId}
                onGroupClick={openGroupDetailsFor}
                onGroupEdit={openEditGroup}
                onGroupAddExpense={openAddExpenseForGroup}
              />
            </div>

            <div className="right-column stack-lg">
              <DuesList
                dues={visibleDues}
                settlingExpenseId={settlingExpenseId}
                onSettleDue={handleSettleDue}
              />
              <LentsList lents={myLents} />
            </div>
          </section>
        )}

        {isActivityView && (
          <section className="content-grid dashboard-route-grid">
            <div className="left-column stack-lg">
              <ActivityFeed limit={30} />
            </div>

            <div className="right-column stack-lg">
              <ExpenseList onEdit={openEditExpense} externalSearchQuery={dashboardSearchQuery} />
            </div>
          </section>
        )}

        {isAnalyticsView && (
          <section className="analytics-section">
            <AnalyticsDashboard
              refreshKey={`${expenses.length}:${groups.length}:${myDues.length}:${myLents.length}`}
              balanceSnapshot={{ totalLent, totalOwed }}
            />
          </section>
        )}

        {isProfileView && (
          <section className="content-grid dashboard-route-grid account-section">
            <div className="left-column stack-lg">
              <Card title="My Profile" subtitle="Your signed-in account details">
                <div className="profile-summary">
                  <div className="profile-summary-avatar">{profileDisplayName.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="profile-summary-name">{profileDisplayName}</div>
                    <div className="profile-summary-email">{userEmail || 'No email available'}</div>
                  </div>
                </div>
                <div className="account-details">
                  <div>
                    <span>Account ID</span>
                    <strong>{userId || 'Not available'}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{userEmail || 'Not available'}</strong>
                  </div>
                  <div>
                    <span>Groups</span>
                    <strong>{prioritizedGroups.length}</strong>
                  </div>
                  <div>
                    <span>Expenses</span>
                    <strong>{totals.expenseCount}</strong>
                  </div>
                </div>
              </Card>
            </div>

            <div className="right-column stack-lg">
              <Card title="Balance Snapshot" subtitle="Quick view of your current position">
                <div className="account-details">
                  <div>
                    <span>You owe</span>
                    <strong className="danger">{formatCurrency(visibleTotalOwed)}</strong>
                  </div>
                  <div>
                    <span>You lent</span>
                    <strong className="success">{formatCurrency(totalLent)}</strong>
                  </div>
                  <div>
                    <span>Total spend</span>
                    <strong>{formatCurrency(totals.totalSpend)}</strong>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        {isSettingsView && (
          <section className="content-grid dashboard-route-grid account-section">
            <div className="left-column stack-lg">
              <Card title="Settings" subtitle="Manage local preferences for this dashboard">
                <div className="settings-list">
                  <label className="settings-row">
                    <span>
                      <strong>Email reminders</strong>
                      <small>Show email tools for reminders and tests</small>
                    </span>
                    <input type="checkbox" defaultChecked />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Notification refresh</strong>
                      <small>Keep checking for unread activity while the app is open</small>
                    </span>
                    <input type="checkbox" defaultChecked />
                  </label>
                  <label className="settings-row">
                    <span>
                      <strong>Compact dashboard</strong>
                      <small>Keep dashboard cards tight and scan-friendly</small>
                    </span>
                    <input type="checkbox" defaultChecked />
                  </label>
                </div>
              </Card>

              <EmailActions />
            </div>

            <div className="right-column stack-lg">
              <Card title="Account" subtitle="Current session">
                <div className="account-details">
                  <div>
                    <span>Signed in as</span>
                    <strong>{userEmail || profileDisplayName}</strong>
                  </div>
                  <div>
                    <span>Theme</span>
                    <strong>Use the toggle in the top bar</strong>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        <button
          type="button"
          className="floating-add-expense"
          onClick={() => setActiveModal('expense')}
          aria-label="Add expense"
        >
          <span>Add Expense</span>
          <strong>+</strong>
        </button>
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
        subtitle={editingExpense ? "Update expense details" : "Add a splitting expense to a group"}
        onClose={closeModal}
      >
        <ExpenseForm onSuccess={closeModal} editingExpense={editingExpense} initialGroupId={selectedGroupId} />
      </Modal>

      <Modal
        isOpen={activeModal === 'groupDetails'}
        title={selectedGroup ? `Group Details · ${selectedGroup.name}` : 'Group Details'}
        subtitle={selectedGroup ? 'Deep dive into members, outstanding, and expenses' : 'Choose a group first'}
        onClose={closeModal}
      >
        <GroupDetails
          group={selectedGroup}
          memberNames={selectedGroupMemberNames}
          expenses={selectedGroupExpenses}
          position={selectedGroupPosition}
        />
      </Modal>

      <Modal
        isOpen={activeModal === 'recurring'}
        title="Recurring Bills"
        subtitle="Manage repeating bills like rent, subscriptions, and utilities"
        onClose={closeModal}
      >
        <RecurringExpensesManager />
      </Modal>

      {isNotificationsOpen && (
        <NotificationsDropdown
          onClose={closeNotifications}
          onUnreadCountChange={handleNotificationsRead}
        />
      )}
    </>
  );
};

export default DashboardPage;
