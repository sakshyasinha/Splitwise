import { retrieveRelevantDocs } from './retriever.service.js';

/* =========================
   UTILITIES
========================= */

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));

const asArray = (v) => (Array.isArray(v) ? v : []);

const normalizeText = (v) => String(v || '').toLowerCase().trim();

/* =========================
   INTENT CLASSIFIER (IMPROVED)
   - less brittle than regex-only
========================= */

const classifyIntent = (prompt) => {
  const p = normalizeText(prompt);

  const settlementKeywords = [
    'settle', 'pay', 'minimal transaction', 'clear dues', 'balance', 'who owes'
  ];

  const overspendKeywords = [
    'overspend', 'spending', 'where am i spending', 'breakdown', 'activity'
  ];

  const savingsKeywords = [
    'reduce', 'save', 'cut', 'lower', 'avoid spending'
  ];

  if (settlementKeywords.some(k => p.includes(k))) return 'SETTLEMENT';
  if (overspendKeywords.some(k => p.includes(k))) return 'OVERVIEW';
  if (savingsKeywords.some(k => p.includes(k))) return 'SAVINGS';

  return 'GENERIC';
};

/* =========================
   CORE FINANCE ENGINE (FIXED)
   This replaces fake heuristics
========================= */

const computeNetBalances = (expenses = []) => {
  const balanceMap = new Map();

  for (const exp of expenses) {
    const amount = Number(exp?.amount || 0);
    if (!amount) continue;

    const paidBy = exp?.paidBy || 'unknown';
    const participants = asArray(exp?.involved);

    const split = amount / Math.max(participants.length, 1);

    // payer gets +amount
    balanceMap.set(paidBy, (balanceMap.get(paidBy) || 0) + amount);

    // participants owe -split
    for (const p of participants) {
      balanceMap.set(p, (balanceMap.get(p) || 0) - split);
    }
  }

  return balanceMap;
};

/* Greedy settlement minimization */
const minimizeTransactions = (balanceMap) => {
  const creditors = [];
  const debtors = [];

  for (const [person, amount] of balanceMap.entries()) {
    if (amount > 0) creditors.push({ person, amount });
    else if (amount < 0) debtors.push({ person, amount: -amount });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];

  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debit = debtors[i];
    const credit = creditors[j];

    const settle = Math.min(debit.amount, credit.amount);

    transactions.push({
      from: debit.person,
      to: credit.person,
      amount: settle
    });

    debit.amount -= settle;
    credit.amount -= settle;

    if (debit.amount === 0) i++;
    if (credit.amount === 0) j++;
  }

  return transactions;
};

/* =========================
   REPLIES
========================= */

const buildSettlementReply = ({ prompt, context }) => {
  const expenses = asArray(context.expenses);

  const balances = computeNetBalances(expenses);
  const transactions = minimizeTransactions(balances);

  if (!transactions.length) {
    return `Prompt: ${prompt}

Deterministic settlement:
- No pending balances detected.`;
  }

  const total = transactions.reduce((s, t) => s + t.amount, 0);

  const lines = [
    `Prompt: ${prompt}`,
    '',
    'Deterministic settlement plan:',
    `- Total optimized transfers: ${transactions.length}`,
    `- Total settlement volume: ${formatCurrency(total)}`,
    ''
  ];

  for (const t of transactions.slice(0, 6)) {
    lines.push(`- ${t.from} pays ${t.to}: ${formatCurrency(t.amount)}`);
  }

  if (transactions.length > 6) {
    lines.push(`- +${transactions.length - 6} more transactions optimized`);
  }

  return lines.join('\n');
};

const buildOverspendReply = ({ prompt, context }) => {
  const expenses = asArray(context.expenses);

  const groupMap = new Map();

  for (const e of expenses) {
    const g = e?.group?.name || 'Ungrouped';
    const amt = Number(e?.amount || 0);
    groupMap.set(g, (groupMap.get(g) || 0) + amt);
  }

  const sorted = [...groupMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const total = sorted.reduce((s, g) => s + g.amount, 0);

  const lines = [
    `Prompt: ${prompt}`,
    '',
    'Spending breakdown:',
    `- Total spend: ${formatCurrency(total)}`,
    ''
  ];

  if (sorted.length) {
    lines.push(`- Top category: ${sorted[0].name} (${formatCurrency(sorted[0].amount)})`);

    sorted.slice(1, 4).forEach(g => {
      lines.push(`- ${g.name}: ${formatCurrency(g.amount)}`);
    });
  }

  return lines.join('\n');
};

const buildSavingsReply = ({ prompt, context }) => {
  const expenses = asArray(context.expenses);
  const groups = new Set(expenses.map(e => e?.group?.name).filter(Boolean));

  return `
Prompt: ${prompt}

Cost optimization insights:
- Active groups: ${groups.size}
- Focus on reducing high-frequency shared expenses first
- Batch similar expenses to reduce transaction noise
- Set monthly caps per group instead of reacting daily
`.trim();
};

const buildGenericReply = ({ prompt }) => `
Prompt: ${prompt}

I can help you with:
- Settlement optimization
- Spending breakdown
- Savings suggestions
`.trim();

/* =========================
   MAIN FUNCTION
========================= */

import { ollamaGenerate } from './ollama.client.js';

const buildRagPrompt = ({ prompt, context, retrieved }) => {
  const docs = asArray(retrieved)
    .map((d, idx) => `[#${idx + 1}] ${d.text}`)
    .join('\n\n');

  const contextBlock = context && typeof context === 'object' ? JSON.stringify(context, null, 2) : '';

  // Keep it simple: give model the retrieved docs + your app context.
  return [
    'You are a helpful Splitwise assistant that answers using the provided context and retrieved documents.',
    'If the documents do not contain enough information, say what you need and suggest a reasonable next step.',
    '',
    '=== Retrieved documents ===',
    docs || '(none)',
    '',
    '=== App context (JSON) ===',
    contextBlock || '(none)',
    '',
    '=== User prompt ===',
    prompt,
    '',
    'Answer in a clear, concise manner.'
  ].join('\n');
};

export const generateAIReply = async ({ prompt, context = {} }) => {
  let retrieved = [];
  try {
    retrieved = retrieveRelevantDocs(prompt, { topK: 3 });
  } catch {
    retrieved = [];
  }

  const ragPrompt = buildRagPrompt({ prompt, context, retrieved });

  try {
    const reply = await ollamaGenerate({ prompt: ragPrompt });
    return String(reply || '').trim();
  } catch (err) {
    // Fallback to the existing deterministic replies if Ollama fails.
    const intent = classifyIntent(prompt);

    if (intent === 'SETTLEMENT') {
      return buildSettlementReply({ prompt, context, retrieved });
    }
    if (intent === 'OVERVIEW') {
      return buildOverspendReply({ prompt, context, retrieved });
    }
    if (intent === 'SAVINGS') {
      return buildSavingsReply({ prompt, context, retrieved });
    }

    return buildGenericReply({ prompt, retrieved });
  }
};
