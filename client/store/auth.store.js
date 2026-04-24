import { create } from 'zustand';
import { login as loginService, register as registerService } from '../services/auth.service.js';
import useExpenseStore from './expense.store.js';

function decodeTokenUser(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1] || ''));
        return {
            id: payload?.id || null,
            exp: payload?.exp || null
        };
    } catch (_error) {
        return null;
    }
}

function readPersistedUser() {
    try {
        const user = sessionStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch (_error) {
        return null;
    }
}

const persistedToken = sessionStorage.getItem('token') || localStorage.getItem('token') || null;
if (!sessionStorage.getItem('token') && localStorage.getItem('token')) {
    sessionStorage.setItem('token', localStorage.getItem('token'));
}
localStorage.removeItem('token');

const persistedUser = readPersistedUser();

function persistSession({ token, user }) {
    sessionStorage.setItem('token', token);
    if (user) {
        sessionStorage.setItem('user', JSON.stringify(user));
        if (user.email) {
            sessionStorage.setItem('email', user.email);
        }
    }
    localStorage.removeItem('token');
}

function clearSession() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('email');
    localStorage.removeItem('token');
}

const useAuthStore = create((set, get) => ({
    token: persistedToken,
    user: persistedUser || (persistedToken ? decodeTokenUser(persistedToken) : null),
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
            persistSession({ token: data.token, user: data.user || null });
            useExpenseStore.getState().resetState();
            set({ token: data.token, user: data.user || decodeTokenUser(data.token), loading: false });
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
        clearSession();
        useExpenseStore.getState().resetState();
        set({ token: null, user: null, error: null });
    },
    handleAuthExpired: () => {
        clearSession();
        useExpenseStore.getState().resetState();
        set({ token: null, user: null, error: 'Your session expired. Please sign in again.' });
    },
    isAuthenticated: () => Boolean(get().token)
}));

if (typeof window !== 'undefined') {
    window.addEventListener('splitwise:auth-expired', () => {
        useAuthStore.getState().handleAuthExpired();
    });
}

export default useAuthStore;