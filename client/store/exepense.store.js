import { create } from "zustand";
import API from "../services/api.js"; // adjust path if needed

const useExpenseStore = create((set) => ({
  expenses: [],
  groups: [],
  myDues: [],
  totalOwed: 0,
  loading: false,
  error: null,

  fetchExpenses: async () => {
    try {
      set({ loading: true });

      const res = await API.get("/expenses");

      set({
        expenses: res.data,
        loading: false,
      });
    } catch (err) {
      set({
        error: err.message || "Failed to fetch expenses",
        loading: false,
      });
    }
  },

  resetStore: () =>
    set({
      expenses: [],
      groups: [],
      myDues: [],
      totalOwed: 0,
      loading: false,
      error: null,
    }),
}));

export default useExpenseStore;