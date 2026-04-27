import API from './api.js';

export async function createGroup(payload) {
  const response = await API.post('/groups/create', payload);
  return response.data;
}
export async function getGroups() {
  const response = await API.get('/groups');
  return response.data;
}