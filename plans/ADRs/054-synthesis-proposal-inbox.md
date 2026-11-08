# ADR 054 — AI extraction writes proposals, never the corpus (#1057)

**Status**: Accepted (2026-11-08).
**Context**: #1057 adds provider-backed entity/claim extraction. The app's
persistence invariants (ADR 028) say unvalidated data never enters the store, and
a language model is the least reliable writer in the system: it can hallucinate an
entity, paraphrase its own "quote", or return a 200 kB blob.

## Decision

1. **A separate store slice holds proposals.** `proposals` is persisted in the
   same validated envelope as `entities`/`claims` and validates with its own Zod
   schema. Nothing in the extraction path can reach `entities` or `claims`.
2. **Accept is the only write.** `acceptProposal` builds the record and calls the
   existing `commitEntity` / `addClaim`, which push a history snapshot. One Undo
   reverses one accept; the proposal record keeps its `accepted` status.
3. **Provenance is mandatory on accepted claims**: `source = ai:<model>`,
   `verification = unverified`, the note id as `entityId`, the verbatim evidence
   span in `evidence`, and the accept-time timestamp from `buildClaim`.
4. **Output is bounded and validated before storage.** Response length is capped,
   then JSON-extracted, then Zod-validated, then trimmed to per-field caps;
   entity and claim counts above the cap reject the whole response rather than
   storing a truncated set that misrepresents what the model said.
5. **Evidence must be a verbatim quote of the note.** A span that does not appear
   in the note is dropped, and the row says so. A paraphrase is not evidence.
6. **Duplicates are flagged, not merged.** Name similarity is token overlap; the
   flag names the existing entity id and the person decides.
7. **Privacy is stated, not assumed.** `leavesDevice` is true only for
   `openrouter`; Ollama and the in-browser local adapter keep the note on the
   device (the note is still fully serialized into the prompt in memory).

## Consequences

- A malformed answer costs one retry, never a partial import.
- The inbox is reviewable state, so it is persisted and must stay inside the
  envelope's validation; a schema change to proposals is an envelope change.
- Accepting an entity proposal creates a *minimal* entity (name, type,
  description) with no links or tags: the reviewer can enrich it afterwards, and
  a proposal cannot silently invent relationships.
- Backup/export formats are unchanged. Proposals are not knowledge; accepted
  items are already in the exported corpus.

## Alternatives considered

- **Write directly, offer Undo.** Rejected: a model error would be indistinguishable
  from a user edit in the history, and a bulk extraction could bury real work.
- **Store proposals in localStorage outside the envelope.** Rejected: it would be a
  second corpus and would bypass envelope validation and quarantine.
- **Repair-then-retry on schema failure.** Rejected for now: doubles provider cost
  and traffic for a failure the person can retry deliberately.
