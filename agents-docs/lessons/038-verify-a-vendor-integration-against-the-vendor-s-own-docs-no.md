## LESSON-038: Verify a vendor integration against the vendor's own docs, not the plan that proposed it

**Date**: 2026-09-26
**Component**: AI / external API integrations
**Severity**: High

**What happened**: A Jev (TypeSafe) chat-provider adapter was built, reviewed,
and shipped to a PR on the strength of a prior plan document. When the vendor
documentation was finally opened, the entire premise was wrong: Jev is a
System One *decision* model that returns typed `choice` / `score` / `noul`
answers and does not generate text or hold a conversation. The adapter shimmed
a conversation into a `state` string and asked a two-option `choice` question —
the exact anti-pattern the docs warn about. It would have shown a confidence
percentage where an answer belongs.

The supporting details in the plan were also unverified and wrong: `von-1.2`
is not a model, no local Von server is documented, and 402/403 are not error
codes (the real ones are 401, 422, 429, and 529 Overloaded).

**Root cause**: the plan was treated as a specification instead of a set of
claims to verify. Every field was traceable to the plan, never to the vendor.

**Prevention**:

- Open the vendor's documentation *before* the first line of adapter code, and
  treat any plan's API details as unverified claims.
- When a plan proposes an integration, ask what the vendor says the product
  *is not*. A capability that needs a shim to fit an existing interface is
  usually the wrong capability for that interface.
- Prefer the vendor's own SDK and agent-skill docs over secondary summaries.
- A green test suite proves the code matches its own assumptions. It cannot
  prove the assumptions were right; only the primary source can.

**Tags**: #integrations #vendor-api #verification #spec #ai
