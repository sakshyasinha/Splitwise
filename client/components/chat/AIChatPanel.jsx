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

export default function AIChatPanel() {
  const { totalOwed, expenses, groups } = useExpenses();
  const [prompt, setPrompt] = useState('Suggest one way to reduce group expenses this week.');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await askAI(prompt, {
        totalOwed,
        expenseCount: expenses.length,
        groupCount: groups.length
      });
      setAnswer(data.reply || data.message || JSON.stringify(data));
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="AI Assistant"
      subtitle="Splitwise-style spending and settlement guidance"
      className="sticky"
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
            onChange={(event) => setPrompt(event.target.value)}
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
        </div>
      )}
    </Card>
  );
}