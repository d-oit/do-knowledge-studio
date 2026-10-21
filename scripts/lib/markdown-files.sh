#!/usr/bin/env bash
# File enumeration for the quality gate's Markdown checks.
#
# Used by scripts/quality_gate.sh. Kept in scripts/lib/ so the gate script
# itself does not grow with every new enumeration rule.

if [[ -z "${MARKDOWN_FILES_LOADED:-}" ]]; then
  MARKDOWN_FILES_LOADED=1

  # Vendor agent/skill libraries that ship their own Markdown. They are
  # tracked in this repository (`.agents/skills/` is the canonical copy), but
  # their prose is not this project's prose: it is vendored content the skill
  # authors own. The gate has always excluded it, and these pathspecs keep
  # that exclusion while the file *list* comes from git.
  MARKDOWN_VENDOR_PATHSPECS=(
    ':(exclude).agents/**'
    ':(exclude).claude/**'
    ':(exclude).gemini/**'
    ':(exclude).qwen/**'
    ':(exclude).opencode/**'
  )

  # Lists the Markdown files the gate should lint, one per line.
  #
  # Enumeration is delegated to git rather than to `find`. The reasons:
  #
  #   * Git already knows what this repository ignores. A `find`-based sweep
  #     needs a denylist that is maintained by hand, and every new ignored
  #     output directory is a hole in it. `playwright-report/` and
  #     `test-results/` were exactly such a hole: running the e2e suite left
  #     generated Markdown behind, and the next gate run linted Playwright's
  #     own artifacts and failed on them (plans/180, plans/181).
  #   * `git ls-files --others --exclude-standard` adds untracked files that
  #     are not ignored, so a newly written Markdown file is still checked
  #     before it is committed — the gate never silently skips work in
  #     progress.
  #   * The vendor exclusions become pathspecs on the same command, so the
  #     list and the exclusions cannot drift apart.
  #
  # `--cached` lists files that are tracked, including ones deleted from the
  # working tree but not yet staged as deleted; markdownlint skips a path
  # that does not exist, so those are harmless.
  #
  # Outside a git repository there is no index to ask, so the sweep falls
  # back to `find` with an explicit denylist. That fallback is the behaviour
  # the gate had before, and it is only reachable outside a checkout — the
  # same assumption scripts/lib/lint_cache.sh already makes about its cache
  # directory.
  #
  # The fallback also covers a *failing* `git ls-files` (index lock, corrupt
  # repository, argument failure). Swallowing that error and returning an
  # empty list would be fail-open: the caller sees no files, lints nothing,
  # and reports success. Falling through to the filesystem sweep keeps the
  # gate checking something.
  #
  # The fallback asks git whether each candidate path is ignored, so it
  # excludes the same directories the git path does. A hand-maintained
  # exclusion list here would be the hole this change exists to close — it
  # would miss every ignored output directory added later.
  #
  # `git check-ignore` is used rather than `git ls-files --others --ignored`
  # because it answers per path and still works when the index cannot be
  # read, which is exactly the case the fallback exists for.
  list_markdown_files() {
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      if git ls-files --cached --others --exclude-standard -- '*.md' \
        "${MARKDOWN_VENDOR_PATHSPECS[@]}" 2>/dev/null; then
        return 0
      fi
    fi

    local in_repo=false
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      in_repo=true
    fi

    find . -name "*.md" \
      -not -path "./node_modules/*" \
      -not -path "./target/*" \
      -not -path "./.git/*" \
      -not -path "./.agents/*" \
      -not -path "./.claude/*" \
      -not -path "./.gemini/*" \
      -not -path "./.qwen/*" \
      -not -path "./.opencode/*" \
      -not -path "./playwright-report/*" \
      -not -path "./test-results/*" \
      -not -path "./coverage/*" \
      2>/dev/null | while IFS= read -r md_path; do
        [ -n "$md_path" ] || continue
        if [ "$in_repo" = true ]; then
          # Skip anything the repository ignores.
          if git check-ignore -q -- "$md_path" 2>/dev/null; then
            continue
          fi
        fi
        printf '%s\n' "$md_path"
      done
  }
fi
