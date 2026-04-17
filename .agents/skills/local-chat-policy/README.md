# Local Chat Policy

Always use the `searchKnowledge` function from `src/lib/search.ts` to retrieve context from the local Orama index before answering user queries. This ensures that the assistant's responses are grounded in the user's personal knowledge base while maintaining strict data sovereignty (no data leaks to external LLMs for context building).
