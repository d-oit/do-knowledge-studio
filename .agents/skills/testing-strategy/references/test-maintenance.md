# Test Maintenance

Test health monitoring and maintenance strategies. Updated with 2026 best practices for flaky test management and test suite health monitoring.

## Overview

This guide covers strategies for keeping your test suite healthy, reliable, and maintainable over time. Includes modern approaches to flaky test detection, quarantine management, and AI-assisted test maintenance.

## Test Health Metrics (2026)

### Key Metrics to Track

```python
TEST_HEALTH_METRICS = {
    'test_count': 'Total number of tests',
    'flaky_test_rate': 'Percentage of tests that fail randomly (>20% variance)',
    'test_duration': 'Time to run full test suite',
    'test_coverage': 'Code coverage percentage',
    'mutation_score': 'Mutation testing effectiveness',
    'broken_test_rate': 'Tests failing consistently',
    'test_duplication': 'Similar or duplicate tests',
    'obsolete_tests': 'Tests for removed features',
    'test_debt': 'TODO/FIXME comments in tests',
    'ci_failure_rate': 'Percentage of CI runs with test failures',
    'mean_time_to_fix': 'Average time to fix broken tests',
    'test_parallelization': 'Tests that can run in parallel',
}
```

### Health Dashboard (2026)

```python
# test_health_dashboard.py
import json
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Optional
import requests

@dataclass
class TestMetrics:
    timestamp: datetime
    total_tests: int
    passed: int
    failed: int
    skipped: int
    duration_seconds: float
    flaky_tests: List[str]
    coverage_percent: float
    mutation_score: Optional[float]

class TestHealthMonitor:
    def __init__(self, test_results_dir: str, history_days: int = 30):
        self.results_dir = Path(test_results_dir)
        self.history_days = history_days
        self.health_data: Dict[str, List[Dict]] = {}
    
    def analyze_test_runs(self) -> List[TestMetrics]:
        """Analyze test results from last N days with machine learning-based flaky detection"""
        cutoff = datetime.now() - timedelta(days=self.history_days)
        metrics = []
        
        for result_file in self.results_dir.glob('*.json'):
            date = datetime.fromtimestamp(result_file.stat().st_mtime)
            if date < cutoff:
                continue
            
            with open(result_file) as f:
                results = json.load(f)
            
            metric = self._parse_results(results, date)
            metrics.append(metric)
        
        return metrics
    
    def identify_flaky_tests_ml(self, min_runs: int = 5) -> List[Dict]:
        """ML-enhanced flaky test detection using variance analysis"""
        flaky = []
        
        for test_name, runs in self.health_data.items():
            if len(runs) < min_runs:
                continue
            
            results = [r['status'] for r in runs]
            pass_count = results.count('passed')
            fail_count = results.count('failed')
            total = len(results)
            
            pass_rate = pass_count / total
            
            # ML-based detection: tests with pass rate between 20-80% are flaky
            if 0.2 <= pass_rate <= 0.8:
                # Calculate variance to determine severity
                variance = self._calculate_variance(runs)
                
                flaky.append({
                    'test': test_name,
                    'pass_rate': pass_rate,
                    'total_runs': total,
                    'fail_count': fail_count,
                    'variance': variance,
                    'severity': 'high' if variance > 0.5 else 'medium',
                    'trend': self._calculate_trend(runs),
                })
        
        return sorted(flaky, key=lambda x: x['variance'], reverse=True)
    
    def predict_test_health(self) -> Dict:
        """Predict future test suite health based on trends"""
        metrics = self.analyze_test_runs()
        
        if len(metrics) < 7:
            return {'prediction': 'insufficient_data'}
        
        # Calculate trends
        durations = [m.duration_seconds for m in metrics]
        flaky_counts = [len(m.flaky_tests) for m in metrics]
        
        duration_trend = self._linear_regression_slope(durations)
        flaky_trend = self._linear_regression_slope(flaky_counts)
        
        return {
            'duration_trend': 'increasing' if duration_trend > 0 else 'decreasing',
            'flaky_trend': 'increasing' if flaky_trend > 0 else 'decreasing',
            'predicted_duration_in_30_days': durations[-1] + (duration_trend * 30),
            'predicted_flaky_in_30_days': flaky_counts[-1] + (flaky_trend * 30),
            'health_score': self._calculate_health_score(metrics[-1]),
        }
    
    def _calculate_health_score(self, metric: TestMetrics) -> float:
        """Calculate overall health score 0-100"""
        scores = {
            'pass_rate': (metric.passed / metric.total_tests) * 30 if metric.total_tests > 0 else 0,
            'coverage': min(metric.coverage_percent / 80 * 20, 20),
            'speed': max(0, 20 - metric.duration_seconds / 60),
            'stability': max(0, 30 - len(metric.flaky_tests) * 3),
        }
        return sum(scores.values())
    
    def generate_report(self) -> Dict:
        """Generate comprehensive health report"""
        metrics = self.analyze_test_runs()
        flaky = self.identify_flaky_tests_ml()
        prediction = self.predict_test_health()
        
        if not metrics:
            return {'error': 'No test data found'}
        
        latest = metrics[-1]
        
        return {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_tests': latest.total_tests,
                'pass_rate': latest.passed / latest.total_tests if latest.total_tests > 0 else 0,
                'duration_minutes': latest.duration_seconds / 60,
                'coverage': latest.coverage_percent,
                'mutation_score': latest.mutation_score,
            },
            'flaky_tests': {
                'count': len(flaky),
                'high_severity': [f for f in flaky if f['severity'] == 'high'],
                'list': flaky,
            },
            'prediction': prediction,
            'health_score': self._calculate_health_score(latest),
            'recommendations': self._generate_recommendations(flaky, latest),
            'trend_data': {
                'last_7_days': [
                    {
                        'date': m.timestamp.isoformat(),
                        'pass_rate': m.passed / m.total_tests if m.total_tests > 0 else 0,
                        'duration': m.duration_seconds,
                        'flaky_count': len(m.flaky_tests),
                    }
                    for m in metrics[-7:]
                ]
            }
        }
    
    def _generate_recommendations(self, flaky: List[Dict], latest: TestMetrics) -> List[str]:
        """AI-generated recommendations based on metrics"""
        recommendations = []
        
        if len(flaky) > 5:
            recommendations.append(
                f"🔴 Critical: {len(flaky)} flaky tests detected. Schedule immediate repair sprint."
            )
        elif len(flaky) > 0:
            recommendations.append(
                f"🟡 Warning: {len(flaky)} flaky tests. Quarantine and fix within 1 week."
            )
        
        if latest.duration_seconds > 600:  # > 10 minutes
            recommendations.append(
                f"🟡 Slow test suite ({latest.duration_seconds/60:.1f}min). Consider parallelization."
            )
        
        if latest.coverage_percent < 70:
            recommendations.append(
                f"🟡 Low coverage ({latest.coverage_percent:.1f}%). Target: 80%+"
            )
        
        return recommendations

# Usage example
if __name__ == '__main__':
    monitor = TestHealthMonitor('./test_results')
    report = monitor.generate_report()
    print(json.dumps(report, indent=2))
```

## Flaky Test Management (2026)

### Advanced Flaky Test Detection

```python
# flaky_detector_advanced.py
import pytest
import os
from collections import defaultdict
from typing import Set, Dict, List
import hashlib

class AdvancedFlakyTestDetector:
    """
    Advanced flaky test detection with:
    - Environment correlation analysis
    - Test dependency detection
    - Flaky pattern recognition
    """
    
    def __init__(self):
        self.test_history: Dict[str, List[Dict]] = defaultdict(list)
        self.env_history: Dict[str, Dict] = {}
        self.dependency_graph: Dict[str, Set[str]] = defaultdict(set)
    
    def record_result(self, test_name: str, passed: bool, 
                      duration_ms: float, env_info: Dict):
        """Record test result with environment metadata"""
        run_id = hashlib.md5(
            f"{test_name}{datetime.now()}".encode()
        ).hexdigest()[:8]
        
        self.test_history[test_name].append({
            'run_id': run_id,
            'passed': passed,
            'timestamp': datetime.now(),
            'duration_ms': duration_ms,
            'env': env_info,
            'ci_run_id': os.environ.get('GITHUB_RUN_ID', 'local'),
        })
        
        # Keep last 20 runs
        self.test_history[test_name] = self.test_history[test_name][-20:]
    
    def is_flaky(self, test_name: str, 
                 min_variance_threshold: float = 0.2) -> Dict:
        """Determine if a test is flaky with detailed analysis"""
        history = self.test_history.get(test_name, [])
        
        if len(history) < 5:
            return {'is_flaky': False, 'reason': 'insufficient_data'}
        
        results = [h['passed'] for h in history]
        pass_rate = sum(results) / len(results)
        
        # Calculate variance
        variance = sum((r - pass_rate) ** 2 for r in results) / len(results)
        
        # Check environment correlation
        env_analysis = self._analyze_env_correlation(test_name)
        
        # Check for timing issues
        timing_analysis = self._analyze_timing_issues(test_name)
        
        is_flaky = (
            0.2 < pass_rate < 0.8 or  # Unstable pass rate
            variance > min_variance_threshold or
            env_analysis['env_correlated'] or
            timing_analysis['has_timing_issues']
        )
        
        return {
            'is_flaky': is_flaky,
            'pass_rate': pass_rate,
            'variance': variance,
            'sample_size': len(history),
            'env_correlation': env_analysis,
            'timing_issues': timing_analysis,
            'recommended_action': self._recommend_action(
                pass_rate, variance, env_analysis, timing_analysis
            ),
        }
    
    def _analyze_env_correlation(self, test_name: str) -> Dict:
        """Analyze if failures correlate with specific environments"""
        history = self.test_history.get(test_name, [])
        env_failures: Dict[str, int] = defaultdict(int)
        env_total: Dict[str, int] = defaultdict(int)
        
        for run in history:
            env_key = f"{run['env'].get('os')}-{run['env'].get('python')}"
            env_total[env_key] += 1
            if not run['passed']:
                env_failures[env_key] += 1
        
        # Find environments with high failure rates
        problematic_envs = {
            env: fails / env_total[env]
            for env, fails in env_failures.items()
            if env_total[env] > 2 and fails / env_total[env] > 0.5
        }
        
        return {
            'env_correlated': len(problematic_envs) > 0,
            'problematic_envs': problematic_envs,
            'recommendation': 'environment_specific' if problematic_envs else 'general',
        }
    
    def _analyze_timing_issues(self, test_name: str) -> Dict:
        """Analyze if test has timing-related flakiness"""
        history = self.test_history.get(test_name, [])
        
        if len(history) < 5:
            return {'has_timing_issues': False}
        
        durations = [h['duration_ms'] for h in history]
        avg_duration = sum(durations) / len(durations)
        
        # Check for high variance in duration (indicates timing issues)
        duration_variance = sum((d - avg_duration) ** 2 for d in durations) / len(durations)
        
        # Check if failures correlate with slow runs
        slow_failures = sum(
            1 for h in history 
            if not h['passed'] and h['duration_ms'] > avg_duration * 1.5
        )
        
        return {
            'has_timing_issues': duration_variance > 1000 or slow_failures > 1,
            'avg_duration_ms': avg_duration,
            'duration_variance': duration_variance,
            'slow_failure_count': slow_failures,
        }
    
    def _recommend_action(self, pass_rate: float, variance: float,
                          env_analysis: Dict, timing_analysis: Dict) -> str:
        """Recommend action based on analysis"""
        if env_analysis['env_correlated']:
            return 'investigate_environment'
        elif timing_analysis['has_timing_issues']:
            return 'add_synchronization'
        elif pass_rate < 0.5:
            return 'quarantine_and_fix'
        elif variance > 0.3:
            return 'increase_reruns'
        else:
            return 'monitor'
    
    def detect_test_dependencies(self) -> List[Dict]:
        """Detect tests that may have hidden dependencies"""
        dependencies = []
        
        test_names = list(self.test_history.keys())
        
        for i, test1 in enumerate(test_names):
            for test2 in test_names[i+1:]:
                # Check if tests fail together often
                correlation = self._calculate_failure_correlation(test1, test2)
                
                if correlation > 0.7:  # Strong correlation
                    dependencies.append({
                        'test1': test1,
                        'test2': test2,
                        'correlation': correlation,
                        'suggestion': 'isolate_tests',
                    })
        
        return dependencies

# Pytest plugin integration
@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook to record test results for flaky detection"""
    outcome = yield
    report = outcome.get_result()
    
    detector = item.config._flaky_detector
    
    if report.when == 'call':
        detector.record_result(
            test_name=item.nodeid,
            passed=report.passed,
            duration_ms=call.duration * 1000,
            env_info={
                'os': os.environ.get('RUNNER_OS', 'unknown'),
                'python': os.environ.get('PYTHON_VERSION', 'unknown'),
                'ci': os.environ.get('CI', 'false'),
            }
        )
```

### Smart Quarantine System

```python
# quarantine_manager.py
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import yaml

class QuarantineManager:
    """
    Intelligent test quarantine system with:
    - Automatic quarantine based on flakiness
    - Graduated re-entry process
    - Impact analysis
    """
    
    def __init__(self, quarantine_file: str = '.test_quarantine.yml'):
        self.quarantine_file = Path(quarantine_file)
        self.quarantine: Dict = self._load_quarantine()
    
    def _load_quarantine(self) -> Dict:
        """Load quarantine configuration"""
        if self.quarantine_file.exists():
            with open(self.quarantine_file) as f:
                return yaml.safe_load(f) or {'quarantined': [], 'history': []}
        return {'quarantined': [], 'history': []}
    
    def _save_quarantine(self):
        """Save quarantine configuration"""
        with open(self.quarantine_file, 'w') as f:
            yaml.dump(self.quarantine, f, default_flow_style=False)
    
    def quarantine_test(self, test_name: str, reason: str,
                        detector_result: Dict, quarantine_by: str):
        """Add test to quarantine"""
        entry = {
            'test_name': test_name,
            'reason': reason,
            'quarantine_date': datetime.now().isoformat(),
            'quarantine_by': quarantine_by,
            'detector_result': detector_result,
            'pass_rate': detector_result.get('pass_rate', 0),
            'reentry_attempts': 0,
            'status': 'quarantined',
            'jira_ticket': None,
            'notes': [],
        }
        
        # Check if already quarantined
        existing = next(
            (q for q in self.quarantine['quarantined'] if q['test_name'] == test_name),
            None
        )
        
        if existing:
            existing.update(entry)
            existing['notes'].append(f"Re-quarantined on {datetime.now().isoformat()}")
        else:
            self.quarantine['quarantined'].append(entry)
        
        self._save_quarantine()
        
        # Generate notification
        self._notify_quarantine(entry)
    
    def attempt_reentry(self, test_name: str, ci_results: List[bool]) -> Dict:
        """Attempt to re-enter test from quarantine"""
        entry = next(
            (q for q in self.quarantine['quarantined'] if q['test_name'] == test_name),
            None
        )
        
        if not entry:
            return {'success': False, 'error': 'Test not in quarantine'}
        
        entry['reentry_attempts'] += 1
        
        # Require 10 consecutive passes for reentry
        if len(ci_results) >= 10 and all(ci_results[-10:]):
            # Move to history
            entry['status'] = 'reentered'
            entry['reentry_date'] = datetime.now().isoformat()
            self.quarantine['history'].append(entry)
            self.quarantine['quarantined'] = [
                q for q in self.quarantine['quarantined'] 
                if q['test_name'] != test_name
            ]
            self._save_quarantine()
            
            return {
                'success': True,
                'message': f'Test {test_name} successfully reentered',
                'total_attempts': entry['reentry_attempts'],
            }
        
        self._save_quarantine()
        
        return {
            'success': False,
            'message': f'Reentry failed: only {sum(ci_results)}/{len(ci_results)} passes',
            'consecutive_passes_required': 10 - sum(ci_results[-10:]),
            'attempts_remaining': 5 - entry['reentry_attempts'],
        }
    
    def get_quarantine_report(self) -> Dict:
        """Generate quarantine status report"""
        quarantined = self.quarantine['quarantined']
        history = self.quarantine['history']
        
        return {
            'summary': {
                'currently_quarantined': len(quarantined),
                'total_ever_quarantined': len(quarantined) + len(history),
                'successfully_reentered': len([h for h in history if h['status'] == 'reentered']),
                'quarantine_age_avg_days': self._avg_quarantine_age(quarantined),
            },
            'quarantined_tests': [
                {
                    'test_name': q['test_name'],
                    'days_in_quarantine': (
                        datetime.now() - datetime.fromisoformat(q['quarantine_date'])
                    ).days,
                    'pass_rate': q['pass_rate'],
                    'reason': q['reason'],
                    'reentry_attempts': q['reentry_attempts'],
                }
                for q in quarantined
            ],
            'recommendations': self._generate_quarantine_recommendations(quarantined),
        }
    
    def _generate_quarantine_recommendations(self, quarantined: List[Dict]) -> List[str]:
        """Generate recommendations for quarantined tests"""
        recommendations = []
        
        old_quarantines = [
            q for q in quarantined
            if (datetime.now() - datetime.fromisoformat(q['quarantine_date'])).days > 30
        ]
        
        if old_quarantines:
            recommendations.append(
                f"⚠️ {len(old_quarantines)} tests quarantined >30 days. Consider deletion."
            )
        
        high_attempts = [q for q in quarantined if q['reentry_attempts'] > 3]
        if high_attempts:
            recommendations.append(
                f"🔴 {len(high_attempts)} tests with >3 reentry attempts. Needs investigation."
            )
        
        return recommendations

# Pytest integration for quarantine
# conftest.py
import pytest
import os

# Global quarantine manager
_quarantine_mgr = None

def pytest_configure(config):
    global _quarantine_mgr
    _quarantine_mgr = QuarantineManager()
    config._quarantine = _quarantine_mgr

@pytest.hookimpl(tryfirst=True)
def pytest_runtest_setup(item):
    """Skip quarantined tests in CI unless explicitly running quarantined"""
    if os.environ.get('CI') == 'true' and not os.environ.get('RUN_QUARANTINED'):
        quarantine = item.config._quarantine
        test_name = item.nodeid
        
        entry = next(
            (q for q in quarantine.quarantine['quarantined'] if q['test_name'] == test_name),
            None
        )
        
        if entry:
            pytest.skip(f"Test is quarantined: {entry['reason']}")

# Decorator for marking potentially flaky tests
@pytest.mark.flaky(reruns=3, reruns_delay=1)
def quarantine_if_fails(reruns=3):
    """Decorator to auto-quarantine if test fails consistently"""
    def decorator(test_func):
        @pytest.mark.flaky(reruns=reruns)
        @wraps(test_func)
        def wrapper(*args, **kwargs):
            return test_func(*args, **kwargs)
        return wrapper
    return decorator
```

### Quarantine Configuration File

```yaml
# .test_quarantine.yml
quarantined:
  - test_name: test_network_timeout
    reason: Intermittent network timeouts in CI
    quarantine_date: '2026-01-15T10:30:00'
    quarantine_by: 'ci-system'
    pass_rate: 0.65
    reentry_attempts: 1
    status: quarantined
    jira_ticket: TEST-1234
    notes:
      - Re-quarantined on 2026-01-20T08:15:00

  - test_name: test_race_condition
    reason: Race condition under high load
    quarantine_date: '2026-01-10T14:22:00'
    quarantine_by: 'developer'
    pass_rate: 0.45
    reentry_attempts: 3
    status: quarantined
    jira_ticket: TEST-1235
    notes: []

history:
  - test_name: test_fixed_flaky
    reason: Timing issue resolved
    quarantine_date: '2026-01-01T09:00:00'
    reentry_date: '2026-01-05T16:30:00'
    status: reentered
    reentry_attempts: 2
```

## Test Suite Optimization

### Parallel Execution (2026)

```python
# pytest.ini
[pytest]
# Auto-detect CPU cores
addopts = -n auto --dist loadfile

# Or specific configuration
addopts = -n 8 --dist loadscope --maxprocesses 8

# Combine with testmon for smart selection
addopts = -n auto --testmon

# Disable parallel for specific markers
markers =
    serial: marks tests that cannot run in parallel
```

### Smart Test Selection

```bash
# Only run affected tests (using pytest-testmon)
pytest --testmon  # Run only tests affected by changes

# Using pytest-smartselect
pytest --smartselect  # Run based on git changes

# Run based on git diff
pytest $(git diff --name-only main | grep test | sed 's/.py//')

# Run tests related to changed code (coverage-based)
pytest --cov=src --cov-context=test --cov-report=json
```

### Test Categorization Matrix

```python
# test_categories.py
import pytest

# Priority markers
@pytest.mark.critical  # Always run, never skip
@pytest.mark.high      # Run in all CI jobs
@pytest.mark.medium    # Run in main CI only
@pytest.mark.low       # Run nightly only

# Speed markers
@pytest.mark.fast      # < 100ms
@pytest.mark.slow      # > 1s
@pytest.mark.timeout(30)  # Custom timeout

# Type markers
@pytest.mark.unit      # Fast, isolated
@pytest.mark.integration  # With dependencies
@pytest.mark.e2e       # Full system
@pytest.mark.contract  # API contract tests

# Flakiness markers
@pytest.mark.flaky(reruns=3, only_rerun=['TimeoutException'])
@pytest.mark.serial    # Cannot run in parallel
@pytest.mark.order(1)  # Explicit ordering

def test_critical_path():
    """Critical business path test"""
    pass

@pytest.mark.slow
@pytest.mark.integration
def test_database_migration():
    """Slow integration test"""
    pass

@pytest.mark.flaky(reruns=5, reruns_delay=2)
@pytest.mark.timeout(60)
def test_external_api():
    """Flaky external API test"""
    pass
```

### CI Configuration for Categorized Tests

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  fast-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run fast tests
        run: pytest -m "fast and not flaky" --timeout=60
  
  main-tests:
    runs-on: ubuntu-latest
    needs: fast-tests
    steps:
      - uses: actions/checkout@v4
      - name: Run main test suite
        run: pytest -m "not flaky and not slow" -n auto --cov=src
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
  
  flaky-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'  # Nightly only
    steps:
      - uses: actions/checkout@v4
      - name: Run quarantined tests
        run: pytest -m "flaky" --reruns 5
        continue-on-error: true
  
  slow-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    steps:
      - uses: actions/checkout@v4
      - name: Run slow tests
        run: pytest -m "slow" --timeout=600
```

## AI-Assisted Test Maintenance (2026)

### Automatic Flaky Test Diagnosis

```python
# ai_flaky_diagnosis.py
import openai
from typing import Dict, List

class AIFlakyDiagnosis:
    """Use AI to diagnose root causes of flaky tests"""
    
    def __init__(self, api_key: str):
        self.client = openai.OpenAI(api_key=api_key)
    
    def diagnose_flaky_test(self, test_code: str, 
                          failure_logs: List[str],
                          success_logs: List[str]) -> Dict:
        """AI analysis of flaky test root cause"""
        
        prompt = f"""
        Analyze this flaky test and determine the likely root cause:
        
        Test Code:
        ```python
        {test_code}
        ```
        
        Failure Logs:
        {chr(10).join(failure_logs[:5])}
        
        Success Logs:
        {chr(10).join(success_logs[:5])}
        
        Analyze:
        1. What makes this test flaky?
        2. What patterns do you see in failures vs successes?
        3. What is the recommended fix?
        4. What additional information would help diagnose further?
        
        Respond in JSON format with keys: root_cause, confidence, recommended_fix, 
        fix_code (if applicable), and additional_info_needed.
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are an expert test engineer specializing in diagnosing flaky tests."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
    
    def suggest_test_improvements(self, test_file_content: str) -> List[Dict]:
        """AI suggestions for test quality improvements"""
        
        prompt = f"""
        Review this test file and suggest improvements:
        
        ```python
        {test_file_content}
        ```
        
        Check for:
        1. Missing assertions
        2. Hardcoded values that could be dynamic
        3. Missing error case testing
        4. Timing issues (sleep, waits)
        5. External dependencies without mocking
        6. Non-deterministic operations
        
        Provide specific code suggestions in JSON format.
        """
        
        response = self.client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a senior QA engineer."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
```

## Continuous Maintenance

### Weekly Test Review Checklist (2026)

```markdown
## Weekly Test Health Checklist

### Automated Metrics (Pull from Dashboard)
- [ ] Test execution time trend: _____ (target: < 10 min)
- [ ] Flaky test count: _____ (target: < 3)
- [ ] Mutation score: _____% (target: > 70%)
- [ ] Coverage trend: _____% (target: stable or increasing)
- [ ] CI success rate: _____% (target: > 95%)

### Flaky Test Management
- [ ] Review new flaky tests detected this week
- [ ] Check quarantine age > 30 days
- [ ] Attempt reentry for stable quarantined tests
- [ ] Create tickets for flaky tests needing developer attention

### Test Debt Review
- [ ] Count TODO/FIXME in test files: _____
- [ ] Review skipped tests: _____
- [ ] Identify obsolete tests for removal: _____
- [ ] Check for test files > 500 lines: _____

### Performance
- [ ] Slowest 5 tests this week:
  1. _____ (_____s)
  2. _____ (_____s)
  3. _____ (_____s)
  4. _____ (_____s)
  5. _____ (_____s)
- [ ] Tests added parallelization opportunities: _____

### Documentation
- [ ] Tests lacking docstrings: _____
- [ ] Outdated test documentation: _____
- [ ] New feature test coverage: _____%

### Actions Created This Week
- [ ] Tests fixed: _____
- [ ] Tests quarantined: _____
- [ ] Tests removed: _____
- [ ] New tests added: _____
```

### Automated Maintenance Bot

```yaml
# .github/workflows/test-maintenance.yml
name: Test Maintenance Bot

on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Analyze test health
        run: |
          python scripts/analyze_test_health.py > health_report.json
      
      - name: Detect new flaky tests
        run: |
          python scripts/detect_flaky.py --since=7days > new_flaky.json
          if [ -s new_flaky.json ]; then
            python scripts/create_flaky_issues.py new_flaky.json
          fi
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Generate quarantine report
        run: |
          python scripts/quarantine_report.py > quarantine_report.md
      
      - name: Create maintenance issue
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const health = JSON.parse(fs.readFileSync('health_report.json'));
            const quarantine = fs.readFileSync('quarantine_report.md', 'utf8');
            
            const body = `## Weekly Test Health Report
            
            ### Metrics
            - Health Score: ${health.health_score}/100
            - Flaky Tests: ${health.flaky_tests.count}
            - Test Duration: ${health.summary.duration_minutes.toFixed(1)}min
            - Coverage: ${health.summary.coverage.toFixed(1)}%
            
            ### Recommendations
            ${health.recommendations.map(r => `- ${r}`).join('\n')}
            
            ### Quarantine Status
            ${quarantine}
            
            _Generated: ${new Date().toISOString()}_
            `;
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Test Health Report - Week ${new Date().toISOString().slice(0, 10)}`,
              body: body,
              labels: ['maintenance', 'tests']
            });
      
      - name: Archive old test results
        run: |
          find test_results/ -mtime +30 -name "*.json" -delete
          echo "Cleaned up test results older than 30 days"
```

## Best Practices (2026)

1. **Zero Flaky Test Policy**: New flaky tests must be fixed or quarantined within 24 hours
2. **ML-Based Detection**: Use machine learning to identify patterns and predict flakiness
3. **Smart Quarantine**: Intelligent graduated re-entry process, not just skip
4. **Health Dashboards**: Real-time visibility into test suite health metrics
5. **AI-Assisted Diagnosis**: Use AI to suggest fixes for failing tests
6. **Test Ownership**: Every test has a clear owner responsible for maintenance
7. **Continuous Refactoring**: Regular test suite optimization sprints
8. **Fail Fast**: Quick feedback loops for test health issues
9. **Data-Driven**: Make decisions based on metrics, not gut feeling
10. **Automation First**: Automate maintenance tasks where possible

## Resources

- [Google Testing Blog: Where do our flaky tests come from?](https://testing.googleblog.com/)
- [Flaky Tests at Google](https://research.google/pubs/pub45852/)
- [pytest-rerunfailures](https://github.com/pytest-dev/pytest-rerunfailures)
- [pytest-flakefinder](https://github.com/dropbox/pytest-flakefinder)
- [Quarantine Pattern](https://martinfowler.com/bliki/Quarantine.html)
