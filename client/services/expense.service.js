import API from './api.js';

export async function addExpense(payload) {
  const response = await API.post('/expenses/add', payload);
  return response.data;
}

export async function getMyDues() {
  const response = await API.get('/expenses/my');
  return response.data;
}