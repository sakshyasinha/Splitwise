import { create } from "zustand";
import {
  addExpense as addExpenseService,
  deleteExpense as deleteExpenseService,
  updateExpense as updateExpenseService,
  getMyDues as getMyDuesService,
  settleDue as settleDueService,
  getExpenses as getExpensesService,
} from "../services/expense.service.js";

import {
  createGroup as createGroupService,
  getGroups as getGroupsService,
} from "../services/group.service.js";

const getGroupKey = (group) => {
  const creator = Array.isArray(group?.createdBy) ? group.createdBy[0] : group?.createdBy;
  const creatorId = creator && typeof creator === "object" ? creator._id || creator.id : creator;

  return `${String(group?.name || "").trim().toLowerCase()}::${String(creatorId || "")}`;
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

const useExpenseStore = create((set, get) => ({
  expenses: [],
  groups: [],
  myDues: [],
  totalOwed: 0,
  loading: false,
  error: null,

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
        expenses: data || [],
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

      set((state) => ({
        expenses: [expense, ...state.expenses],
        loading: false,
      }));

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

      set((state) => ({
        expenses: state.expenses.map((expense) =>
          expense._id === id ? updatedExpense : expense
        ),
        loading: false,
      }));

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
      set({ loading: true, error: null });

      await deleteExpenseService(id);

      set((state) => ({
        expenses: state.expenses.filter((expense) => expense._id !== id),
        loading: false,
      }));
    } catch (error) {
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

  settleDue: async (expenseId) => {
    try {
      set({ loading: true, error: null });

      await settleDueService(expenseId);

      // refresh data after settlement
      const [expensesData, duesData] = await Promise.all([
        getExpensesService(),
        getMyDuesService(),
      ]);

      set({
        expenses: expensesData || [],
        myDues: duesData.dues || [],
        totalOwed: Number(duesData.totalOwed || 0),
        loading: false,
      });
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

  // ------------------ UTIL ------------------
  resetState: () =>
    set({
      expenses: [],
      groups: [],
      myDues: [],
      totalOwed: 0,
      loading: false,
      error: null,
    }),

  clearError: () => set({ error: null }),
}));

export default useExpenseStore;