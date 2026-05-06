import API from './api.js';

export async function createGroup(payload) {
  const response = await API.post('/groups/create', payload);
  return response.data;
}

export async function getGroups() {
  const response = await API.get('/groups');
  return response.data;
}

export async function updateGroup(groupId, payload) {
  const response = await API.put(`/groups/${groupId}`, payload);
  return response.data;
}

export async function deleteGroup(groupId) {
  const response = await API.delete(`/groups/${groupId}`);
  return response.data;
}

export async function addGroupMember(groupId, memberId) {
  const response = await API.patch(`/groups/${groupId}/members/add`, { memberId });
  return response.data;
}

export async function removeGroupMember(groupId, memberId) {
  const response = await API.patch(`/groups/${groupId}/members/remove`, { memberId });
  return response.data;
}

export async function getGroupBalance(groupId) {
  const response = await API.get(`/groups/${groupId}/balance`);
  return response.data;
}