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
import DuesList from './DuesList.jsx';
import GroupDetails from './GroupDetails.jsx';
import ActivityFeed from './ActivityFeed.jsx';
import AnalyticsDashboard from '../analytics/AnalyticsDashboard.jsx';
import { formatCurrency } from '../../utils/formatCurrency.js';
import { getPersonLabel } from '../../utils/personUtils.js';
import { normalizeGroupName, dedupeValues, prettifyGroupType } from '../../utils/stringUtils.js';

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
    fetchExpenseBreakdown,
    fetchFriendsList,
  } = useExpenses();

  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [settlingExpenseId, setSettlingExpenseId] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);

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
        const netBalance = userId
          ? groupExpenses.reduce((sum, expense) => sum + getUserBalanceForExpense(expense, userId), 0)
          : 0;
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
      const netBalance = userId
        ? (group.groupExpenses || []).reduce((sum, expense) => sum + getUserBalanceForExpense(expense, userId), 0)
        : 0;
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
    ? dedupeValues([
        ...(selectedGroup.members || []).map((member, index) => getPersonLabel(member, index, user)),
        ...selectedGroupExpenses.flatMap((expense) =>
          getExpensePeople(expense).map((person, index) => getPersonLabel(person, index, user))
        ),
        ...(selectedGroup.dues || []).map((due) => getPersonLabel(due.paidTo, 0, user)),
      ])
    : [];

  const selectedGroupPosition = selectedGroup
    ? Number(selectedGroup.netBalance || 0) < 0
      ? {
          tone: 'danger',
          badgeClass: 'badge-red',
          badgeText: 'Borrowed',
          amount: Math.abs(Number(selectedGroup.netBalance || 0)),
        }
      : Number(selectedGroup.netBalance || 0) > 0
        ? {
            tone: 'success',
            badgeClass: 'badge-green',
            badgeText: 'Lent',
            amount: Number(selectedGroup.netBalance || 0),
          }
        : {
            tone: 'success',
            badgeClass: 'badge-green',
            badgeText: 'Settled',
            amount: 0,
          }
    : null;

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
        <DashboardHeader onLogout={logout} />

        <HeroStrip pendingDuesCount={myDues.length} />

        <StatsGrid
          groupCount={prioritizedGroups.length}
          totalLent={totalLent}
          totalOwed={totalOwed}
          expenseCount={totals.expenseCount}
          totalSpend={totals.totalSpend}
        />

        <section className="content-grid">
          <div className="left-column stack-lg">
            <QuickActions
              onCreateGroup={() => setActiveModal('group')}
              onAddExpense={() => setActiveModal('expense')}
            />

            <GroupList
              groups={prioritizedGroups}
              selectedGroupId={selectedGroupId}
              onGroupClick={openGroupDetailsFor}
              onGroupEdit={openEditGroup}
            />

            <ExpenseList onEdit={openEditExpense} />
          </div>

          <div className="right-column stack-lg">
            <DuesList
              dues={myDues}
              settlingExpenseId={settlingExpenseId}
              onSettleDue={handleSettleDue}
            />

            

            <AIChatPanel />
          </div>
        </section>

        <section className="analytics-section">
          <AnalyticsDashboard />
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
        subtitle={editingExpense ? "Update expense details" : "Add a splitting expense to a group"}
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
        <GroupDetails
          group={selectedGroup}
          memberNames={selectedGroupMemberNames}
          expenses={selectedGroupExpenses}
          position={selectedGroupPosition}
        />
      </Modal>
    </>
  );
};

export default DashboardPage;