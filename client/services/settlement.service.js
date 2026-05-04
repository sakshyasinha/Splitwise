import API from './api.js';

export async function createSettlement(payload) {
  const response = await API.post('/settlements', payload);
  return response.data;
}

export async function getSettlementHistory() {
  const response = await API.get('/settlements/history');
  return response.data;
}

export async function getSettlementsByGroup(groupId) {
  const response = await API.get(`/settlements/group/${groupId}`);
  return response.data;
}