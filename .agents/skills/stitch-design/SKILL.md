---
name: stitch-design
version: 0.1.0
description: >
  Headless Stitch CLI / MCP skill for automated UI/UX design and rendering.
  Orchestrates responsive layouts across all breakpoints (mobile, tablet, desktop, large screens)
  with zero-overlap navigation and atomic design exports.
---

# Stitch Design Skill

Headless Stitch CLI / MCP skill for automated UI/UX design and rendering. Use this skill when you need to design or redesign a UI feature based on a requirement or issue.

## Triggers
- `/jules-design`
- "design a new UI"
- "create responsive layout"
- "generate design specs"

## Capabilities
- **Responsive Architecture**: Generates UI variants across mobile, tablet, desktop, and large screens.
- **Zero-Overlap Navigation**: Enforces self-learning navigation patterns with no overlapping elements.
- **Atomic Design Exports**: Outputs design specs to the `design/` folder:
  - `design/layout.md`
  - `design/typography.md`
  - `design/color-palette.md`
  - `design/DESIGN.md` (overall architecture)
- **Code Rendering**: Renders initial component code directly into the repository's frontend directory.

## Constraints
- Always use the `stitch` CLI or MCP server for design generation.
- Ensure all designs adhere to the project's design tokens and accessibility standards.
- Output MUST include atomic markdown files in the `design/` directory.

## Integration
- Works in tandem with `jules-implement` for implementation and delta-based research.
- Aligns with `ui-ux-optimize` for token DNA and swarm-based refinement.
