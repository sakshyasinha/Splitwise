import axios from 'axios';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const normalizePrompt = (prompt) => String(prompt || '').trim();

/**
 * Calls Ollama HTTP API /api/generate
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export const ollamaGenerate = async ({ prompt, model = OLLAMA_MODEL, options = {} }) => {
  const cleanPrompt = normalizePrompt(prompt);
  if (!cleanPrompt) throw new Error('Ollama prompt is empty');

  const url = `${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`;

  const res = await axios.post(
    url,
    {
      model,
      prompt: cleanPrompt,
      stream: false,
      options
    },
    {
      timeout: 120000
    }
  );

  // Ollama returns: { model, created_at, response, done, ... }
  return res.data?.response ?? '';
};

export const getOllamaConfig = () => ({
  baseUrl: OLLAMA_BASE_URL,
  model: OLLAMA_MODEL
});

