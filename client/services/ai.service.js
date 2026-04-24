import API from './api.js';

export async function askAI(prompt, context = {}) {
  const response = await API.post('/ai/chat', { prompt, context });
  return response.data;
}