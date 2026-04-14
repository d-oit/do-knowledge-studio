#!/usr/bin/env bash
# Validates reference links in SKILL.md files.
# Checks that all markdown links point to existing files.
# Checks for consistent reference format: `references?/filename.md` - Description
# Exit 0 if all links valid, non-zero if broken links or format errors found.
# shellcheck disable=SC2094
set -uo pipefail

# Color codes for output
# These use ANSI escape sequences to provide visual feedback:
# - RED for errors (broken links, format violations)
# - GREEN for success (valid links)
# - YELLOW for warnings (missing files, skipped checks)
# - NC (No Color) resets formatting to prevent color bleeding
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Resolve repository root using BASH_SOURCE to handle being called from any directory
# This makes the script portable - works whether run from repo root or scripts folder
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.agents/skills"

# Counters for the final summary report
# We track these across all files to provide actionable statistics
BROKEN_COUNT=0
FORMAT_ERRORS=0
FILES_CHECKED=0
LINKS_CHECKED=0

# Regex to match markdown links: [text](path)
# Captures two groups: [1]=link text, [2]=link destination
# Example: [SKILLS.md](agents-docs/SKILLS.md) -> BASH_REMATCH[1]=SKILLS.md, BASH_REMATCH[2]=agents-docs/SKILLS.md
LINK_REGEX='\[([^]]+)\]\(([^)]+)\)'

# Regex to detect deprecated @references format
# The @ prefix was replaced with backtick format to avoid shell interpretation issues
# This pattern catches @reference/filename.md or @references/filename.md
# Why deprecated? @ looks like a mention, backticks clearly indicate code/ reference format
AT_REF_REGEX='@references?/[^[:space:]]+'

# Regex to validate proper reference format: - `references?/filename.md` - description
# Breakdown of this pattern:
#   ^\-              - Line must START with a dash (bullet point)
#   [[:space:]]+     - One or more spaces after dash
#   \`               - Opening backtick
#   (references?/    - Capture group: "reference/" or "references/" (singular/plural both valid)
#     [a-zA-Z0-9_-]+ - Filename: alphanumeric, underscores, hyphens
#     \.md)          - Must end with .md extension
#   \`               - Closing backtick
#   [[:space:]]*     - Optional spaces
#   -                - Literal dash separator
#   [[:space:]]+     - One or more spaces
#   .+               - Description text (anything)
#   $                - End of line
# shellcheck disable=SC2016
PROPER_REF_REGEX='^\-[[:space:]]+\`(references?/[a-zA-Z0-9_-]+\.md)\`[[:space:]]*-[[:space:]]+.+$'

# Function to check if a line starts the References section
is_references_header() {
    [[ "$1" =~ ^##[[:space:]]+[Rr]eferences ]]
}

# Function to check if a line starts a new section (## header)
is_section_header() {
    [[ "$1" =~ ^##[[:space:]]+ ]] && ! [[ "$1" =~ ^##[[:space:]]+[Rr]eferences ]]
}

# Function to check if a path is a URL (http/https)
is_url() {
    [[ "$1" =~ ^https?:// ]] || [[ "$1" =~ ^ftp:// ]] || [[ "$1" =~ ^mailto: ]]
}

# Function to resolve a relative path from a base directory
# This handles path normalization to avoid "../" and "./" in resolved paths
# Why use realpath? It handles edge cases like:
#   - Multiple slashes: foo//bar -> foo/bar
#   - Dot directories: foo/./bar -> foo/bar
#   - Parent references: foo/../bar -> bar
# Fallback to simple concatenation if realpath unavailable (macOS compatibility)
resolve_path() {
    local base_dir="$1"
    local link_path="$2"

    # Handle absolute paths (shouldn't happen but be safe)
    if [[ "$link_path" == /* ]]; then
        echo "$link_path"
        return
    fi

    # Normalize path by removing redundant components
    # realpath -m (mock mode) doesn't require path to exist - we check existence separately
    if command -v realpath &> /dev/null; then
        realpath -m "$base_dir/$link_path"
    else
        echo "$base_dir/$link_path"
    fi
}

# Function to check if a link target exists
check_link() {
    local skill_dir="$1"
    local link_path="$2"
    local skill_file="$3"
    local line_num="$4"

    # Skip URLs (external links)
    if is_url "$link_path"; then
        return 0
    fi

    # Skip anchor-only links (like #section-name)
    if [[ "$link_path" == \#* ]]; then
        return 0
    fi

    # Skip placeholder/example paths (like image-url, example-file, etc.)
    if [[ "$link_path" =~ ^(image-url|example|placeholder|your-file|path/to) ]]; then
        return 0
    fi

    # Remove any anchor from the path (file.md#section -> file.md)
    local clean_path="${link_path%%#*}"

    # Resolve the full path
    local full_path
    full_path="$(resolve_path "$skill_dir" "$clean_path")"

    # Check if file or directory exists
    if [[ ! -e "$full_path" && ! -L "$full_path" ]]; then
        echo -e "  ${RED}✗${NC} Broken link at line $line_num: \`${clean_path}'" >&2
        echo -e "     in: $skill_file" >&2
        return 1
    fi

    return 0
}

# Function to check reference format in References section
check_reference_format() {
    local line="$1"
    local line_num="$2"
    local skill_file="$3"
    local skill_dir="$4"

    # Skip empty lines and headers
    [[ -z "$line" ]] && return 0
    [[ "$line" =~ ^## ]] && return 0
    [[ "$line" =~ ^\| ]] && return 0  # Table rows

    # Check for @references (deprecated format)
    if [[ "$line" =~ $AT_REF_REGEX ]]; then
        local bad_ref="${BASH_REMATCH[0]}"
        echo -e "  ${RED}✗${NC} Invalid reference format at line $line_num" >&2
        echo -e "     Found: $bad_ref" >&2
        echo -e "     Use: \`references?/filename.md\` - Description" >&2
        echo -e "     in: $skill_file" >&2
        return 1
    fi

    # Check for proper format: - `references?/filename.md` - description
    if [[ "$line" =~ ^-[[:space:]] ]]; then
        # This looks like a reference entry
            if ! [[ "$line" =~ $PROPER_REF_REGEX ]]; then
            # Check if it has markdown link format [text](path)
            if [[ "$line" =~ \[.+\]\((references?/.+)\) ]]; then
                local link_path="${BASH_REMATCH[1]}"
                echo -e "  ${RED}✗${NC} Invalid reference format at line $line_num" >&2
                echo -e "     Found: Markdown link [text]($link_path)" >&2
                echo -e "     Use: \`$link_path\` - Description" >&2
                echo -e "     in: $skill_file" >&2
                return 1
            fi
        fi
    fi

    return 0
}

# Function to process a single SKILL.md file
# Uses a state machine pattern to track whether we're in the References section
# The logic flow per line:
#   1. Track if we enter/exit References section (in_references flag)
#   2. If in References: validate format of reference entries
#   3. Always: find all markdown links and check if targets exist
#   4. Always: check backtick-wrapped paths (alternative link syntax)
#   5. Always: flag deprecated @references
process_skill_file() {
    local skill_file="$1"
    local skill_dir
    skill_dir="$(dirname "$skill_file")"

    FILES_CHECKED=$((FILES_CHECKED + 1))

    local line_num=0
    local file_broken=0
    local file_format_errors=0
    local in_references=0

    while IFS= read -r line; do
        line_num=$((line_num + 1))

        # Track if we're in the References section
        # State transitions: out -> in when see "## References", in -> out when see any other "##"
        if is_references_header "$line"; then
            in_references=1
            continue
        elif is_section_header "$line"; then
            in_references=0
        fi

        # Check reference format (only in References section)
        # We enforce strict format rules here because this section is machine-parsed
        if [[ $in_references -eq 1 ]]; then
            if ! check_reference_format "$line" "$line_num" "$skill_file" "$skill_dir"; then
                FORMAT_ERRORS=$((FORMAT_ERRORS + 1))
                file_format_errors=1
            fi
        fi

        # Find all markdown links in this line
        # We use a temp_line variable because regex matching in bash is stateful
        # Removing each match lets us find multiple links on the same line
        local temp_line="$line"
        while [[ "$temp_line" =~ $LINK_REGEX ]]; do
            local full_match="${BASH_REMATCH[0]}"
            local link_path="${BASH_REMATCH[2]}"

            # Remove this match from temp_line first (to continue loop)
            # Using ${var#*substring} removes the shortest match from start
            temp_line="${temp_line#*"$full_match"}"

            # Skip if this looks like an example (line contains "example:" or the link is in backticks)
            # We don't want to validate links shown in documentation examples
            if [[ "$line" =~ example[[:space:]]*[:\(] ]] || [[ "$link_path" =~ \.(svg|png|jpg|jpeg|gif)$ ]]; then
                continue
            fi

            LINKS_CHECKED=$((LINKS_CHECKED + 1))

            # Check this link
            if ! check_link "$skill_dir" "$link_path" "$skill_file" "$line_num"; then
                BROKEN_COUNT=$((BROKEN_COUNT + 1))
                file_broken=1
            fi
        done

        # Also check for backtick-wrapped paths that look like references (only .md files in reference/)
        # This catches alternative syntax: `reference/file.md` without the "- Description" part
        # We validate these exist but don't require full format (allows inline references)
        if [[ "$line" =~ \`(references?/[a-zA-Z0-9_-]+\.md)\` ]]; then
            local ref_path="${BASH_REMATCH[1]}"
            LINKS_CHECKED=$((LINKS_CHECKED + 1))

            if ! check_link "$skill_dir" "$ref_path" "$skill_file" "$line_num"; then
                BROKEN_COUNT=$((BROKEN_COUNT + 1))
                file_broken=1
            fi
        fi

        # Check for backtick-wrapped paths in docs/ - only .md files, skip .svg and others
        # docs/ folder contains shared documentation referenced across skills
        if [[ "$line" =~ \`(docs/[a-zA-Z0-9_/-]+\.md)\` ]]; then
            local docs_path="${BASH_REMATCH[1]}"
            LINKS_CHECKED=$((LINKS_CHECKED + 1))
            if ! check_link "$skill_dir" "$docs_path" "$skill_file" "$line_num"; then
                BROKEN_COUNT=$((BROKEN_COUNT + 1))
                file_broken=1
            fi
        fi

        # Check for @references (deprecated format pointing to non-existent files)
        # These are always errors - we don't just warn, we require migration to new format
        if [[ "$line" =~ @(references?/[a-zA-Z0-9_-]+\.md) ]]; then
            local at_ref="${BASH_REMATCH[1]}"
            echo -e "  ${RED}✗${NC} Broken @reference at line $line_num: @$at_ref" >&2
            echo -e "     @ prefix is deprecated. Use: \`reference/filename.md\` or \`references/filename.md\`" >&2
            echo -e "     in: $skill_file" >&2
            BROKEN_COUNT=$((BROKEN_COUNT + 1))
            file_broken=1
        fi
    done < "$skill_file"

    if [[ $file_broken -eq 0 && $file_format_errors -eq 0 ]]; then
        echo -e "  ${GREEN}✓${NC} $(basename "$skill_dir"): All links valid"
    fi
}

echo "Validating reference links in SKILL.md files..."
echo ""

# Main entry point: discover and process all skill files
# We iterate through the skills directory, skipping backup folders (underscore prefix)
# For each skill, we look for SKILL.md and run validation

# Check if skills directory exists
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo -e "${YELLOW}⚠${NC} Skills directory not found: $SKILLS_DIR"
    exit 0
fi

# Find and process all SKILL.md files
for skill_path in "$SKILLS_DIR"/*/; do
    [[ -d "$skill_path" ]] || continue

    skill_name="$(basename "$skill_path")"

    # Skip consolidated/backup folders
    if [[ "$skill_name" == _* ]]; then
        continue
    fi

    skill_file="$skill_path/SKILL.md"

    if [[ ! -f "$skill_file" ]]; then
        echo -e "  ${YELLOW}⚠${NC} $skill_name: Missing SKILL.md"
        continue
    fi

    process_skill_file "$skill_file"
done

echo ""
echo "─────────────────────────────────────────────────────────────────"

TOTAL_ERRORS=$((BROKEN_COUNT + FORMAT_ERRORS))

if [[ $TOTAL_ERRORS -gt 0 ]]; then
    echo -e "│ ${RED}✗ Link Validation FAILED${NC}                                      │" >&2
    echo "─────────────────────────────────────────────────────────────────" >&2
    echo "" >&2
    echo "  Files checked: $FILES_CHECKED" >&2
    echo "  Links checked: $LINKS_CHECKED" >&2
    echo -e "  ${RED}Broken links: $BROKEN_COUNT${NC}" >&2
    echo -e "  ${RED}Format errors: $FORMAT_ERRORS${NC}" >&2
    echo "" >&2
    echo "  Fix broken links by:" >&2
    echo "    1. Creating missing reference files" >&2
    echo "    2. Updating link paths in SKILL.md" >&2
    echo "    3. Removing obsolete links" >&2
    echo "" >&2
    echo "  Reference format should be:" >&2
    echo "    - \`references?/filename.md\` - Description" >&2
    exit 1
else
    echo -e "│ ${GREEN}✓ All reference links valid${NC}                                   │"
    echo "─────────────────────────────────────────────────────────────────"
    echo ""
    echo "  Files checked: $FILES_CHECKED"
    echo "  Links checked: $LINKS_CHECKED"
    echo "  Broken links: 0"
    exit 0
fi
