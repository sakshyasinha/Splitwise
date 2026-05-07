import API from './api.js';

export async function getEmailStatus() {
  const response = await API.get('/email/status');
  return response.data;
}

export async function testEmailConfiguration() {
  const response = await API.get('/email/test');
  return response.data;
}

export async function sendTestEmail(payload) {
  const response = await API.post('/email/test-send', payload);
  return response.data;
}

export async function sendDebtNudgeEmail(payload) {
  const response = await API.post('/email/nudge', payload);
  return response.data;
}