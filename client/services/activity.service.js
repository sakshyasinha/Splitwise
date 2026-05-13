import API from './api.js';

export async function getActivityFeed(params = {}) {
  const response = await API.get('/activity/feed', { params });
  return response.data;
}

export async function getGroupActivityFeed(groupId, params = {}) {
  const response = await API.get(`/activity/group/${groupId}`, { params });
  return response.data;
}

export async function markActivitiesAsRead(activityIds) {
  const response = await API.put('/activity/read', { activityIds });
  return response.data;
}

export async function markAllActivitiesAsRead() {
  const response = await API.put('/activity/read-all');
  return response.data;
}

export async function getActivityStatistics() {
  const response = await API.get('/activity/statistics');
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await API.get('/activity/unread-count');
  return response.data;
}

export async function sendPaymentReminder(toUserId, amount, groupId = null, message = '') {
  const response = await API.post('/settlement/nudge', {
    toUserId,
    amount,
    groupId,
    message
  });
  return response.data;
}