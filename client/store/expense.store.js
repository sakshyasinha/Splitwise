import { create } from 'zustand';
import { addExpense as addExpenseService, getMyDues as getMyDuesService } from '../services/expense.service.js';
import { createGroup as createGroupService } from '../services/group.service.js';

const useExpenseStore = create((set) => ({
  expenses: [],
  groups: [],
  myDues: [],
  totalOwed: 0,
  loading: false,
  error: null,
  resetState: () =>
    set({
      expenses: [],
      groups: [],
      myDues: [],
      totalOwed: 0,
      loading: false,
      error: null
    }),
  clearError: () => set({ error: null }),
  addExpense: async (payload) => {
    set({ loading: true, error: null });
    try {
      const expense = await addExpenseService(payload);
      set((state) => ({
        expenses: [expense, ...state.expenses],
        loading: false
      }));
      return expense;
    } catch (error) {
      set({
        loading: false,
        error: error?.response?.data?.message || error.message || 'Failed to add expense'
      });
      throw error;
    }
  },
  fetchMyDues: async () => {
    set({ loading: true, error: null, myDues: [], totalOwed: 0 });
    try {
      const data = await getMyDuesService();
      set({
        myDues: data.dues || [],
        totalOwed: Number(data.totalOwed || 0),
        loading: false
      });
      return data;
    } catch (error) {
      set({
        loading: false,
        myDues: [],
        totalOwed: 0,
        error: error?.response?.data?.message || error.message || 'Failed to load dues'
      });
      throw error;
    }
  },
  createGroup: async (payload) => {
    set({ loading: true, error: null });
    try {
      const group = await createGroupService(payload);
      set((state) => ({
        groups: [group, ...state.groups],
        loading: false
      }));
      return group;
    } catch (error) {
      set({
        loading: false,
        error: error?.response?.data?.message || error.message || 'Failed to create group'
      });
      throw error;
    }
  }
}));

export default useExpenseStore;