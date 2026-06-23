# Plan 043 — Wave 3 Tags Implementation (C3, C4)

**Date**: 2026-06-22
**Branch**: `feat/wave3-tags`
**Parent Plan**: `042-goap-master-implementation-2026-06-22.md` (G-TAGS: C3, C4)
**Goal**: Tags/categories end-to-end: schema, repository, validation, and UI integration in Editor, Library, and Search.

## Findings

Wave 1 and Wave 2 already implemented most backend pieces:
- Migration `004_tags.sql` exists with `tags` + `entity_tags` tables.
- `src/db/repository/tags.ts` has `createTag`, `getAllTags`, `getTagByName`, `deleteTag`, `addTagToEntity`, `removeTagFromEntity`, `getTagsByEntityId`, `getEntitiesByTagId`.
- `TagSchema` and `Tag` type exist in `src/lib/validation.ts`.
- `IRepository` interface in `src/db/repository/types.ts` includes the tag methods.
- `src/db/repository/index.ts` (Repository class) wraps them.
- `src/components/TagsPanel.tsx` is a fully functional tags UI for the editor.
- `getEntities` in `entities.ts` already supports `tagId` filter.
- `src/styles/features.css` has `.tags-panel`, `.tag-chip`, `.tag-dot`, `.tags-create`, etc.

### Gaps to close

1. **C3 partial**: Task asked for `createTag(name, color)`, `deleteTag(id)`, `listTags()`, `addEntityTag(entityId, tagId)`, `removeEntityTag(entityId, tagId)`, `getEntityTags(entityId)`. Existing names: `createTag`, `deleteTag`, `getAllTags`, `addTagToEntity`, `removeTagFromEntity`, `getTagsByEntityId`. We will keep existing names (used across code) but add thin aliases to the C3 names for spec compatibility. Also `listSnapshots` is an alias of `listSnapshots`-style — we add `listTags` as alias.
2. **C3 type fix**: `IRepository.getEntities` interface signature does not include `tagId` but implementation does. Add `tagId?` to interface.
3. **C4 Editor**: `Editor.tsx` is 521 LOC (over 500 limit). TagsPanel exists but is not integrated into the Editor. Integrate by mounting `<TagsPanel entityId={editingEntityId}/>` when editing. This will push Editor past 521 LOC; we must extract a section. Strategy: extract `EntityTagsSection` as a small component and import it; keep tags in Editor lean.
4. **C4 Library**: No tag filter. Add tag filter chips at top that filter entities by `tagId`.
5. **C4 Search**: No tag filter. Add tag filter row that filters `progressiveSearch` by tag.

## Plan

### C3 (Backend)
- Add aliases `listTags`, `addEntityTag`, `removeEntityTag`, `getEntityTags` in `tags.ts` (thin re-exports).
- Add aliases on the `Repository` class in `index.ts` for the same.
- Add `tagId?` to `IRepository.getEntities` signature.

### C4 (UI)
- Create `src/features/editor/EntityTagsSection.tsx` (~50 LOC) — minimal editor tags view: chips + add/remove. Reuses TagsPanel pattern but minimal.
- Add `tagId` filter to `LibraryView`: chips at top of `library-controls`.
- Add `tagId` filter to `SearchPanel`: pass `tagId` through `progressiveSearch` options.

### Quality
- Add `TagSchema` test cases in `validation.test.ts` (currently absent).
- Run typecheck, lint, tests, build.

## Acceptance

- `pnpm run typecheck` passes
- `pnpm run lint` passes
- `pnpm run test` passes
- `pnpm run build` passes
- Files < 500 LOC
- No `any` types introduced
