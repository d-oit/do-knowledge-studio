## LESSON-023: Codacy Analysis CLI local limitations

**Issue**: Running `codacy-analysis analyze` locally shows "0 issues" even though Codacy Cloud reports 86+ issues.

**Root Cause**: The local Analysis CLI only supports tools bundled with Node.js or already on PATH. Python (Bandit, Pylint, Prospector, Lizard), Ruby (SQLint), and Java (PMD) tools fail to install or run. The cloud analysis runs many more tools.

**Solution**:
- Always use the Cloud CLI (`codacy pull-request`) to get actual PR issue data
- Local Analysis CLI useful for quick ESLint checks but not a substitute for cloud analysis
- `codacy-analysis init --default` gives the closest config to cloud defaults (61 tools found, 14 added for local)
- Use `--install-dependencies` flag but expect failures for non-JS tools

**Tags**: #codacy #analysis-cli #static-analysis #tooling-gaps

---
