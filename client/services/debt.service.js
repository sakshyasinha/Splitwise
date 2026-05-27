import API from './api.js';

export async function getUserNetBalance() {
  const response = await API.get('/debt/user/balance');
  return response.data;
}
