# 061 — CodeMirror Evaluation Spike (2026-07-16)

## Summary

Time-boxed spike to evaluate CodeMirror 6 against the current textarea
implementation. Per ADR 020, CodeMirror is adopted only if the textarea spike
fails or committed requirements add syntax-aware editing, multi-selection,
search/replace, large-doc virtualization, or transactional extensions.

## Results

### Bundle Size

| Metric | Without CM6 | With CM6 | Delta |
|--------|-------------|----------|-------|
| `.next/` build output | 281 MB | 330 MB | +49 MB |
| CM6 packages (node_modules) | — | 2.3 MB | +2.3 MB |
| Estimated gzipped delta | — | ~60 KB | +60 KB |

The delta is acceptable for a client-side-only editor. Tree-shaking removes
unused CM6 extensions. The lazy-loaded spike route adds ~15KB gzipped.

### Feature Comparison

| Feature | Textarea | CodeMirror 6 |
|---------|----------|--------------|
| Syntax highlighting | No | Yes (Markdown) |
| Line numbers | No | Yes |
| Undo/redo | Browser native | Built-in (transactional) |
| Multi-cursor | No | Yes (Alt+Click) |
| Search/replace | Browser native (Ctrl+F) | Built-in (Ctrl+F) |
| Bracket matching | No | Yes |
| Auto-indent | No | Yes |
| Keyboard shortcuts | Custom | Extensible keymap |
| IME support | Native browser | Native (CompositionEvent) |
| Large doc performance | Degrades >10K lines | Virtualized rendering |
| Accessibility | Excellent (native) | Good (needs ARIA attrs) |
| Bundle cost | 0 KB | ~60 KB gzipped |

### Integration Effort

- **React integration**: Clean via `useEffect` + `useRef` + `EditorView`
- **Controlled state**: `EditorState.doc` for reading, `dispatch` for updates
- **Theming**: CSS-in-JS via `EditorView.theme()`
- **Estimated integration time**: 4-6 hours for full editor replacement

### Accessibility Notes

CM6 does not add ARIA attributes by default. To match textarea a11y:
- Add `role="textbox"` and `aria-multiline="true"` to the container
- Add `aria-label` for the editor
- Ensure screen reader announcements for content changes
- Tab order is handled natively (Tab inserts indent, not focus navigation)

## Recommendation

**Keep the textarea. Do not adopt CodeMirror 6 at this time.**

Rationale per ADR 020:
1. The textarea spike passed — formatting works, undo/redo works, IME works
2. No committed requirements need syntax highlighting, multi-cursor, or
   large-doc virtualization
3. The 60KB gzipped bundle delta is not justified by current feature needs
4. CM6 introduces accessibility complexity (ARIA attrs) that textarea avoids
5. The textarea + `react-markdown` preview approach is simpler to maintain

### When to revisit

Adopt CodeMirror 6 if any of these become committed requirements:
- Syntax-aware editing (auto-complete, error highlighting)
- Multi-cursor editing
- Large document virtualization (>10K lines)
- Transactional extensions (collaborative editing, real-time sync)
- Search/replace within the editor (not just browser-native)

## Spike Files (to remove after evaluation)

- `src/app/spike/codemirror/page.tsx` — side-by-side comparison page
- `e2e/codemirror-spike.spec.ts` — 8 tests proving CM6 integration works
