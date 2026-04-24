import { create } from 'zustand';
import { login as loginService, register as registerService } from '../services/auth.service.js';
import useExpenseStore from './expense.store.js';

const persistedToken = sessionStorage.getItem('token') || localStorage.getItem('token') || null;
if (!sessionStorage.getItem('token') && localStorage.getItem('token')) {
    sessionStorage.setItem('token', localStorage.getItem('token'));
}
localStorage.removeItem('token');

const useAuthStore = create((set, get) => ({
    token: persistedToken,
    user: null,
    loading: false,
    error: null,
    clearError: () => set({ error: null }),
    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const data = await loginService({ email, password });
            if (!data.token) {
                throw new Error('Token missing in login response');
            }
            sessionStorage.setItem("token", data.token);
            localStorage.removeItem('token');
            useExpenseStore.getState().resetState();
            set({ token: data.token, loading: false });
            return data;
        } catch (error) {
            set({
                loading: false,
                error: error?.response?.data?.message || error.message || 'Login failed'
            });
            throw error;
        }
    },
    register: async (payload) => {
        set({ loading: true, error: null });
        try {
            const data = await registerService(payload);
            set({ loading: false });
            return data;
        } catch (error) {
            set({
                loading: false,
                error: error?.response?.data?.message || error.message || 'Register failed'
            });
            throw error;
        }
    },
    logout: () => {
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');
        useExpenseStore.getState().resetState();
        set({ token: null, user: null, error: null });
    },
    isAuthenticated: () => Boolean(get().token)
}));

export default useAuthStore;