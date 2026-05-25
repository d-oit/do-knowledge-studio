#!/usr/bin/env bash
# Regenerate the "## Self-Learning Rules (Auto-Generated)" section of AGENTS.md
# by scanning the project for learnings, patterns, and conventions.
#
# Usage: ./scripts/analyze-codebase.sh [--dry-run]
#
# This script:
# 1. Scans agents-docs/learnings/ for structured lesson files
# 2. Parses .cursor/skills and .windsurf/skills for active skills
# 3. Extracts key patterns from scripts/ and .github/workflows/
# 4. Updates AGENTS.md with a fresh auto-generated section

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# ─────────────────────────────────────────────
# Collect data
# ─────────────────────────────────────────────

# 1. Count active skills
SKILL_COUNT=0
if [ -d ".agents/skills" ]; then
    SKILL_COUNT=$(find .agents/skills -maxdepth 1 -type d | wc -l)
fi

# 2. Extract key scripts
SCRIPTS_LIST=""
if [ -d "scripts" ]; then
    # List non-lib, non-utility scripts
    SCRIPTS_LIST=$(find scripts -maxdepth 1 -name "*.sh" ! -path "*/lib/*" ! -name "pre-commit-hook.sh" -type f | sort | sed 's|^scripts/||')
fi

# 3. Count workflows
WF_COUNT=0
if [ -d ".github/workflows" ]; then
    WF_COUNT=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
fi

# 4. Count test files
TEST_COUNT=0
if [ -d "tests" ]; then
    TEST_COUNT=$(find tests -name "*.ts" -o -name "*.tsx" -o -name "*.bats" -o -name "*.py" | wc -l)
fi
SRC_TEST_COUNT=0
SRC_TEST_COUNT=$(find src -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null | wc -l || echo 0)

# 5. Check for active plans
PLAN_COUNT=0
STALE_PLANS=""
if [ -d "plans" ]; then
    PLAN_COUNT=$(find plans -maxdepth 1 -name "*.md" ! -name "INDEX.md" ! -name "GOAP_STATE.md" ! -name "ARCHITECTURE.md" ! -name "PHASES.md" ! -name "GOAL.md" ! -name "TRIZ_ANALYSIS.md" ! -name "OPTIMIZATIONS.md" -type f | wc -l)
    # Find plans older than 60 days
    STALE_PLANS=$(find plans -maxdepth 1 -name "*.md" ! -name "INDEX.md" ! -name "GOAP_STATE.md" ! -name "ARCHITECTURE.md" ! -name "PHASES.md" ! -name "GOAL.md" ! -name "TRIZ_ANALYSIS.md" ! -name "OPTIMIZATIONS.md" -type f -mtime +60 | sort | sed 's|^plans/||')
fi

# 6. Get recent tech stack from package.json
TECH_STACK=""
if [ -f "package.json" ]; then
    if command -v node &> /dev/null 2>/dev/null; then
        TECH_STACK=$(node -e "
            const pkg = require('./package.json');
            const deps = {...pkg.dependencies, ...pkg.devDependencies};
            const key = ['react','vite','typescript','@sqlite.org','tiptap','sigma','orama','@tanstack/react-virtual'];
            const found = key.filter(k => deps[k]).map(k => \`\${k}@\${deps[k].replace('^','').replace('~','')}\`);
            console.log(found.join(', '));
        " 2>/dev/null || echo "React + Vite + TypeScript")
    else
        TECH_STACK="React + Vite + TypeScript + SQLite WASM + Orama"
    fi
fi

# ─────────────────────────────────────────────
# Build the section content
# ─────────────────────────────────────────────

TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M UTC")
SECTION="## Self-Learning Rules (Auto-Generated)

> Last regenerated: ${TIMESTAMP}
>
> This section is automatically maintained by \`scripts/analyze-codebase.sh\`.
> Run periodically or before major planning cycles.

### Project Metrics

| Metric | Value |
|--------|-------|
| Active Skills | ${SKILL_COUNT:-0} |
| GitHub Workflows | ${WF_COUNT:-0} |
| Test Files | $((TEST_COUNT + SRC_TEST_COUNT)) |
| Active Plans | ${PLAN_COUNT:-0} |
| Tech Stack | ${TECH_STACK:-React + Vite + TypeScript} |

### Key Scripts

\`\`\`
${SCRIPTS_LIST:-quality_gate.sh, validate-skills.sh, validate-links.sh, docs-sync.sh, health-check.sh}
\`\`\`

### Active Conventions

- **Package Manager**: pnpm (enforced by validate-package-manager.sh)
- **Commits**: conventional commits (enforced by commitlint)
- **Linting**: ESLint + ShellCheck + markdownlint
- **Testing**: Vitest (unit/integration) + Playwright (E2E) + BATS (shell)
- **CI**: GitHub Actions with pinned SHA commits
- **Pre-commit**: Quality gate runs on every commit via \`.pre-commit-config.yaml\`
- **TypeScript**: Strict mode, no \`any\`

### Stale Plans (>60 days)

${STALE_PLANS:-_No stale plans detected._}

### Current Phase

See \`plans/GOAP_STATE.md\` for the current GOAP phase and active work items.
"

# ─────────────────────────────────────────────
# Write to AGENTS.md
# ─────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
    echo "=== DRY RUN - Would write to AGENTS.md ==="
    echo "$SECTION"
    exit 0
fi

# Check if AGENTS.md exists
if [ ! -f "AGENTS.md" ]; then
    echo "Error: AGENTS.md not found at $REPO_ROOT/AGENTS.md"
    exit 1
fi

# Check if the auto-generated section already exists
if grep -q "## Self-Learning Rules (Auto-Generated)" AGENTS.md; then
    # Replace existing section
    # Use awk to replace the section between markers
    TMP_FILE=$(mktemp)
    awk -v section="$SECTION" '
        /^## Self-Learning Rules \(Auto-Generated\)/ { in_section=1; print section; next }
        in_section && /^## / { in_section=0 }
        !in_section
    ' AGENTS.md > "$TMP_FILE"
    mv "$TMP_FILE" AGENTS.md
    echo "✓ Updated existing Self-Learning Rules section in AGENTS.md"
else
    # Append before the "## Skills" section or at end
    if grep -q "^## Skills$" AGENTS.md; then
        TMP_FILE=$(mktemp)
        awk -v section="$SECTION" '
            /^## Skills$/ && !inserted { print section; print ""; inserted=1 }
            { print }
        ' AGENTS.md > "$TMP_FILE"
        mv "$TMP_FILE" AGENTS.md
        echo "✓ Added Self-Learning Rules section before Skills in AGENTS.md"
    else
        echo "" >> AGENTS.md
        echo "$SECTION" >> AGENTS.md
        echo "✓ Appended Self-Learning Rules section to AGENTS.md"
    fi
fi

echo "Done. Run again with '--dry-run' to preview without writing."
