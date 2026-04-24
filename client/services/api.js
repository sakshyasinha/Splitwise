import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const API=axios.create({
    baseURL: API_BASE_URL,
});

API.interceptors.request.use((req)=>{
    const token=sessionStorage.getItem('token');
    if(token) req.headers.Authorization='Bearer '+token;
    return req;
});

export default API;