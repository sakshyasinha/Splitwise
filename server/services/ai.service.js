const buildFallbackReply = ({ prompt, context = {} }) => {
	const owes = Number(context.totalOwed || 0);
	const groups = Number(context.groupCount || 0);
	const expenses = Number(context.expenseCount || 0);

	const bullets = [
		`Track every shared cost within 24 hours to avoid forgotten payments.`,
		`Set one fixed weekly settlement day for all active groups.`,
		`Use category tags (food, travel, utilities) so recurring overspend is visible.`
	];

	if (owes > 0) {
		bullets.unshift(`Your current pending dues are ${owes.toFixed(0)}. Prioritize the oldest dues first.`);
	}

	if (groups > 0) {
		bullets.push(`You are in ${groups} active group(s). Keep one owner per group to reduce confusion.`);
	}

	if (expenses > 0) {
		bullets.push(`You have ${expenses} recorded expense(s). Review top 3 biggest items before next split.`);
	}

	return `Prompt: ${prompt}\n\nSuggested plan:\n- ${bullets.slice(0, 5).join('\n- ')}`;
};

const askGemini = async ({ prompt, context = {} }) => {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		return null;
	}

	const contextLine = `Context: totalOwed=${context.totalOwed || 0}, groupCount=${context.groupCount || 0}, expenseCount=${context.expenseCount || 0}`;
	const fullPrompt = `You are a concise Splitwise-style finance assistant.\n${contextLine}\nUser prompt: ${prompt}\nReturn practical, bullet-point advice only.`;

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				contents: [{ parts: [{ text: fullPrompt }] }]
			})
		}
	);

	if (!response.ok) {
		return null;
	}

	const data = await response.json();
	return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
};

export const generateAIReply = async ({ prompt, context }) => {
	const geminiReply = await askGemini({ prompt, context });
	if (geminiReply) {
		return geminiReply;
	}

	return buildFallbackReply({ prompt, context });
};
