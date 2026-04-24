import API from './api.js';

export async function addExpense(payload) {
  const response = await API.post('/expenses/add', payload);
  return response.data;
}

export async function getExpenses() {
  const response = await API.get('/expenses');
  return response.data;
}

export async function updateExpense(id, payload) {
  const response = await API.put(`/expenses/${id}`, payload);
  return response.data;
}

export async function deleteExpense(id) {
  const response = await API.delete(`/expenses/${id}`);
  return response.data;
}

export async function getMyDues() {
  const response = await API.get('/expenses/my');
  return response.data;
}