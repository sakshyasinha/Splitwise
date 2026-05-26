import { useState } from 'react';
import { askAI } from '../../services/ai.service.js';
import useExpenses from '../../hooks/useExpenses.js';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';

const QUICK_PROMPTS = [
  'How should I settle this week with minimal transactions?',
  'Where am I overspending based on my current activity?',
  'Give me 3 ways to reduce group spending this month.'
];

/* =========================
   SAFE SOURCE PARSER
========================= */

const parseResponse = (raw = '') => {
  const parts = raw.split(/\nSources?:\s*/i);

  const answer = parts[0].trim();

  let sources = [];

  if (parts[1]) {
    sources = parts[1]
      .split('\n')
      .map(s => s.replace(/^[-•\s]+/, '').trim())
      .filter(Boolean);
  }

  return { answer, sources };
};

/* =========================
   SAFE CONTEXT BUILDER
   (reduces hallucination risk)
========================= */

const buildContext = (data) => ({
  summary: {
    totalOwed: data.totalOwed,
    totalLent: data.totalLent,
    expenseCount: data.expenses?.length || 0,
    groupCount: data.groups?.length || 0
  },
  breakdown: data.breakdown,
  expenses: data.expenses,
  groups: data.groups,
  myDues: data.myDues,
  myLents: data.myLents,
  friends: data.friends
});

export default function AIChatPanel() {
  const data = useExpenses();

  const [prompt, setPrompt] = useState(
    'Suggest one way to reduce group expenses this week.'
  );
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();

    if (!prompt.trim()) return;

    setLoading(true);
    setError('');

    try {
      const context = buildContext(data);

      const response = await askAI(prompt, context);

      const raw = response.reply || response.message || '';

      const { answer, sources } = parseResponse(raw);

      setAnswer(answer);
      setSources(sources);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err.message ||
        'AI request failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="AI Assistant"
      subtitle="Splitwise-style spending and settlement guidance"
    >
      <div className="quick-actions">
        {QUICK_PROMPTS.map((item) => (
          <button
            key={item}
            type="button"
            className="quick-chip"
            onClick={() => setPrompt(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <form className="stack" onSubmit={onSubmit}>
        <label className="input-block" htmlFor="ai-prompt">
          <span className="input-label">Prompt</span>

          <textarea
            id="ai-prompt"
            className="input"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>

        <Button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? 'Thinking...' : 'Ask AI'}
        </Button>
      </form>

      {error && <p className="banner error">{error}</p>}

      {answer && (
        <div className="ai-response">
          <p>{answer}</p>

          {sources.length > 0 && (
            <div className="ai-sources">
              <strong>Sources</strong>
              <ul>
                {sources.map((s, i) => (
                  <li key={`${s}-${i}`}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}