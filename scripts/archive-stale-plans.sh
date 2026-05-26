#!/usr/bin/env bash
# Archive stale plan files (>60 days) into plans/archive/YYYY-MM/ directories.
# Protects: plans/GOAP_STATE.md, plans/INDEX.md, plans/ARCHITECTURE.md,
#           plans/PHASES.md, plans/GOAL.md, plans/TRIZ_ANALYSIS.md,
#           plans/OPTIMIZATIONS.md, plans/perf-benchmarks.md
#
# Usage: ./scripts/archive-stale-plans.sh [--dry-run] [--days 60]
#
# Designed to be run periodically to keep the plans/ directory manageable
# and optimize AI agent context window usage.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

DRY_RUN=false
DAYS=60

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --days)
            DAYS="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1"
            echo "Usage: $0 [--dry-run] [--days N]"
            exit 1
            ;;
    esac
done

# Protected files (never archived)
PROTECTED=(
    "GOAP_STATE.md"
    "INDEX.md"
    "ARCHITECTURE.md"
    "PHASES.md"
    "GOAL.md"
    "TRIZ_ANALYSIS.md"
    "OPTIMIZATIONS.md"
    "perf-benchmarks.md"
)

# Check if plans directory exists
if [ ! -d "plans" ]; then
    echo "No plans/ directory found. Nothing to archive."
    exit 0
fi

# Find stale plan files (older than DAYS days, excluding protected files)
STALE_PLANS=()
while IFS= read -r -d '' file; do
    filename=$(basename "$file")
    skip=false
    for protected in "${PROTECTED[@]}"; do
        [[ "$filename" == "$protected" ]] && skip=true && break
    done
    [ "$skip" = true ] && continue
    STALE_PLANS+=("$file")
done < <(find plans -maxdepth 1 -name "*.md" -type f -mtime "+${DAYS}" -print0 2>/dev/null || true)

if [ ${#STALE_PLANS[@]} -eq 0 ]; then
    echo "No stale plans found (older than ${DAYS} days)."
    exit 0
fi

echo "Found ${#STALE_PLANS[@]} stale plan(s) older than ${DAYS} days:"
for plan in "${STALE_PLANS[@]}"; do
    echo "  - $plan"
done

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "=== DRY RUN - Would archive to plans/archive/YYYY-MM/ ==="
    for plan in "${STALE_PLANS[@]}"; do
        mtime=$(stat -c %Y "$plan" 2>/dev/null || stat -f %m "$plan" 2>/dev/null)
        if command -v python3 &> /dev/null; then
            month_dir=$(python3 -c "import datetime; print(datetime.datetime.fromtimestamp($mtime).strftime('%Y-%m'))" 2>/dev/null || echo "unknown")
        elif command -v date &> /dev/null; then
            if [[ "$(uname)" == "Darwin" ]]; then
                month_dir=$(date -r "$mtime" +%Y-%m 2>/dev/null || echo "unknown")
            else
                month_dir=$(date -d "@$mtime" +%Y-%m 2>/dev/null || echo "unknown")
            fi
        else
            month_dir="unknown"
        fi
        echo "  plans/archive/${month_dir}/$(basename "$plan")"
    done
    exit 0
fi

# Archive each stale plan
archived=0
for plan in "${STALE_PLANS[@]}"; do
    mtime=$(stat -c %Y "$plan" 2>/dev/null || stat -f %m "$plan" 2>/dev/null)
    if command -v python3 &> /dev/null; then
        month_dir=$(python3 -c "import datetime; print(datetime.datetime.fromtimestamp($mtime).strftime('%Y-%m'))" 2>/dev/null || echo "unknown")
    elif command -v date &> /dev/null; then
        if [[ "$(uname)" == "Darwin" ]]; then
            month_dir=$(date -r "$mtime" +%Y-%m 2>/dev/null || echo "unknown")
        else
            month_dir=$(date -d "@$mtime" +%Y-%m 2>/dev/null || echo "unknown")
        fi
    else
        month_dir="unknown"
    fi

    target_dir="plans/archive/${month_dir}"
    mkdir -p "$target_dir"

    target_file="${target_dir}/$(basename "$plan")"

    # Avoid overwriting existing archives
    if [ -f "$target_file" ]; then
        echo "  Warning: $target_file already exists, skipping $plan"
        continue
    fi

    git mv "$plan" "$target_file" 2>/dev/null || mv "$plan" "$target_file"
    echo "  Archived: $plan → $target_file"
    archived=$((archived + 1))
done

echo ""
echo "Archived $archived plan(s) to plans/archive/."
echo ""
echo "Next steps:"
echo "  1. Review the archive: ls plans/archive/"
echo "  2. Commit the changes: git add plans/ && git commit -m 'chore: archive stale plans (>${DAYS} days)'"
echo "  3. Run analyze-codebase.sh to refresh AGENTS.md metrics"
