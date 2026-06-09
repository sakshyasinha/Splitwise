import axios from 'axios';
import useAuthStore from '../store/auth.store.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const API=axios.create({
    baseURL: API_BASE_URL,
});

const clearAuthSession = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('email');
};


API.interceptors.request.use((req)=>{
    // Prefer the in-memory auth store token to avoid any boot-timing / persistence edge-cases.
    const token = useAuthStore.getState().token || sessionStorage.getItem('token');
    if(token) req.headers.Authorization='Bearer '+token;
    return req;
});


API.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error?.response?.status === 401) {
            clearAuthSession();
            window.dispatchEvent(new Event('splitwise:auth-expired'));
        }

        return Promise.reject(error);
    }
);

export default API;