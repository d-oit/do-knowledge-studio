# GitHub Integration Guide

GitHub API integration for the Code Review Assistant skill. Updated with 2026 GitHub Actions features and API enhancements.

## Overview

This guide covers how to integrate the code-review-assistant skill with GitHub for automated PR reviews, comments, and approvals. Includes latest GitHub Actions features (2026) and GraphQL API optimizations.

## API Usage

### Authentication (2026)

The skill uses GitHub's REST API and GraphQL API via the `gh` CLI or direct API calls:

```bash
# Using gh CLI (recommended for scripting)
gh pr view <pr-number> --json number,title,body,files,commits

# Get detailed PR information
gh pr view <pr-number> --json 'number,title,author,headRefName,baseRefName,files,commits,reviewDecision,mergeStateStatus,checks'

# List PR files with patch
gh pr diff <pr-number>

# Using GitHub API directly (REST)
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$OWNER/$REPO/pulls/$PR_NUMBER

# Using GraphQL API (more efficient for complex queries)
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  -X POST \
  -d '{"query": "query { viewer { login } }"}' \
  https://api.github.com/graphql
```

### Required Permissions (2026)

Fine-grained personal access tokens (recommended):

- `pull_requests:read` - View PR details and diffs
- `pull_requests:write` - Add review comments
- `contents:read` - Access file contents
- `checks:read` - View CI check status
- `issues:write` - Create review comments (on issues endpoint)
- `metadata:read` - Access repository metadata

Repository permissions for GitHub Apps:
- Pull requests (Read & Write)
- Contents (Read)
- Checks (Read)
- Issues (Write)
- Metadata (Read)

### GraphQL API for Efficient Queries

```graphql
# Get PR with files, reviews, and checks in single query
query GetPRDetails($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      title
      state
      author {
        login
      }
      headRefOid
      baseRefOid
      changedFiles
      additions
      deletions
      files(first: 100) {
        nodes {
          path
          additions
          deletions
          changeType
          viewerViewedState
        }
      }
      reviews(last: 10) {
        nodes {
          state
          author {
            login
          }
          body
          submittedAt
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            oid
            statusCheckRollup {
              state
              contexts(first: 10) {
                nodes {
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    title
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Auto-Approval Criteria (2026)

Configure when the assistant can automatically approve PRs:

```yaml
# .github/code-review-config.yml
auto_approve:
  enabled: true
  max_files: 5
  max_lines_changed: 100
  max_files_changed: 10
  no_critical_paths: true
  tests_passing: true
  no_security_issues: true
  min_reviewers: 0
  required_checks_passing: true
  draft_pr: false  # Never auto-approve drafts
  
  # New: Confidence threshold for ML-based approvals
  ml_confidence_threshold: 0.85
  
  # New: Require specific check patterns
  required_checks:
    - "ci/tests"
    - "ci/lint"
  
  # New: Code ownership requirements
  require_code_owner_approval: false
```

### Safety Rules (2026 Updated)

Never auto-approve PRs that:
- Modify security-related files (auth, crypto, payment, secrets)
- Have failing CI checks or required checks
- Are marked as "WIP", "Draft", or "[WIP]" in title
- Change more than 500 lines total
- Touch database migrations without approval
- Add new dependencies (package.json, requirements.txt, etc.)
- Modify CI/CD configuration files
- Are from first-time contributors (new contributor badge)
- Have unresolved review comments
- Add or modify GitHub Actions workflows

### AI-Powered Risk Assessment

```python
# risk_assessment.py
from typing import Dict, List
import re

class PRRiskAssessor:
    """Assess PR risk for auto-approval eligibility"""
    
    CRITICAL_PATHS = [
        r'.*auth.*',
        r'.*security.*',
        r'.*crypto.*',
        r'.*payment.*',
        r'.*secret.*',
        r'.*/\.env.*',
        r'.*/config/.*\.py$',
        r'.*/migrations/.*',
        r'.*/\.github/workflows/.*',
        r'.*package-lock\.json$',
        r'.*requirements\.txt$',
        r'.*Cargo\.toml$',
        r'.*go\.mod$',
    ]
    
    HIGH_RISK_PATTERNS = [
        r'password',
        r'secret',
        r'api_key',
        r'token',
        r'eval\s*\(',
        r'exec\s*\(',
        r'subprocess\.call.*shell=True',
    ]
    
    def assess_pr(self, pr_data: Dict, files: List[Dict]) -> Dict:
        """Assess PR risk level"""
        score = 0
        reasons = []
        
        # Check critical paths
        for file in files:
            for pattern in self.CRITICAL_PATHS:
                if re.match(pattern, file['path']):
                    score += 50
                    reasons.append(f"Critical path modified: {file['path']}")
        
        # Check file count
        if len(files) > 10:
            score += min(len(files) - 10, 20)
            reasons.append(f"Large PR: {len(files)} files")
        
        # Check line count
        total_lines = sum(f.get('additions', 0) + f.get('deletions', 0) for f in files)
        if total_lines > 500:
            score += min((total_lines - 500) / 50, 30)
            reasons.append(f"Large change: {total_lines} lines")
        
        # Check for high-risk code patterns
        for file in files:
            if 'patch' in file:
                for pattern in self.HIGH_RISK_PATTERNS:
                    if re.search(pattern, file['patch'], re.IGNORECASE):
                        score += 40
                        reasons.append(f"High-risk pattern in {file['path']}")
        
        return {
            'risk_score': min(score, 100),
            'risk_level': 'critical' if score >= 80 else 'high' if score >= 50 else 'medium' if score >= 20 else 'low',
            'reasons': reasons,
            'auto_approvable': score < 30 and len(reasons) == 0,
        }
```

## Webhook Setup (2026)

### GitHub App Configuration

1. Create a GitHub App in your organization settings
2. Subscribe to these events:
   - `pull_request.opened`
   - `pull_request.synchronize`
   - `pull_request.reopened`
   - `pull_request.ready_for_review`
   - `check_run.completed`
   - `pull_request_review.submitted`

3. Set permissions:
   - Pull requests: Read & Write
   - Contents: Read
   - Checks: Read
   - Issues: Write (for review comments)
   - Metadata: Read
   - Commit statuses: Read

### Enhanced Webhook Handler

```python
# webhook_handler.py
from flask import Flask, request, jsonify
import hashlib
import hmac
import os

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def handle_webhook():
    """Handle GitHub webhook events"""
    
    # Verify webhook signature
    signature = request.headers.get('X-Hub-Signature-256')
    if not verify_signature(request.data, signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    event = request.headers.get('X-GitHub-Event')
    payload = request.json
    
    if event == 'pull_request':
        handle_pr_event(payload)
    elif event == 'check_run':
        handle_check_run_event(payload)
    elif event == 'pull_request_review':
        handle_review_event(payload)
    
    return '', 204

def verify_signature(payload: bytes, signature: str) -> bool:
    """Verify GitHub webhook signature"""
    secret = os.environ.get('WEBHOOK_SECRET', '').encode()
    expected = 'sha256=' + hmac.new(secret, payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

def handle_pr_event(payload: Dict):
    """Handle pull request events"""
    action = payload['action']
    pr = payload['pull_request']
    
    # Skip draft PRs
    if pr.get('draft', False):
        return
    
    if action in ['opened', 'synchronize', 'reopened', 'ready_for_review']:
        # Queue for code review
        queue_review({
            'pr_number': pr['number'],
            'repo': payload['repository']['full_name'],
            'action': action,
            'head_sha': pr['head']['sha'],
            'base_sha': pr['base']['sha'],
        })

def handle_check_run_event(payload: Dict):
    """Handle check run completion for dependent reviews"""
    check_run = payload['check_run']
    
    if check_run['conclusion'] == 'success':
        # Check if all required checks passed
        # Trigger dependent reviews
        pass
```

## Review Comment API (2026)

### Adding Review Comments

```bash
# Create a review with comments
gh api repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews \
  -f event='COMMENT' \
  -f body='Automated review summary' \
  -F 'comments[][path]=file.js' \
  -F 'comments[][position]=1' \
  -F 'comments[][body]=Issue description'

# Submit review via REST API
curl -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$OWNER/$REPO/pulls/$PR_NUMBER/reviews \
  -d '{
    "body": "Automated code review findings",
    "event": "COMMENT",
    "comments": [
      {
        "path": "src/main.py",
        "position": 4,
        "body": "⚠️ Consider adding type hints for this function",
        "side": "RIGHT"
      }
    ]
  }'

# GraphQL mutation for review with threads
mutation {
  addPullRequestReview(input: {
    pullRequestId: "PR_id",
    event: COMMENT,
    body: "Review summary",
    threads: [
      {
        path: "src/main.py",
        line: 10,
        side: RIGHT,
        body: "Consider refactoring this function"
      }
    ]
  }) {
    pullRequestReview {
      id
      url
    }
  }
}
```

### Comment Positioning (2026)

Comments use GitHub's positioning system with new `subject_type` options:
- `position`: Line number in the diff (not the file)
- `path`: File path relative to repo root
- `commit_id`: SHA of the commit being reviewed
- `line`: Absolute line number in file (alternative to position)
- `side`: LEFT (old) or RIGHT (new)
- `subject_type`: `line` or `file`
- `start_line` + `start_side`: For multi-line comments

```python
# Position calculation for review comments
def calculate_position(file_patch: str, target_line: int) -> int:
    """
    Calculate the position in a diff patch for a specific line.
    
    GitHub's position is the index in the diff hunk, not the file line number.
    """
    lines = file_patch.split('\n')
    position = 0
    
    for line in lines:
        position += 1
        
        # Skip hunk headers
        if line.startswith('@@'):
            match = re.match(r'@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@', line)
            if match:
                old_start = int(match.group(1))
                new_start = int(match.group(3))
        
        # Count position for added/modified lines
        if not line.startswith('-') and not line.startswith('\\'):
            current_line = new_start + (position - hunk_header_position - 1)
            if current_line == target_line:
                return position
    
    return None
```

## CI Integration (2026)

### GitHub Actions Workflow (Modern)

```yaml
name: Automated Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
    paths:
      - 'src/**'
      - 'tests/**'
      - '*.py'
      - '*.js'
      - '*.ts'

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      checks: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for accurate diffs
      
      - name: Setup review environment
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install code-review-assistant
      
      - name: Run Code Review Assistant
        id: review
        uses: ./.github/actions/code-review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}  # For AI-powered reviews
        with:
          config: .github/code-review-config.yml
          pr_number: ${{ github.event.pull_request.number }}
      
      - name: Check auto-approval eligibility
        if: steps.review.outputs.risk_level == 'low'
        run: |
          if [ "${{ steps.review.outputs.auto_approvable }}" == "true" ]; then
            gh pr review ${{ github.event.pull_request.number }} \
              --approve \
              --body "✅ Automated approval: Low risk PR passed all checks"
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Post review summary
        uses: actions/github-script@v7
        with:
          script: |
            const summary = `${{ steps.review.outputs.summary }}`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: summary
            });
```

### Reusable Workflow (2026)

```yaml
# .github/workflows/reusable-code-review.yml
name: Reusable Code Review

on:
  workflow_call:
    inputs:
      config_path:
        required: true
        type: string
      fail_on_issues:
        default: false
        type: boolean
    secrets:
      github_token:
        required: true
      openai_key:
        required: false

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Run code review
        id: review
        run: |
          code-review-assistant \
            --config ${{ inputs.config_path }} \
            --pr ${{ github.event.pull_request.number }} \
            --output-format json \
            > review_result.json
      
      - name: Upload review results
        uses: actions/upload-artifact@v4
        with:
          name: code-review-results
          path: review_result.json
      
      - name: Fail if issues found
        if: inputs.fail_on_issues && failure()
        run: exit 1
```

### Configuration File (2026)

```yaml
# .github/code-review-config.yml
version: '2026.1'

# Risk assessment
risk_levels:
  critical:
    patterns:
      - '**/auth/**'
      - '**/security/**'
      - '**/payment/**'
      - '**/crypto/**'
      - '**/*.key'
      - '**/*.pem'
    
  high:
    patterns:
      - '**/api/**'
      - '**/models/**'
      - '**/database/**'
      - '**/middleware/**'

  medium:
    patterns:
      - '**/utils/**'
      - '**/helpers/**'

# Auto-approval settings
auto_approve:
  enabled: true
  max_files: 5
  max_lines: 100
  max_files_changed: 10
  no_critical_paths: true
  tests_passing: true
  no_security_issues: true
  required_checks_passing: true
  ml_confidence_threshold: 0.85

# Review checks
checks:
  style:
    enabled: true
    tools:
      - black
      - ruff
      - eslint
      - prettier
  
  security:
    enabled: true
    tools:
      - bandit
      - semgrep
      - detect-secrets
    
  tests:
    enabled: true
    min_coverage: 70
    require_tests_for_new_code: true
  
  documentation:
    enabled: true
    require_docstrings: true
    
  ai_review:
    enabled: true
    model: gpt-4
    max_tokens: 2000

# Comment settings
comments:
  post_inline: true
  post_summary: true
  include_suggestions: true
  severity_threshold: warning  # error, warning, info
  
# Ignore patterns
ignore:
  paths:
    - '**/tests/**'
    - '**/test_*.py'
    - '**/migrations/**'
    - '**/*.md'
    - '**/LICENSE'
  
  comments:
    - 'no-review'
    - 'NOCHECK'
    - 'skip-review'
```

## GitHub API Rate Limiting (2026)

```python
# rate_limit_handler.py
import time
from typing import Callable, Any
import requests

class GitHubRateLimiter:
    """Handle GitHub API rate limiting gracefully"""
    
    def __init__(self):
        self.rate_limit_remaining = 5000
        self.rate_limit_reset = 0
    
    def make_request(self, method: Callable, *args, **kwargs) -> Any:
        """Make API request with rate limit handling"""
        
        # Check if we need to wait
        if self.rate_limit_remaining < 100:
            wait_time = self.rate_limit_reset - time.time()
            if wait_time > 0:
                print(f"Rate limit low. Waiting {wait_time} seconds...")
                time.sleep(wait_time + 1)
        
        response = method(*args, **kwargs)
        
        # Update rate limit info
        if hasattr(response, 'headers'):
            self.rate_limit_remaining = int(
                response.headers.get('X-RateLimit-Remaining', 5000)
            )
            self.rate_limit_reset = int(
                response.headers.get('X-RateLimit-Reset', 0)
            )
        
        # Handle rate limit exceeded
        if response.status_code == 403 and 'rate limit' in response.text.lower():
            reset_time = int(response.headers.get('X-RateLimit-Reset', time.time() + 60))
            wait_time = reset_time - time.time()
            print(f"Rate limit exceeded. Waiting {wait_time} seconds...")
            time.sleep(wait_time + 1)
            return self.make_request(method, *args, **kwargs)
        
        return response
    
    def graphql_with_retry(self, query: str, variables: Dict) -> Dict:
        """Execute GraphQL query with retry logic"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    'https://api.github.com/graphql',
                    json={'query': query, 'variables': variables},
                    headers={'Authorization': f'Bearer {self.token}'}
                )
                
                data = response.json()
                
                # Check for GraphQL errors
                if 'errors' in data:
                    for error in data['errors']:
                        if error['type'] == 'RATE_LIMITED':
                            # Wait and retry
                            time.sleep(60)
                            continue
                        else:
                            raise Exception(f"GraphQL error: {error}")
                
                return data['data']
                
            except Exception as e:
                if attempt == max_retries - 1:
                    raise
                time.sleep(2 ** attempt)  # Exponential backoff
```

## Best Practices (2026)

1. **Use GraphQL for Complex Queries**: Reduces API calls and provides exactly needed data
2. **Implement Proper Rate Limiting**: Handle 403/secondary rate limits gracefully
3. **Token Security**: Use fine-grained PATs or GitHub Apps, never classic tokens
4. **Webhook Signature Verification**: Always verify webhook payloads
5. **Comment Quality**: Use Markdown formatting, include actionable suggestions
6. **Incremental Reviews**: Only review changed lines, not entire files
7. **Context Awareness**: Consider PR size, author experience, and change type
8. **ML-Enhanced Reviews**: Use AI to assist but not replace human judgment
9. **Audit Logging**: Log all automated actions for accountability
10. **Human Override**: Always allow humans to override automated decisions

## Troubleshooting

### Common Issues

**Token permissions (403 errors)**: 
- Verify fine-grained token has correct repository permissions
- Check expiration dates on tokens
- Ensure token has access to organization repositories (if applicable)

**Rate limiting (403/secondary)**:
- Implement exponential backoff
- Use GraphQL to reduce API calls
- Cache results when possible
- Consider using GitHub App for higher rate limits (15,000 vs 5,000)

**Comment positioning**:
- Use `line` instead of `position` when possible (more reliable)
- Ensure `commit_id` matches the latest commit on the PR
- Use `side: RIGHT` for new code, `LEFT` for removed code

**Webhook delivery failures**:
- Check webhook URL is publicly accessible
- Verify SSL certificate is valid
- Ensure webhook secret matches
- Check firewall/network settings

### Debug Mode

Enable verbose logging:
```bash
export GITHUB_DEBUG=1
export CODE_REVIEW_DEBUG=1
export GH_DEBUG=1

# Run with verbose output
gh pr view 123 --json number,title --verbose
```

## Resources

- [GitHub REST API v3](https://docs.github.com/en/rest)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [GitHub Apps](https://docs.github.com/en/developers/apps)
- [Fine-grained PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token#creating-a-fine-grained-personal-access-token)
- [gh CLI](https://cli.github.com/manual/)
