import API from './api.js';

export async function login(payload) {
  const response = await API.post('/auth/login', payload);
  return response.data;
}

export async function register(payload) {
  const response = await API.post('/auth/register', payload);
  return response.data;
}

export async function getGoogleAuthConfig() {
  const response = await API.get('/auth/google/config');
  return response.data;
}

export async function loginWithGoogle(payload) {
  const response = await API.post('/auth/google', payload);
  return response.data;
}
