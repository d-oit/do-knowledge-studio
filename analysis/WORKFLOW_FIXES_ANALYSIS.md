# Real-World Workflow Analysis & Evals Recommendations

**Analysis Date:** 2026-04-04  
**Scope:** GitHub Actions workflows in `.github/workflows/`  
**Modified Files:** ci-and-labels.yml, security-scan.yml

---

## 1. Real-World Testing Results

### ✅ Fix Verification - All Tests Passed

| Test | Status | Details |
|------|--------|---------|
| **find command** (ci-and-labels.yml) | ✅ PASS | Correctly lists symlinks with format `"  %p -> %l"` |
| **sed/xargs pattern** (security-scan.yml) | ✅ PASS | Successfully prepends `/src/` to paths |
| **printf JSON generation** (security-scan.yml) | ✅ PASS | Generates valid SARIF JSON structure |
| **YAML syntax** | ✅ PASS | Both files parse correctly with PyYAML |
| **yamllint** | ✅ PASS | No line-length or indentation errors |
| **actionlint** | ✅ PASS | No ShellCheck warnings in run blocks |
| **quality_gate.sh** | ✅ PASS | All gates pass including shellcheck |

### Dependencies Verified

| Script | Status | Called By |
|--------|--------|-----------|
| `gh-labels-creator.sh` | ✅ Exists + executable | ci-and-labels.yml |
| `setup-skills.sh` | ✅ Exists + executable | ci-and-labels.yml |
| `validate-skills.sh` | ✅ Exists + executable | ci-and-labels.yml |
| `validate-skill-format.sh` | ✅ Exists + executable | ci-and-labels.yml |
| `quality_gate.sh` | ✅ Exists + executable | ci-and-labels.yml, cleanup.yml |

### GitHub Actions Dependencies

| Action | Version | Used In | Risk Level |
|--------|---------|---------|------------|
| `actions/checkout` | v4 | All workflows | ✅ Low (official) |
| `actions/setup-*` | v4/v5 | ci-and-labels.yml | ✅ Low (official) |
| `ludeeus/action-shellcheck` | 2.0.0 | security-scan.yml | ✅ Low (community) |
| `aquasecurity/trivy-action` | pinned SHA | security-scan.yml | ✅ Low (verified) |
| `github/codeql-action/*` | v3 | security-scan.yml | ✅ Low (official) |
| `peter-evans/create-pull-request` | pinned SHA | cleanup, knowledge-cleanup | ⚠️ Medium (3rd party) |
| `gitleaks/gitleaks-action` | v2 | security-scan.yml | ✅ Low (official) |
| `trufflesecurity/trufflehog` | v3.82.7 | security-scan.yml | ✅ Low (verified) |
| `reviewdog/action-actionlint` | v1 | yaml-lint.yml | ✅ Low (community) |
| `actions/stale` | v9 | stale.yml | ✅ Low (official) |
| `actions/labeler` | v5 | labeler.yml | ✅ Low (official) |

---

## 2. Workflow Impact Analysis

### ci-and-labels.yml
**Purpose:** Main CI pipeline for skill validation and quality gates

**Trigger Events:**
- Push to `main`, `develop`, `release/**`
- Pull requests to `main`, `develop`

**Real-World Impact:**
- ✅ **High frequency** - Runs on every commit to main branches
- ✅ **Critical path** - Blocks PR merges if quality gate fails
- ✅ **Multi-language support** - Node.js, Rust, Python, Go (conditional)
- ✅ **No breaking changes** - The find command fix is behavior-neutral

**Risk Assessment:**
- **Before fix:** SC2012 warning (minor - ls vs find is mostly stylistic)
- **After fix:** More robust symlink listing, handles special characters better
- **Runtime impact:** Negligible (same execution time)

### security-scan.yml
**Purpose:** Comprehensive security scanning pipeline

**Trigger Events:**
- Push to `main`
- Pull requests to `main`
- Weekly schedule (Sundays at midnight)
- Manual dispatch

**Real-World Impact:**
- ✅ **Security critical** - Prevents vulnerable code from reaching main
- ✅ **SARIF integration** - Feeds GitHub Security tab
- ✅ **Multi-scanner** - ShellCheck, Trivy, GitLeaks, CodeQL
- ✅ **Fail criteria** - Blocks on CRITICAL/HIGH vulnerabilities

**Risk Assessment:**
- **Before fix:** SC2046 (word splitting risk) + SC2016 (quote style)
  - Word splitting could cause issues with paths containing spaces
  - Single quote preference is mostly stylistic
- **After fix:** 
  - xargs pattern prevents word splitting entirely
  - More robust for edge cases (spaces, special chars in paths)
- **Runtime impact:** Slightly slower due to xargs overhead (~10-50ms)

---

## 3. Evals Analysis & Recommendations

### Current State

**Existing Evals Structure:**
```
.agents/skills/
├── cicd-pipeline/evals/evals.json      ✅ Evaluates CI/CD skill
├── shell-script-quality/evals/evals.json ✅ Evaluates shell scripting skill
└── [30+ other skills with evals]
```

**Pattern:**
- Each skill has an `evals/evals.json` file
- Contains 3-5 test cases with prompts + assertions
- Tests the skill's ability to respond to user requests
- Not infrastructure testing, but AI agent behavior testing

### Should GitHub Actions Workflows Have Evals?

**Verdict: NO** ❌

**Reasoning:**

1. **Workflows are infrastructure, not skills**
   - Skills = AI capabilities (e.g., "create a CI pipeline", "review code")
   - Workflows = Infrastructure automation (e.g., "run shellcheck on push")
   - The `cicd-pipeline` skill ALREADY has evals for pipeline design

2. **Workflows are tested by other means:**
   - **yamllint** - Syntax validation ✅
   - **actionlint** - Best practices and ShellCheck ✅
   - **quality_gate.sh** - Repository standards ✅
   - **Real execution** - GitHub Actions runner tests on every push ✅

3. **Workflow test approach is different:**
   - Skills evals: "Does the AI give good advice?"
   - Workflows: "Does the YAML execute correctly?"
   - Workflow bugs are caught by:
     - Static analysis (yamllint, actionlint)
     - Runtime testing (actual workflow runs)
     - Not by AI behavior evaluation

### What Should Have Evals?

**Skills that design/modify workflows:**
- ✅ `cicd-pipeline` - Already has evals for pipeline design
- ✅ `shell-script-quality` - Already has evals for shell script creation
- ✅ `security-code-auditor` - Has evals for security review

**Workflow infrastructure itself:**
- ❌ Does not need evals - needs runtime testing

---

## 4. Potential Issues Detected

### Low Severity Issues (Non-blocking)

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| `peter-evans/create-pull-request` uses short SHA | cleanup.yml, knowledge-cleanup.yml | Supply chain risk | Document the full commit hash in comment |
| `gitleaks/gitleaks-action@v2` uses floating version | security-scan.yml | Potential breaking changes | Pin to specific version |
| Trivy scan exits with code 1 on HIGH/CRITICAL | security-scan.yml | May block merges | Document in AGENTS.md that this is intentional |
| CodeQL uploads empty SARIF for shell-only repos | security-scan.yml | Wastes processing | Current implementation is correct workaround |

### Not an Issue

| Concern | Reality |
|---------|---------|
| "Missing tests for workflows" | Workflows ARE the tests - they run on every push |
| "No BATS tests for workflow scripts" | The script logic is tested by shellcheck and runtime |
| "Workflow evals needed" | Wrong testing paradigm - use actionlint + runtime |

---

## 5. Recommendations

### Immediate Actions (Completed) ✅

1. **✅ Fixed SC2012** in ci-and-labels.yml - Use find instead of ls
2. **✅ Fixed SC2046/SC2016** in security-scan.yml - Use xargs pattern
3. **✅ Fixed line length** violations in both files
4. **✅ Verified all fixes** with yamllint, actionlint, quality_gate.sh

### Future Improvements (Optional)

1. **Add workflow documentation** in `agents-docs/WORKFLOWS.md`
   - Describe what each workflow does
   - Document failure scenarios and how to fix
   - Add troubleshooting guide

2. **Add workflow badges** to README.md
   - Show CI status at a glance
   - Link to workflow documentation

3. **Pin remaining floating versions:**
   - `gitleaks/gitleaks-action@v2` → specific SHA
   - Document the peter-evans action SHA better

4. **Add workflow dry-run capability**:
   - Allow testing workflows locally with `act`
   - Document how contributors can test workflow changes

### Do NOT Do

❌ Create evals for workflows - Wrong testing paradigm  
❌ Add BATS tests for workflow YAML - Use actionlint instead  
❌ Over-engineer workflow testing - They self-test on push  

---

## 6. Conclusion

### Real-World Impact: POSITIVE ✅

The fixes improve robustness without changing behavior:
- **find vs ls:** Handles special characters better, more portable
- **xargs vs word splitting:** Prevents issues with spaces in paths
- **printf vs echo:** More reliable JSON generation
- **Line length:** Better readability, meets project standards

### Testing Status: COMPREHENSIVE ✅

| Level | Tool | Status |
|-------|------|--------|
| Static Analysis | yamllint | ✅ No errors |
| ShellCheck | actionlint | ✅ No warnings |
| Standards | quality_gate.sh | ✅ All pass |
| Real Execution | Local tests | ✅ All pass |
| Runtime | GitHub Actions | Will verify on push |

### Evals Recommendation: NOT NEEDED ❌

Workflows are infrastructure automation, not AI skills. They are properly tested through:
1. Static analysis (yamllint, actionlint)
2. Runtime execution (actual workflow runs)
3. Self-testing (every push runs the workflows)

The existing skills (`cicd-pipeline`, `shell-script-quality`) already have evals that test the AI's ability to CREATE workflows - which is the correct level of abstraction.

---

**Signed:** Workflow Analysis  
**Date:** 2026-04-04
