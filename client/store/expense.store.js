import { create } from "zustand";
import {
  addExpense as addExpenseService,
  deleteExpense as deleteExpenseService,
  updateExpense as updateExpenseService,
  getMyDues as getMyDuesService,
  getMyLents as getMyLentsService,
  settleDue as settleDueService,
  getExpenses as getExpensesService,
  getExpenseBreakdown as getExpenseBreakdownService,
  getFriendsList as getFriendsListService,
} from "../services/expense.service.js";

import { getUserNetBalance as getUserNetBalanceService } from "../services/debt.service.js";

import {
  createGroup as createGroupService,
  getGroups as getGroupsService,
  getGroupBalance as getGroupBalanceService,
} from "../services/group.service.js";

const getGroupKey = (group) => {
  const creator = Array.isArray(group?.createdBy) ? group.createdBy[0] : group?.createdBy;
  const creatorId = creator && typeof creator === "object" ? creator._id || creator.id : creator;

  return `${String(group?.name || "").trim().toLowerCase()}::${String(group?.type || "other").trim().toLowerCase()}::${String(creatorId || "")}`;
};

const dedupeGroups = (groups = []) => {
  const seen = new Set();

  return (groups || []).filter((group) => {
    const key = getGroupKey(group);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const emptyDebtSnapshot = {
  totalBalance: 0,
  totalOwed: 0,
  totalToReceive: 0,
  owesTo: [],
  owedBy: [],
  groupBreakdown: [],
};

const getLedgerIdentityKey = (item) => String(
  item?.canonicalLedgerId ||
  item?.ledgerNodeId ||
  item?.transactionId ||
  item?.sourceExpenseId ||
  item?.expenseId ||
  item?._id ||
  ''
).trim();

const getLedgerPriority = (item) => {
  const state = String(item?.ledgerState || item?.status || '').toLowerCase();
  return state === 'settled' || state === 'paid' || item?.isSettled ? 2 : 1;
};

const dedupeLedgerRows = (rows = []) => {
  const byKey = new Map();

  rows.forEach((row, index) => {
    if (!row) return;
    const key = getLedgerIdentityKey(row) || `row-${index}`;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, row);
      return;
    }

    const currentPriority = getLedgerPriority(row);
    const existingPriority = getLedgerPriority(existing);
    if (currentPriority > existingPriority) {
      byKey.set(key, row);
      return;
    }

    if (currentPriority === existingPriority) {
      const currentTime = new Date(row.updatedAt || row.createdAt || 0).getTime();
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      if (currentTime >= existingTime) {
        byKey.set(key, row);
      }
    }
  });

  return Array.from(byKey.values());
};

const loadFinancialSummary = async () => {
  const [duesData, lentsData, debtData] = await Promise.all([
    getMyDuesService(),
    getMyLentsService(),
    getUserNetBalanceService(),
  ]);

  return {
    myDues: dedupeLedgerRows(duesData?.dues || []),
    totalOwed: Number(duesData?.totalOwed || 0),
    myLents: dedupeLedgerRows(lentsData?.lents || []),
    totalLent: Number(lentsData?.totalLent || 0),
    debtSnapshot: debtData || emptyDebtSnapshot,
  };
};

const useExpenseStore = create((set, get) => ({
  expenses: [],
  groups: [],
  myDues: [],
  myLents: [],
  totalOwed: 0,
  totalLent: 0,
  loading: false,
  error: null,
  // New state for breakdown and friends
  breakdown: {
    personal: { total: 0, count: 0, expenses: [] },
    shared: { total: 0, count: 0, expenses: [] },
    total: 0
  },
  friends: {
    friends: [],
    totalOwedToMe: 0,
    totalIOwe: 0,
    netBalance: 0
  },
  debtSnapshot: emptyDebtSnapshot,

  // ------------------ GROUPS ------------------
  fetchGroups: async () => {
    try {
      set({ loading: true, error: null });

      const data = await getGroupsService();

      set({
        groups: dedupeGroups(data || []),
        loading: false,
      });

      return data;
    } catch (err) {
      set({
        error:
          err?.response?.data?.message ||
          err.message ||
          "Failed to fetch groups",
        loading: false,
      });
      throw err;
    }
  },

  fetchBalanceSnapshot: async () => {
    try {
      set({ loading: true, error: null });

      const data = await loadFinancialSummary();

      set({
        ...data,
        loading: false,
      });

      return data;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          'Failed to fetch balance snapshot',
      });
      throw error;
    }
  },

  createGroup: async (payload) => {
    try {
      set({ loading: true, error: null });

      const group = await createGroupService(payload);

      set((state) => ({
        groups: dedupeGroups([group, ...state.groups]),
        loading: false,
      }));

      return group;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to create group",
      });
      throw error;
    }
  },

  // ------------------ EXPENSES ------------------
  fetchExpenses: async () => {
    try {
      set({ loading: true, error: null });

      const data = await getExpensesService();

      set({
        expenses: dedupeLedgerRows(data || []),
        loading: false,
      });

      return data;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to fetch expenses",
      });
      throw error;
    }
  },

  addExpense: async (payload) => {
    try {
      set({ loading: true, error: null });

      const expense = await addExpenseService(payload);

      const [expensesData, balanceData] = await Promise.all([
        getExpensesService(),
        loadFinancialSummary(),
      ]);

      set({
        expenses: expensesData || [expense],
        ...balanceData,
        loading: false,
      });

      window.dispatchEvent(new Event('splitwise:notifications-updated'));

      return expense;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to add expense",
      });
      throw error;
    }
  },

  updateExpense: async (id, payload) => {
    try {
      set({ loading: true, error: null });

      const updatedExpense = await updateExpenseService(id, payload);

      const [expensesData, balanceData] = await Promise.all([
        getExpensesService(),
        loadFinancialSummary(),
      ]);

      set({
        expenses: dedupeLedgerRows(expensesData || [updatedExpense]),
        ...balanceData,
        loading: false,
      });

      return updatedExpense;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to update expense",
      });
      throw error;
    }
  },

  deleteExpense: async (id) => {
    try {
      console.log('Store: Starting delete for expense', id);
      console.log('Store: Current expenses count:', get().expenses.length);
      set({ loading: true, error: null });

      await deleteExpenseService(id);
      console.log('Store: Backend delete completed');

      // Force a complete refresh of all data to ensure consistency
      console.log('Store: Refreshing all data from backend...');
      const [expensesData, balanceData] = await Promise.all([
        getExpensesService(),
        loadFinancialSummary()
      ]);

      console.log('Store: Backend refresh completed');
      console.log('Store: New expenses count:', expensesData.length);
      console.log('Store: New dues count:', balanceData.myDues?.length || 0);
      console.log('Store: New lents count:', balanceData.myLents?.length || 0);

      // Update all state with fresh data from backend
      set({
        expenses: expensesData || [],
        ...balanceData,
        loading: false,
      });

      window.dispatchEvent(new Event('splitwise:notifications-updated'));

      console.log('Store: State update completed');

    } catch (error) {
      console.error('Store: Error deleting expense:', error);
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to delete expense",
      });
      throw error;
    }
  },

  // ------------------ DUES ------------------
  fetchMyDues: async () => {
    try {
      set({ loading: true, error: null, myDues: [], totalOwed: 0 });

      const data = await getMyDuesService();

      set({
        myDues: data.dues || [],
        totalOwed: Number(data.totalOwed || 0),
        loading: false,
      });

      return data;
    } catch (error) {
      set({
        loading: false,
        myDues: [],
        totalOwed: 0,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to load dues",
      });
      throw error;
    }
  },

  fetchMyLents: async () => {
    try {
      set({ loading: true, error: null, myLents: [], totalLent: 0 });

      const data = await getMyLentsService();

      set({
        myLents: data.lents || [],
        totalLent: Number(data.totalLent || 0),
        loading: false,
      });

      return data;
    } catch (error) {
      set({
        loading: false,
        myLents: [],
        totalLent: 0,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to load lents",
      });
      throw error;
    }
  },

  settleDue: async (expenseId) => {
    try {
      set({ loading: true, error: null });

      await settleDueService(expenseId);

      // refresh data after settlement
      const [expensesData, balanceData] = await Promise.all([
        getExpensesService(),
        loadFinancialSummary(),
      ]);

      set({
        expenses: expensesData || [],
        ...balanceData,
        loading: false,
      });

      window.dispatchEvent(new Event('splitwise:notifications-updated'));
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to settle due",
      });
      throw error;
    }
  },

  updateGroup: async (groupId, payload) => {
    set({ loading: true, error: null });
    try {
      const { updateGroup } = await import('../services/group.service.js');
      await updateGroup(groupId, payload);
      await get().fetchGroups();
      set({ loading: false });
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to update group",
      });
      throw error;
    }
  },

  deleteGroup: async (groupId) => {
    set({ loading: true, error: null });
    try {
      const { deleteGroup } = await import('../services/group.service.js');
      await deleteGroup(groupId);
      await get().fetchGroups();
      set({ loading: false });
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to delete group",
      });
      throw error;
    }
  },

  addGroupMember: async (groupId, memberId) => {
    set({ loading: true, error: null });
    try {
      const { addGroupMember } = await import('../services/group.service.js');
      await addGroupMember(groupId, memberId);
      await get().fetchGroups();
      set({ loading: false });
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to add member",
      });
      throw error;
    }
  },

  removeGroupMember: async (groupId, memberId) => {
    set({ loading: true, error: null });
    try {
      const { removeGroupMember } = await import('../services/group.service.js');
      await removeGroupMember(groupId, memberId);
      await get().fetchGroups();
      set({ loading: false });
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to remove member",
      });
      throw error;
    }
  },

  // ------------------ BREAKDOWN & FRIENDS ------------------
  fetchExpenseBreakdown: async () => {
    try {
      set({ loading: true, error: null });

      const data = await getExpenseBreakdownService();

      set({
        breakdown: data || {
          personal: { total: 0, count: 0, expenses: [] },
          shared: { total: 0, count: 0, expenses: [] },
          total: 0
        },
        loading: false,
      });

      return data;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to fetch expense breakdown",
      });
      throw error;
    }
  },

  fetchFriendsList: async () => {
    try {
      set({ loading: true, error: null });

      const data = await getFriendsListService();

      set({
        friends: data || {
          friends: [],
          totalOwedToMe: 0,
          totalIOwe: 0,
          netBalance: 0
        },
        loading: false,
      });

      return data;
    } catch (error) {
      set({
        loading: false,
        error:
          error?.response?.data?.message ||
          error.message ||
          "Failed to fetch friends list",
      });
      throw error;
    }
  },

  // ------------------ UTIL ------------------
  resetState: () =>
    set({
      expenses: [],
      groups: [],
      myDues: [],
      myLents: [],
      totalOwed: 0,
      totalLent: 0,
      debtSnapshot: emptyDebtSnapshot,
      loading: false,
      error: null,
    }),

  clearError: () => set({ error: null }),
}));

export default useExpenseStore;