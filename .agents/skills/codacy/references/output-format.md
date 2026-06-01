# Codacy PR Analysis JSON Output Format

## Top-level Structure

```json
{
  "pullRequest": {
    "pullRequest": {
      "repository": "repo-name",
      "number": 123,
      "title": "PR title",
      "status": "Open",
      "owner": { "name": "org-name" },
      "originBranch": "feat/branch",
      "targetBranch": "main",
      "headCommitSha": "abc123..."
    },
    "isAnalysing": false,
    "isUpToStandards": false,
    "newIssues": 86,
    "fixedIssues": 45,
    "coverage": { ... },
    "quality": {
      "newIssues": 86,
      "fixedIssues": 45,
      "deltaComplexity": 241,
      "deltaClonesCount": 15,
      "isUpToStandards": false,
      "resultReasons": [
        {
          "gate": "issueThreshold",
          "expectedThreshold": { "threshold": 0 },
          "isUpToStandards": false,
          "expected": 0
        }
      ]
    },
    "deltaClonesCount": 15
  },
  "newIssues": [ ... ],
  "fixedIssues": [ ... ]
}
```

## Issue Object

```json
{
  "commitIssue": {
    "issueId": "f760d1633a4c7045bcc62e5777fbdacc",
    "resultDataId": 131496760806,
    "filePath": "src/main.ts",
    "fileId": 123456789,
    "patternInfo": {
      "id": "ESLint8_no-unused-vars",
      "category": "ErrorProne",
      "level": "High",
      "severityLevel": "High"
    },
    "toolInfo": {
      "uuid": "25b6766b-06c6-4625-9df1-561d28386b5f",
      "name": "ESLint"
    },
    "lineNumber": 42,
    "message": "Description of the issue",
    "language": "TypeScript",
    "lineText": "const x = 1;",
    "falsePositiveThreshold": 80,
    "commitInfo": {
      "sha": "abc...",
      "commiter": "user@example.com",
      "commiterName": "username",
      "timestamp": "2026-05-26T19:08:58Z"
    }
  },
  "deltaType": "Added"
}
```

## Key Fields

| Field | Type | Purpose |
|-------|------|---------|
| `resultDataId` | number | **Numeric ID for suppression** — use with `--ignore-issue` |
| `issueId` | string | Hash ID — NOT used for suppression |
| `filePath` | string | Relative path from repo root |
| `patternInfo.id` | string | Codacy pattern ID (tool_rule-name) |
| `patternInfo.severityLevel` | string | Critical, High, Medium, Minor, Warning |
| `patternInfo.category` | string | ErrorProne, Security, CodeStyle, Compatibility, BestPractice, etc. |
| `toolInfo.name` | string | Tool name (ESLint, Biome, Opengrep, SQLint, etc.) |
| `lineNumber` | number | Line where issue was found |
| `message` | string | Human-readable issue description |
| `deltaType` | string | "Added" (new in this PR) or "Fixed" |
