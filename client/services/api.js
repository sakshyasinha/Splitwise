import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const API=axios.create({
    baseURL: API_BASE_URL,
});

const clearAuthSession = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('email');
    localStorage.removeItem('token');
};

API.interceptors.request.use((req)=>{
    const token=sessionStorage.getItem('token');
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