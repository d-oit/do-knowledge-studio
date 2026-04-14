# Troubleshooting Guide

Common issues and solutions for the AI agent template.

## Table of Contents

- [Setup Issues](#setup-issues)
- [CI/CD Issues](#cicd-issues)
- [Skill Issues](#skill-issues)
- [Git Issues](#git-issues)
- [Quality Gate Issues](#quality-gate-issues)

---

## Setup Issues

### Permission Denied on Scripts

**Symptom**: `bash: ./scripts/setup-skills.sh: Permission denied`

**Solution**:
```bash
chmod +x scripts/*.sh
chmod +x scripts/atomic-commit/*.sh
```

### Git Hooks Not Executing

**Symptom**: Pre-commit hook doesn't run on commit

**Solution**:
1. Check if hook is installed:
   ```bash
   ls -la .git/hooks/pre-commit
   ```

2. If not present, install it:
   ```bash
   cp scripts/pre-commit-hook.sh .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

3. Check for conflicting global hooks:
   ```bash
   git config --global core.hooksPath
   # If set, unset it:
   git config --global --unset core.hooksPath
   ```

### Skill Symlink Failures

**Symptom**: `validate-skills.sh` reports broken symlinks

**Solution**:
1. Re-run setup:
   ```bash
   ./scripts/setup-skills.sh
   ```

2. If on Windows (non-WSL), symlinks may not work - use WSL or manually copy skills

---

## CI/CD Issues

### Quality Gate Fails with Exit Code 2

**Symptom**: CI fails with `Process completed with exit code 2`

**Cause**: This is "misuse of shell builtins" - often caused by `set -e` behaving differently in CI

**Solution**:
- See LESSON-001 in `agents-docs/LESSONS.md`
- Check for GNU-specific commands like `realpath --relative-to`
- Test locally in non-TTY mode: `bash script.sh | cat`

### Tests Skip in CI

**Symptom**: `SKIP_TESTS: true` in workflow output

**Solution**:
- This should not happen anymore (was fixed in quick wins)
- If still occurring, check `.github/workflows/ci-and-labels.yml`

### Workflow Permissions Error

**Symptom**: `Error: Resource not accessible by integration`

**Solution**:
- Ensure workflow has correct permissions:
  ```yaml
  permissions:
    contents: write
    pull-requests: write
  ```

---

## Skill Issues

### Skill Not Triggering

**Symptom**: Agent doesn't invoke skill when expected

**Solution**:
1. Check skill description has clear trigger phrases ("Use when...")
2. Verify skill is in `.agents/skills/`
3. Check skill has valid `evals/evals.json`
4. Review `skill-rules.json` for trigger patterns

### Malformed evals.json

**Symptom**: Skill evaluation fails silently

**Solution**:
```bash
# Validate JSON syntax
cat .agents/skills/<skill>/evals/evals.json | jq empty

# Fix any syntax errors (missing braces, commas)
```

### Reference Links Broken

**Symptom**: `validate-links.sh` reports broken links in SKILL.md

**Solution**:
- Use correct format: `` `references/filename.md` - Description ``
- Don't use: `@references/` or markdown links `[text](url)`

---

## Git Issues

### Atomic Commit Fails

**Symptom**: `./scripts/atomic-commit/run.sh` fails mid-way

**Common Causes**:
1. **No changes to commit**: Stage some changes first
2. **Merge conflicts**: Resolve before running atomic-commit
3. **Network timeout**: Check `MAX_OPERATION_SECONDS` in sync-and-push.sh
4. **Permission denied**: Ensure scripts are executable

### Push Rejected

**Symptom**: `Push rejected - remote has new commits`

**Solution**:
- Atomic-commit handles this automatically with rebase
- If manual fix needed:
  ```bash
  git fetch origin
  git rebase origin/main
  ./scripts/atomic-commit/run.sh
  ```

### Pre-commit Hook Blocks Commit

**Symptom**: Commit fails with quality gate errors

**Solution**:
- Fix the reported errors
- Or skip temporarily (not recommended): `git commit --no-verify`

---

## Quality Gate Issues

### ShellCheck Warnings

**Symptom**: `shellcheck failed` with specific error codes

**Solution**:
- Look up error code: https://github.com/koalaman/shellcheck/wiki/
- Common fixes:
  - SC2086: Quote variables
  - SC2002: Don't use cat unnecessarily
  - SC2317: Remove unreachable code

### Link Validation Fails

**Symptom**: `Broken links found` in skills

**Solution**:
- Run `./scripts/validate-links.sh` to see which links
- Check file exists in skill's `references/` folder
- Verify format: `` `references/filename.md` ``

### BATS Not Installed

**Symptom**: `⚠ bats not installed - skipping shell tests`

**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get install bats

# macOS
brew install bats-core

# Or use npm
npm install -g bats
```

---

## Getting Help

1. **Check LESSONS.md**: `cat agents-docs/LESSONS.md`
2. **Run health check**: `./scripts/health-check.sh`
3. **Review CI logs**: Check the latest GitHub Actions run
4. **Open an issue**: Include error message and reproduction steps

---

## Quick Diagnostics

```bash
# Verify environment
./scripts/health-check.sh

# Check all skills valid
./scripts/validate-skills.sh

# Run full quality gate
./scripts/quality_gate.sh

# Check git status
git status

# View recent lessons
cat agents-docs/LESSONS.md | grep -A5 "LESSON-00[1-9]"
```
