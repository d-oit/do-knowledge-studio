#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" for this repository.
#
# Vercel contract (https://vercel.com/docs/project-configuration/vercel-json#ignorecommand):
#   exit 1 → continue the build
#   exit 0 → ignore (cancel) the build
#
# Why this exists: the Vercel project runs on the Hobby plan, whose limit is
# **100 deployments created per day** (https://vercel.com/docs/limits →
# "api-deployments-free-per-day", owner-scoped), and a day of ordinary work in
# this repo — many PR pushes, most of them docs/plans/agent-docs — exhausted it.
# Once exhausted, *every* deployment fails, production included, so the live site
# stops advancing while previews are still being requested. Two of the twenty
# deployments on 2026-10-12 carried no app change at all.
#
# What it skips: a push whose every changed path is documentation or agent
# configuration — paths that cannot change what the site serves. Everything else
# builds, including anything the script cannot classify.
#
# The comparison is deliberately fail-closed: Vercel clones with `--depth=10`
# (https://vercel.com/docs/builds/configure-a-build), so a previous commit may be
# absent from the clone. Anything unknown builds.
set -uo pipefail

# Paths that cannot change the deployed app: docs, plans, agent surface, CI, tests.
#
# `scripts/` is deliberately NOT here: `scripts/generate-precache-manifest.mjs`
# runs inside `pnpm run build` and its output (`public/precache-manifest.json`) is
# served to the browser, so a change there can change what a deployed client
# precaches.
DOC_ONLY_PATTERN='^(plans/|agents-docs/|docs/|e2e/|\.agents/|\.claude/|\.gemini/|\.opencode/|\.github/|.*\.md$|.*\.mdx$)'

previous="${VERCEL_GIT_PREVIOUS_SHA:-}"
current="${VERCEL_GIT_COMMIT_SHA:-HEAD}"

if [ -z "$previous" ]; then
  echo "vercel-ignore-build: no VERCEL_GIT_PREVIOUS_SHA — building"
  exit 1
fi

if ! git cat-file -e "${previous}^{commit}" 2>/dev/null; then
  echo "vercel-ignore-build: previous commit $previous is not in this shallow clone — building"
  exit 1
fi

# `--no-renames` so a move *out of* app code cannot hide: with rename detection a
# source file renamed into a doc path is reported only by its new (skippable)
# name, and the removal from src/ would be invisible to this decision.
changed="$(git diff --no-renames --name-only "$previous" "$current" 2>/dev/null || true)"
if [ -z "$changed" ]; then
  # Same tree, e.g. a force-push back to an already-deployed state.
  echo "vercel-ignore-build: no changed files between $previous and $current — ignoring the build"
  exit 0
fi

# Every changed path must match the doc/agent pattern for the build to be skipped.
app_changes="$(printf '%s\n' "$changed" | grep -Ev "$DOC_ONLY_PATTERN" || true)"
if [ -n "$app_changes" ]; then
  echo "vercel-ignore-build: app files changed — building:"
  while IFS= read -r path; do
    printf '  %s\n' "$path"
  done <<< "$app_changes"
  exit 1
fi

echo "vercel-ignore-build: only docs/plans/agent files changed — ignoring the build:"
while IFS= read -r path; do
  printf '  %s\n' "$path"
done <<< "$changed"
exit 0
