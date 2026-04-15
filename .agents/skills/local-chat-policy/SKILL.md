---
name: local-chat-policy
description: Guidelines for ensuring chat functionality prioritizes local data and respects privacy.
version: 0.1.0
---
# Skill: local-chat-policy

Ensure chat functionality prioritizes local data and respects privacy.

## Guidelines
1.  **Context First**: Always search local SQLite DB for relevant entities and claims before generating a response.
2.  **Explicit Sources**: Every claim in the chat response MUST be linked to an entity or record in the DB.
3.  **LLM Optionality**: If an LLM is used, never send PII or raw documents without user consent.
4.  **Fallback**: If no local data is found, clearly state it rather than hallucinating.
