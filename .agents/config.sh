#!/bin/bash
# Centralized configuration for AI agent template repository
# Single source of truth for all constants
# Source this file in scripts: source "$(dirname "$0")/../.agents/config.sh"
# shellcheck disable=SC2034
# ^^^ Variables are used by scripts that source this file

# ============================================================================
# FILE SIZE LIMITS
# ============================================================================

# Maximum lines per source file (scripts, code files)
readonly MAX_LINES_PER_SOURCE_FILE=500

# Maximum lines per SKILL.md file (to keep skills concise)
readonly MAX_LINES_PER_SKILL_MD=250

# Maximum lines per configuration file
readonly MAX_LINES_PER_CONFIG_FILE=250

# Maximum context tokens for semantic memory retrieval
readonly MAX_CONTEXT_TOKENS=4000

# ============================================================================
# RETRY AND POLLING CONFIGURATION
# ============================================================================

# Default maximum number of retry attempts
readonly DEFAULT_MAX_RETRIES=3

# Default delay between retries (seconds)
readonly DEFAULT_RETRY_DELAY_SECONDS=5

# Default interval between poll checks (seconds)
readonly DEFAULT_POLL_INTERVAL_SECONDS=5

# Default maximum poll attempts before timeout
readonly DEFAULT_MAX_POLL_ATTEMPTS=12

# Default timeout for long-running operations (seconds)
readonly DEFAULT_TIMEOUT_SECONDS=1800

# ============================================================================
# GIT / PR CONFIGURATION
# ============================================================================

# Maximum length for commit subject line (characters)
readonly MAX_COMMIT_SUBJECT_LENGTH=72

# Maximum length for PR title (characters)
readonly MAX_PR_TITLE_LENGTH=72

# Maximum length for PR description body lines
readonly MAX_PR_BODY_LINE_LENGTH=80

# ============================================================================
# QUALITY THRESHOLDS
# ============================================================================

# Minimum test coverage percentage
readonly MIN_TEST_COVERAGE_PERCENT=80

# Maximum allowed warnings (0 = strict)
readonly MAX_ALLOWED_WARNINGS=0

# Maximum allowed lint errors
readonly MAX_ALLOWED_LINT_ERRORS=0

# ============================================================================
# ATOMIC COMMIT CONFIGURATION
# ============================================================================

# Environment variable names for atomic commit
readonly ATOMIC_COMMIT_TIMEOUT_VAR="ATOMIC_COMMIT_TIMEOUT"
readonly ATOMIC_COMMIT_NO_ROLLBACK_VAR="ATOMIC_COMMIT_NO_ROLLBACK"
readonly ATOMIC_COMMIT_CI_MODE_VAR="ATOMIC_COMMIT_CI_MODE"

# Default atomic commit timeout (seconds)
readonly ATOMIC_COMMIT_DEFAULT_TIMEOUT=1800

# ============================================================================
# SKILL VALIDATION
# ============================================================================

# Required frontmatter fields in SKILL.md
readonly SKILL_REQUIRED_FIELDS=("name" "description")

# Recommended frontmatter fields
readonly SKILL_RECOMMENDED_FIELDS=("license")

# Valid skill categories
readonly SKILL_CATEGORIES=("Security" "Coordination" "UI/UX" "APIDevelopment" "Documentation" "DevOps" "General" "CodeQuality" "Database" "Research" "Migration" "Planning" "Quality" "Innovation" "Meta" "KnowledgeManagement")

# ============================================================================
# DIRECTORY STRUCTURE
# ============================================================================

# Canonical skill source directory
readonly SKILLS_SOURCE_DIR=".agents/skills"

# Claude Code specific directory
readonly CLAUDE_DIR=".claude"

# OpenCode specific directory
readonly OPCODE_DIR=".opencode"

# Gemini CLI specific directory
readonly GEMINI_DIR=".gemini"

# Qwen Code specific directory
readonly QWEN_DIR=".qwen"

# ============================================================================
# COLOR CODES (for terminal output)
# ============================================================================

# Only use colors if stdout is a terminal and FORCE_COLOR is not 0
if [[ -t 1 && "${FORCE_COLOR:-}" != "0" ]]; then
    readonly COLOR_RED='\033[0;31m'
    readonly COLOR_GREEN='\033[0;32m'
    readonly COLOR_YELLOW='\033[1;33m'
    readonly COLOR_BLUE='\033[0;34m'
    readonly COLOR_PURPLE='\033[0;35m'
    readonly COLOR_CYAN='\033[0;36m'
    readonly COLOR_RESET='\033[0m'
    readonly COLOR_BOLD='\033[1m'
else
    readonly COLOR_RED=''
    readonly COLOR_GREEN=''
    readonly COLOR_YELLOW=''
    readonly COLOR_BLUE=''
    readonly COLOR_PURPLE=''
    readonly COLOR_CYAN=''
    readonly COLOR_RESET=''
    readonly COLOR_BOLD=''
fi

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log_info() {
    echo -e "${COLOR_BLUE}[INFO]${COLOR_RESET} $*"
}

log_success() {
    echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $*"
}

log_warning() {
    echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*" >&2
}

log_error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_RESET} $*" >&2
}

log_section() {
    echo -e "\n${COLOR_BOLD}${COLOR_CYAN}$*${COLOR_RESET}"
}

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Count non-empty lines in a file (excluding comments)
count_content_lines() {
    local file="$1"
    grep -v '^\s*$' "$file" | grep -cv '^\s*#'
}

# Validate semantic version format (x.y.z)
is_valid_version() {
    [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

# Check if running in CI environment
is_ci() {
    [[ "${CI:-}" == "true" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]]
}

# Get relative path from git root
get_git_relative_path() {
    git rev-parse --show-prefix 2>/dev/null || echo "."
}
