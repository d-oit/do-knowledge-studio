# Annotation Anchoring

Techniques for anchoring annotations to document content.

## Re-anchoring Strategy
1. Exact match (CFI + text)
2. Fuzzy text match (surrounding context)
3. Chapter fallback (warn user)
4. User notice (cannot anchor)

## Performance
- Lazy-load document assets
- Reuse single rendition instance
- Clean up event handlers on unmount
