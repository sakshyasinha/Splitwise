# RAG + Ollama integration (planned)

## Step 1: Inspect current AI code paths
- Confirm current `server/services/ai.service.js` returns heuristic replies only.
- Confirm `retriever.service.js` returns relevant docs chunks from `docs/` and `uploads/`.

## Step 2: Add Ollama client in server
- Create `server/services/ollama.client.js` that calls Ollama at `http://localhost:11434/api/generate`.
- Read model name from env: `OLLAMA_MODEL` (default `mistral`).

## Step 3: Wire RAG into AI service
- Update `server/services/ai.service.js`:
  - Always retrieveRelevantDocs(prompt)
  - Build a RAG prompt containing the retrieved contexts (topK)
  - Call Ollama and return generated text.
- Keep current heuristic fallback if Ollama call fails.

## Step 4: Ensure response format matches UI
- UI expects `{ reply }`.
- Keep reply as a plain string.

## Step 5: Add basic runtime logging
- Log when Ollama is called and how many docs retrieved.

## Step 6: Test
- With server running and Ollama running:
  - POST `/api/ai/chat`
  - Ensure output is not just `Prompt: ...`.

