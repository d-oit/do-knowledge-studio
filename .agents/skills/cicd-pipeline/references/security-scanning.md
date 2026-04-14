# Security Scanning

Integrate security scanning into CI/CD pipelines.

## Secrets Detection

### GitLeaks
```yaml
jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for scan
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### TruffleHog
```yaml
jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --debug --only-verified
```

## Dependency Vulnerability Scanning

### Trivy
```yaml
jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          format: 'sarif'
          output: 'trivy-results.sarif'
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'
```

### Snyk
```yaml
jobs:
  snyk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

## SAST (Static Analysis)

### SonarQube
```yaml
jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

### CodeQL (GitHub)
```yaml
name: "CodeQL"

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  analyze:
    name: Analyze
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    
    strategy:
      fail-fast: false
      matrix:
        language: ['javascript', 'python']
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: ${{ matrix.language }}
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
```

## Container Image Scanning

### Trivy for Docker Images
```yaml
jobs:
  scan-image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .
      
      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'myapp:${{ github.sha }}'
          format: 'sarif'
          output: 'trivy-image-results.sarif'
      
      - uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-image-results.sarif'
```

### Anchore
```yaml
jobs:
  anchore:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Scan with Anchore
        uses: anchore/scan-action@v3
        id: scan
        with:
          image: 'myapp:latest'
          fail-build: true
          severity-cutoff: high
      
      - name: Upload result
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: ${{ steps.scan.outputs.sarif }}
```

## Compliance Checking

### Open Policy Agent (OPA)
```yaml
jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run OPA checks
        uses: open-policy-agent/setup-opa@v2
      
      - name: Check policies
        run: |
          opa test policies/ --verbose
```

## Security Gates

### Fail Pipeline on High Severity
```yaml
jobs:
  security-gate:
    runs-on: ubuntu-latest
    needs: [secrets-scan, dependency-scan, sast]
    if: always()
    steps:
      - name: Check security results
        run: |
          # Fail if any security job failed
          if [[ "${{ needs.secrets-scan.result }}" == "failure" ]] || \
             [[ "${{ needs.dependency-scan.result }}" == "failure" ]] || \
             [[ "${{ needs.sast.result }}" == "failure" ]]; then
            echo "Security checks failed!"
            exit 1
          fi
```

### Risk-Based Deployment
```yaml
jobs:
  risk-assessment:
    runs-on: ubuntu-latest
    outputs:
      risk_level: ${{ steps.assess.outputs.risk }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Assess Risk
        id: assess
        run: |
          # Check for security-sensitive files
          if git diff --name-only HEAD~1 | grep -qE "(auth|security|crypto)"; then
            echo "risk=high" >> $GITHUB_OUTPUT
          else
            echo "risk=low" >> $GITHUB_OUTPUT
          fi

  deploy:
    runs-on: ubuntu-latest
    needs: risk-assessment
    if: needs.risk-assessment.outputs.risk_level == 'low'
    steps:
      - run: ./scripts/deploy.sh
```
