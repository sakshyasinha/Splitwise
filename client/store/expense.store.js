import { create } from "zustand";
import {
  addExpense as addExpenseService,
  deleteExpense as deleteExpenseService,
  updateExpense as updateExpenseService,
  getMyDues as getMyDuesService,
  getExpenses as getExpensesService, // ✅ NEW
} from "../services/expense.service.js";
import { createGroup as createGroupService } from "../services/group.service.js";

const useExpenseStore = create((set) => ({
  expenses: [],
  groups: [],
  myDues: [],
  totalOwed: 0,
  loading: false,
  error: null,

  // 🔄 Reset state (important for user switching)
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

  // ✅ FETCH EXPENSES (FIXES YOUR BUG)
  fetchExpenses: async () => {
    set({ loading: true, error: null });

    try {
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

  // ➕ Add expense
  addExpense: async (payload) => {
    set({ loading: true, error: null });

    try {
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

  // ✏️ Update expense
  updateExpense: async (id, payload) => {
    set({ loading: true, error: null });

    try {
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

  // 🗑️ Delete expense
  deleteExpense: async (id) => {
    set({ loading: true, error: null });

    try {
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

  // 💰 Fetch dues
  fetchMyDues: async () => {
    set({ loading: true, error: null, myDues: [], totalOwed: 0 });

    try {
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

  // 👥 Create group
  createGroup: async (payload) => {
    set({ loading: true, error: null });

    try {
      const group = await createGroupService(payload);

      set((state) => ({
        groups: [group, ...state.groups],
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
}));

export default useExpenseStore;