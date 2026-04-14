#!/bin/bash
# Docs Sync Script - Minimal token synchronization for agents-docs
# Usage: ./scripts/docs-sync.sh <from-ref> <to-ref>
# Example: ./scripts/docs-sync.sh HEAD~1 HEAD

set -euo pipefail

# Get repository root for portable paths
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

# Configuration
DOCS_DIR="${DOCS_DIR:-$REPO_ROOT/agents-docs}"
SKILLS_DIR="${SKILLS_DIR:-$REPO_ROOT/.agents/skills}"
AGENTS_DIR="${AGENTS_DIR:-$REPO_ROOT/agents-docs}"

# Colors for output (disable if not terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m' # No Color
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# shellcheck disable=SC2317,SC2329
log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
FROM_REF="${1:-HEAD~1}"
TO_REF="${2:-HEAD}"

log_info "Syncing docs from ${FROM_REF} to ${TO_REF}"

# Get changed markdown files
CHANGED_FILES=$(git diff --name-only "${FROM_REF}" "${TO_REF}" | grep '\.md$' || true)

if [ -z "$CHANGED_FILES" ]; then
    log_info "No markdown files changed. Nothing to sync."
    exit 0
fi

log_info "Found changed files:"
echo "$CHANGED_FILES" | while read -r file; do
    echo "  - $file"
done

# Count files for summary
FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l)
SYNCED=0
SKIPPED=0

# Process each changed file
echo "$CHANGED_FILES" | while read -r file; do
    # Skip if file doesn't exist (deleted)
    if [ ! -f "$file" ]; then
        log_warn "Skipping deleted file: $file"
        ((SKIPPED++)) || true
        continue
    fi
    
    # Determine target directory based on file type
    target_dir=""
    
    if [[ "$file" == "$REPO_ROOT/.agents/skills"* ]] || [[ "$file" == .agents/skills/* ]]; then
        # Skill documentation
        skill_name=$(basename "$(dirname "$file")")
        target_dir="${AGENTS_DIR}/skills/${skill_name}"
        log_info "Syncing skill doc: ${skill_name}"
        
    elif [[ "$file" == */SKILL.md ]]; then
        # Generic skill file
        target_dir="${AGENTS_DIR}/skills"
        log_info "Syncing generic skill doc: $(basename "$file")"
        
    if [[ "$file" == "$REPO_ROOT/agents-docs"* ]] || [[ "$file" == agents-docs/* ]]; then
        # Already in docs, skip
        log_info "Already in docs dir, skipping: $file"
        ((SKIPPED++)) || true
        continue
    fi
        
    elif [[ "$file" == README.md ]]; then
        # Project README - keep at root
        log_info "Skipping README.md (stays at root)"
        ((SKIPPED++)) || true
        continue
        
    else
        # Other documentation
        target_dir="${AGENTS_DIR}/reference"
        log_info "Syncing reference doc: $(basename "$file")"
    fi
    
    # Create target directory
    mkdir -p "$target_dir"
    
    # Copy file
    cp "$file" "$target_dir/"
    ((SYNCED++)) || true
    
    log_info "Synced: $file → $target_dir/"
done

# Update README index if skills changed
if echo "$CHANGED_FILES" | grep -q '.agents/skills/'; then
    log_info "Skills changed, updating skill index..."
    
    # Generate simple index
    INDEX_FILE="${AGENTS_DIR}/SKILL_INDEX.md"
    {
        echo "# Skill Index"
        echo ""
        echo "Auto-generated on $(date)"
        echo ""
    } > "$INDEX_FILE"
    
    for skill_dir in "$REPO_ROOT/.agents/skills"/*/; do
        if [ -f "${skill_dir}/SKILL.md" ]; then
            skill_name=$(basename "$skill_dir")
            echo "- [${skill_name}](skills/${skill_name}/)" >> "$INDEX_FILE"
        fi
    done
    
    log_info "Updated: $INDEX_FILE"
fi

# Summary
log_info "========================================"
log_info "Sync complete!"
log_info "  Files processed: ${FILE_COUNT}"
log_info "  Synced: ${SYNCED}"
log_info "  Skipped: ${SKIPPED}"
log_info "========================================"

# Git status if in a repo
if git rev-parse --git-dir > /dev/null 2>&1; then
    if [ -n "$(git status --porcelain "$AGENTS_DIR" 2>/dev/null)" ]; then
        log_info "Uncommitted changes in ${AGENTS_DIR}:"
        git status --short "$AGENTS_DIR"
    fi
fi

exit 0
