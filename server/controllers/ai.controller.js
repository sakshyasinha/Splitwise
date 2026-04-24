import { generateAIReply } from '../services/ai.service.js';

export const chatWithAI = async (req, res) => {
	try {
		const prompt = String(req.body?.prompt || '').trim();
		const context = req.body?.context || {};

		if (!prompt) {
			return res.status(400).json({ message: 'Prompt is required' });
		}

		const reply = await generateAIReply({ prompt, context });
		return res.json({ reply });
	} catch (error) {
		return res.status(500).json({ message: error.message || 'AI request failed' });
	}
};
