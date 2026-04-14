# Safety Patterns

Testing and safety patterns for migrations with 2025-2026 updates.

## Overview

This guide covers patterns for ensuring migration safety through testing, validation, and gradual rollout strategies, incorporating modern practices including ML-based anomaly detection and automated rollback triggers.

## Pre-Migration Testing (2026)

### Advanced Shadow Testing

Modern shadow testing with ML-based anomaly detection and distributed tracing correlation:

```python
import asyncio
from dataclasses import dataclass
from typing import Dict, List, Optional, Callable, Any
import numpy as np
from datetime import datetime
import hashlib

@dataclass
class ShadowTestResult:
    request_id: str
    old_result: Any
    new_result: Any
    old_latency_ms: float
    new_latency_ms: float
    match: bool
    anomaly_score: float
    differences: List[str]
    timestamp: datetime

class AdvancedShadowTester:
    """
    Modern shadow tester with:
    - Distributed tracing correlation
    - ML-based anomaly detection
    - Statistical significance testing
    - Payload fingerprinting for deduplication
    """
    
    def __init__(self, 
                 old_impl,
                 new_impl,
                 anomaly_detector,
                 tracer=None):
        self.old = old_impl
        self.new = new_impl
        self.anomaly_detector = anomaly_detector
        self.tracer = tracer  # OpenTelemetry/Jaeger tracer
        self.results_buffer: List[ShadowTestResult] = []
        self.max_buffer_size = 10000
        
    async def shadow_request(self, 
                            request: Dict,
                            context: Optional[Dict] = None) -> Any:
        """
        Process request through both implementations.
        Return old result while analyzing new implementation.
        """
        # Generate request fingerprint
        request_id = self._fingerprint_request(request)
        
        # Start distributed trace
        with self.tracer.start_as_current_span("shadow_test") as span:
            span.set_attribute("request_id", request_id)
            span.set_attribute("test_type", "shadow")
            
            # Execute both implementations concurrently
            old_task = self._call_with_timing(
                self.old, request, context, "old_impl"
            )
            new_task = self._call_with_timing(
                self.new, request, context, "new_impl"
            )
            
            old_result, old_latency = await old_task
            new_result, new_latency = await new_task
            
            # Analyze results
            comparison = self._compare_results(
                old_result, new_result, request
            )
            
            # ML anomaly detection
            features = self._extract_features(
                request, old_result, new_result,
                old_latency, new_latency
            )
            anomaly_score = self.anomaly_detector.score(features)
            
            # Create result record
            result = ShadowTestResult(
                request_id=request_id,
                old_result=old_result,
                new_result=new_result,
                old_latency_ms=old_latency,
                new_latency_ms=new_latency,
                match=comparison.matches,
                anomaly_score=anomaly_score,
                differences=comparison.differences,
                timestamp=datetime.utcnow()
            )
            
            # Buffer for analysis
            self._buffer_result(result)
            
            # Alert on anomalies
            if anomaly_score > 0.9:
                self._alert_anomaly(result)
            
            span.set_attribute("match", comparison.matches)
            span.set_attribute("anomaly_score", anomaly_score)
            
            # Always return old result during shadow testing
            return old_result
    
    def _fingerprint_request(self, request: Dict) -> str:
        """Create deterministic fingerprint for request deduplication"""
        content = json.dumps(request, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def _call_with_timing(self, impl, request, context, span_name):
        """Call implementation and record timing"""
        start = time.time()
        with self.tracer.start_as_current_span(span_name):
            if asyncio.iscoroutinefunction(impl.handle):
                result = await impl.handle(request, context)
            else:
                result = impl.handle(request, context)
        elapsed = (time.time() - start) * 1000
        return result, elapsed
    
    def _extract_features(self, request, old_result, new_result,
                         old_latency, new_latency) -> Dict:
        """Extract features for ML anomaly detection"""
        return {
            'latency_ratio': new_latency / max(old_latency, 1),
            'response_size_diff': len(str(new_result)) - len(str(old_result)),
            'status_code_match': self._status_match(old_result, new_result),
            'payload_structure_match': self._structure_match(old_result, new_result),
            'request_complexity': self._calculate_complexity(request),
        }
    
    def generate_statistical_report(self, hours: int = 24) -> Dict:
        """Generate statistical analysis of shadow testing results"""
        recent_results = [
            r for r in self.results_buffer
            if (datetime.utcnow() - r.timestamp).total_seconds() < hours * 3600
        ]
        
        if not recent_results:
            return {'error': 'No data available'}
        
        matches = sum(1 for r in recent_results if r.match)
        anomalies = sum(1 for r in recent_results if r.anomaly_score > 0.8)
        
        latency_improvement = np.mean([
            (r.old_latency_ms - r.new_latency_ms) / max(r.old_latency_ms, 1)
            for r in recent_results
        ])
        
        return {
            'total_requests': len(recent_results),
            'match_rate': matches / len(recent_results),
            'anomaly_rate': anomalies / len(recent_results),
            'mean_latency_improvement': latency_improvement,
            'recommendation': self._generate_recommendation(
                matches / len(recent_results),
                latency_improvement,
                anomalies / len(recent_results)
            )
        }
```

### Canary Analysis with Statistical Significance

Modern canary analysis using proper statistical tests rather than simple thresholds:

```python
from dataclasses import dataclass
from typing import Dict, List, Tuple
import numpy as np
from scipy import stats
from datetime import datetime, timedelta

@dataclass
class MetricBucket:
    timestamps: List[datetime]
    values: List[float]
    sample_count: int
    
@dataclass
class CanaryAnalysisResult:
    passed: bool
    confidence: float
    checks: Dict[str, Dict]
    recommendation: str  # 'promote', 'rollback', or 'continue'
    required_sample_size: int

class StatisticalCanaryAnalyzer:
    """
    Statistical canary analysis with:
    - Mann-Whitney U test for non-parametric comparison
    - Sequential probability ratio test (SPRT) for early stopping
    - Bayesian confidence intervals
    - Automatic sample size calculation
    """
    
    def __init__(self,
                 confidence_level: float = 0.95,
                 min_samples: int = 100,
                 max_samples: int = 10000):
        self.confidence_level = confidence_level
        self.min_samples = min_samples
        self.max_samples = max_samples
        
    def analyze(self,
                canary_metrics: List[Dict],
                baseline_metrics: List[Dict],
                duration_minutes: int = 30) -> CanaryAnalysisResult:
        """
        Perform statistical comparison of canary vs baseline.
        """
        
        # Extract metric series
        canary_errors = [m.get('error_count', 0) for m in canary_metrics]
        canary_requests = [m.get('request_count', 1) for m in canary_metrics]
        canary_latencies = [m.get('latency_p99', 0) for m in canary_metrics]
        
        baseline_errors = [m.get('error_count', 0) for m in baseline_metrics]
        baseline_requests = [m.get('request_count', 1) for m in baseline_metrics]
        baseline_latencies = [m.get('latency_p99', 0) for m in baseline_metrics]
        
        # Calculate sample sizes
        total_canary_requests = sum(canary_requests)
        total_baseline_requests = sum(baseline_requests)
        
        # Check minimum sample size
        if total_canary_requests < self.min_samples:
            return CanaryAnalysisResult(
                passed=False,
                confidence=0.0,
                checks={},
                recommendation='continue',
                required_sample_size=self.min_samples
            )
        
        # Perform statistical tests
        checks = {
            'error_rate': self._analyze_error_rate(
                sum(canary_errors), total_canary_requests,
                sum(baseline_errors), total_baseline_requests
            ),
            'latency': self._analyze_latency_distribution(
                canary_latencies, baseline_latencies
            ),
            'throughput': self._analyze_throughput(
                canary_requests, baseline_requests
            )
        }
        
        # Calculate overall confidence
        confidence = min(c.get('confidence', 0) for c in checks.values())
        
        # Determine recommendation
        all_passed = all(c.get('passed', False) for c in checks.values())
        any_critical_failure = any(
            c.get('critical', False) for c in checks.values()
        )
        
        if any_critical_failure:
            recommendation = 'rollback'
        elif all_passed and total_canary_requests >= self._calculate_required_samples(checks):
            recommendation = 'promote'
        else:
            recommendation = 'continue'
        
        return CanaryAnalysisResult(
            passed=all_passed,
            confidence=confidence,
            checks=checks,
            recommendation=recommendation,
            required_sample_size=self._calculate_required_samples(checks)
        )
    
    def _analyze_error_rate(self,
                          canary_errors: int,
                          canary_requests: int,
                          baseline_errors: int,
                          baseline_requests: int) -> Dict:
        """Statistical test for error rate comparison using two-proportion z-test"""
        p1 = canary_errors / max(canary_requests, 1)
        p2 = baseline_errors / max(baseline_requests, 1)
        
        # Pooled proportion
        p_pool = (canary_errors + baseline_errors) / \
                 (canary_requests + baseline_requests)
        
        # Standard error
        se = np.sqrt(p_pool * (1 - p_pool) * 
                     (1/canary_requests + 1/baseline_requests))
        
        # Z-score
        z = (p1 - p2) / se if se > 0 else 0
        
        # Critical value
        z_critical = stats.norm.ppf(1 - (1 - self.confidence_level) / 2)
        
        # P-value for confidence
        p_value = 2 * (1 - stats.norm.cdf(abs(z)))
        
        # Critical check: more than 50% increase is critical
        is_critical = p1 > p2 * 1.5 and p2 > 0.001
        
        return {
            'passed': abs(z) < z_critical and p1 <= p2 * 1.1,  # 10% tolerance
            'canary_rate': p1,
            'baseline_rate': p2,
            'z_score': z,
            'p_value': p_value,
            'confidence': 1 - p_value,
            'critical': is_critical
        }
    
    def _analyze_latency_distribution(self,
                                      canary: List[float],
                                      baseline: List[float]) -> Dict:
        """Mann-Whitney U test for non-parametric latency comparison"""
        if len(canary) < 10 or len(baseline) < 10:
            return {'passed': False, 'insufficient_data': True}
        
        # Mann-Whitney U test
        statistic, p_value = stats.mannwhitneyu(
            canary, baseline, alternative='greater'
        )
        
        # Effect size (rank-biserial correlation)
        effect_size = 1 - (2 * statistic) / (len(canary) * len(baseline))
        
        # Median difference
        median_diff = np.median(canary) - np.median(baseline)
        
        return {
            'passed': p_value > (1 - self.confidence_level) and 
                     np.median(canary) <= np.median(baseline) * 1.2,
            'mann_whitney_statistic': statistic,
            'p_value': p_value,
            'confidence': 1 - p_value,
            'effect_size': effect_size,
            'median_diff_ms': median_diff,
            'critical': median_diff > 500  # 500ms median increase is critical
        }
    
    def _calculate_required_samples(self, checks: Dict) -> int:
        """Calculate required sample size based on effect sizes"""
        # Conservative estimate using power analysis
        base_samples = self.min_samples
        
        if 'error_rate' in checks:
            # Higher error rate differences need more samples
            error_diff = abs(checks['error_rate'].get('canary_rate', 0) - 
                           checks['error_rate'].get('baseline_rate', 0))
            if error_diff > 0.01:
                base_samples *= 2
        
        return min(base_samples, self.max_samples)
```

## Feature Flags for Safety (2026)

### Graduated Rollout with Kill Switches

Modern feature flag system with comprehensive safety controls:

```python
from enum import Enum
from typing import Dict, List, Optional, Callable, Set
from dataclasses import dataclass
import time
import asyncio
from datetime import datetime, timedelta

class RolloutStrategy(Enum):
    PERCENTAGE = "percentage"  # Simple percentage
    COHORT = "cohort"          # Consistent user cohort
    CANARY = "canary"          # Multi-stage canary
    RING = "ring"              # Deployment rings

class KillSwitchPriority(Enum):
    CRITICAL = 1    # Instant kill, no delay
    HIGH = 2        # Kill within 5 seconds
    MEDIUM = 3      # Kill within 30 seconds
    LOW = 4         # Kill within 2 minutes

@dataclass
class RolloutStage:
    percentage: float
    duration_minutes: int
    success_criteria: Dict[str, float]
    auto_rollback_on_failure: bool = True

@dataclass
class FeatureConfig:
    name: str
    strategy: RolloutStrategy
    stages: List[RolloutStage]
    kill_switch_priority: KillSwitchPriority
    owner: str
    created_at: datetime
    dependencies: Set[str]  # Other features this depends on
    monitors: List[str]  # Associated monitoring dashboards

class ModernFeatureFlagSystem:
    """
    Modern feature flag system with:
    - Multi-stage graduated rollouts
    - Automatic rollback on failure
    - Kill switches with priority levels
    - Dependency management
    - Integration with monitoring
    """
    
    def __init__(self, 
                 flag_store,
                 metrics_client,
                 alerting_client,
                 circuit_breaker_factory):
        self.store = flag_store
        self.metrics = metrics_client
        self.alerts = alerting_client
        self.cb_factory = circuit_breaker_factory
        self.active_rollouts: Dict[str, Dict] = {}
        
    async def start_graduated_rollout(self, config: FeatureConfig):
        """Start a multi-stage graduated rollout"""
        
        # Validate dependencies are ready
        for dep in config.dependencies:
            if not await self._check_dependency_ready(dep):
                raise DependencyNotReadyError(f"Dependency {dep} not ready")
        
        self.active_rollouts[config.name] = {
            'config': config,
            'current_stage': -1,
            'start_time': datetime.utcnow(),
            'status': 'started'
        }
        
        # Begin first stage
        await self._advance_stage(config.name, 0)
    
    async def _advance_stage(self, feature_name: str, stage_idx: int):
        """Advance to the next rollout stage"""
        rollout = self.active_rollouts[feature_name]
        config = rollout['config']
        
        if stage_idx >= len(config.stages):
            # Rollout complete
            rollout['status'] = 'completed'
            await self._announce_completion(feature_name)
            return
        
        stage = config.stages[stage_idx]
        
        # Update rollout percentage
        await self._set_rollout_percentage(feature_name, stage.percentage)
        
        rollout['current_stage'] = stage_idx
        rollout['stage_start_time'] = datetime.utcnow()
        
        # Schedule monitoring for this stage
        asyncio.create_task(
            self._monitor_stage(feature_name, stage_idx, stage)
        )
    
    async def _monitor_stage(self, 
                          feature_name: str, 
                          stage_idx: int,
                          stage: RolloutStage):
        """Monitor a rollout stage and auto-advance or rollback"""
        
        start_time = datetime.utcnow()
        check_interval = 30  # seconds
        
        while True:
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            
            # Check if stage duration complete
            if elapsed >= stage.duration_minutes * 60:
                # Validate success criteria
                metrics = await self._collect_stage_metrics(feature_name)
                
                if self._meets_criteria(metrics, stage.success_criteria):
                    # Advance to next stage
                    await self._advance_stage(feature_name, stage_idx + 1)
                    return
                else:
                    if stage.auto_rollback_on_failure:
                        await self.emergency_kill(feature_name, 'stage_criteria_not_met')
                    return
            
            # Check for emergency conditions
            if await self._check_emergency_conditions(feature_name):
                await self.emergency_kill(feature_name, 'emergency_condition')
                return
            
            await asyncio.sleep(check_interval)
    
    async def emergency_kill(self, 
                           feature_name: str, 
                           reason: str,
                           priority: Optional[KillSwitchPriority] = None):
        """
        Emergency kill switch with priority-based response time.
        """
        config = self.active_rollouts.get(feature_name, {}).get('config')
        priority = priority or (config.kill_switch_priority if config 
                               else KillSwitchPriority.HIGH)
        
        kill_delay = {
            KillSwitchPriority.CRITICAL: 0,
            KillSwitchPriority.HIGH: 5,
            KillSwitchPriority.MEDIUM: 30,
            KillSwitchPriority.LOW: 120
        }[priority]
        
        if kill_delay > 0:
            await asyncio.sleep(kill_delay)
        
        # Disable feature immediately
        await self._set_rollout_percentage(feature_name, 0)
        
        # Invalidate caches
        await self._invalidate_feature_caches(feature_name)
        
        # Alert on-call
        await self.alerts.send_alert({
            'severity': 'critical',
            'title': f'Feature {feature_name} killed',
            'reason': reason,
            'priority': priority.name
        })
        
        # Update status
        if feature_name in self.active_rollouts:
            self.active_rollouts[feature_name]['status'] = 'killed'
            self.active_rollouts[feature_name]['kill_reason'] = reason
    
    async def _check_emergency_conditions(self, feature_name: str) -> bool:
        """Check for emergency conditions requiring immediate kill"""
        metrics = await self.metrics.get_recent_metrics(feature_name, minutes=2)
        
        # Critical error rate
        if metrics.error_rate > 0.10:  # 10% errors
            return True
        
        # Extreme latency
        if metrics.latency_p99 > 5000:  # 5 seconds
            return True
        
        # Business metric regression
        if metrics.conversion_rate < metrics.baseline_conversion_rate * 0.5:
            return True
        
        return False
```

## Circuit Breaker Pattern (2026)

### Adaptive Circuit Breaker

Modern circuit breaker with adaptive thresholds and ML-based failure prediction:

```python
from enum import Enum
import time
from typing import Callable, Optional, List
from dataclasses import dataclass
from collections import deque
import statistics

class CircuitState(Enum):
    CLOSED = "closed"          # Normal operation
    OPEN = "open"             # Failing, reject requests
    HALF_OPEN = "half_open"    # Testing if recovered
    ADAPTIVE = "adaptive"      # ML-adjusted thresholds

@dataclass
class FailurePattern:
    timestamp: float
    error_type: str
    latency_ms: float
    context: dict

class AdaptiveCircuitBreaker:
    """
    Circuit breaker with:
    - Adaptive thresholds based on history
    - ML-based failure prediction
    - Gradual recovery with partial traffic
    - Different thresholds for different error types
    """
    
    def __init__(self,
                 name: str,
                 base_failure_threshold: int = 5,
                 base_recovery_timeout: int = 60,
                 half_open_max_calls: int = 5,
                 adaptive_window: int = 100):
        self.name = name
        self.base_failure_threshold = base_failure_threshold
        self.base_recovery_timeout = base_recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.adaptive_window = adaptive_window
        
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        self.half_open_calls = 0
        
        # History for adaptation
        self.failure_history: deque = deque(maxlen=adaptive_window)
        self.latency_history: deque = deque(maxlen=adaptive_window)
        
        # Adaptive thresholds
        self.adaptive_failure_threshold = base_failure_threshold
        self.adaptive_recovery_timeout = base_recovery_timeout
        
    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        
        # Check if we should adapt thresholds
        self._adapt_thresholds()
        
        if self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitBreakerOpen(
                    f"Circuit {self.name} is OPEN - requests rejected"
                )
        
        if self.state == CircuitState.HALF_OPEN:
            if self.half_open_calls >= self.half_open_max_calls:
                raise CircuitBreakerOpen(
                    f"Circuit {self.name} HALF_OPEN limit reached"
                )
            self.half_open_calls += 1
        
        try:
            start = time.time()
            result = func(*args, **kwargs)
            latency = (time.time() - start) * 1000
            
            self._on_success(latency)
            return result
            
        except Exception as e:
            self._on_failure(type(e).__name__, (time.time() - start) * 1000)
            raise
    
    def _on_success(self, latency_ms: float):
        """Record successful call"""
        self.latency_history.append(latency_ms)
        
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.half_open_max_calls:
                # Recovery successful
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
                self._notify_state_change('CLOSED')
        else:
            self.failure_count = max(0, self.failure_count - 1)
    
    def _on_failure(self, error_type: str, latency_ms: float):
        """Record failed call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        self.failure_history.append(FailurePattern(
            timestamp=time.time(),
            error_type=error_type,
            latency_ms=latency_ms,
            context={}
        ))
        
        if self.state == CircuitState.HALF_OPEN:
            # Recovery failed
            self.state = CircuitState.OPEN
            self._notify_state_change('OPEN')
        elif self.failure_count >= self.adaptive_failure_threshold:
            self.state = CircuitState.OPEN
            self._notify_state_change('OPEN')
    
    def _adapt_thresholds(self):
        """Adapt thresholds based on historical patterns"""
        if len(self.failure_history) < 20:
            return
        
        # Calculate failure rate trend
        recent_failures = sum(1 for f in self.failure_history 
                            if time.time() - f.timestamp < 300)  # 5 min window
        failure_rate = recent_failures / len(self.failure_history)
        
        # Adjust threshold based on failure rate trend
        if failure_rate > 0.3:  # High failure environment
            self.adaptive_failure_threshold = max(3, self.base_failure_threshold - 2)
            self.adaptive_recovery_timeout = max(30, self.base_recovery_timeout - 30)
        elif failure_rate < 0.1:  # Stable environment
            self.adaptive_failure_threshold = self.base_failure_threshold
            self.adaptive_recovery_timeout = self.base_recovery_timeout
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to try reset"""
        if not self.last_failure_time:
            return True
        elapsed = time.time() - self.last_failure_time
        return elapsed >= self.adaptive_recovery_timeout
    
    def _notify_state_change(self, new_state: str):
        """Notify monitoring of state change"""
        # Integration with monitoring system
        pass

class CircuitBreakerOpen(Exception):
    pass
```

## Data Consistency Verification

### Real-time Consistency Checking

```python
from typing import Dict, List, Set, Tuple
from dataclasses import dataclass
import hashlib
import asyncio
from datetime import datetime

@dataclass
class ConsistencyViolation:
    table: str
    primary_key: str
    field: str
    old_value: any
    new_value: any
    timestamp: datetime
    severity: str

class RealtimeConsistencyChecker:
    """
    Real-time consistency checking during dual-write migrations.
    """
    
    def __init__(self, 
                 old_db, 
                 new_db,
                 schema_mapper,
                 tolerance_config: Dict):
        self.old_db = old_db
        self.new_db = new_db
        self.mapper = schema_mapper
        self.tolerance = tolerance_config
        self.violations: List[ConsistencyViolation] = []
        self.checksum_cache: Dict[str, str] = {}
        
    async def verify_write(self, 
                          table: str, 
                          primary_key: str,
                          expected_data: Dict):
        """Verify a write was replicated correctly"""
        
        # Get data from both databases
        old_data = await self._fetch_old(table, primary_key)
        new_data = await self._fetch_new(table, primary_key)
        
        # Transform old data to new schema for comparison
        transformed_old = self.mapper.transform(table, old_data)
        
        # Compare
        violations = self._compare_records(
            table, primary_key, transformed_old, new_data, expected_data
        )
        
        if violations:
            self.violations.extend(violations)
            await self._alert_violations(violations)
        
        return len(violations) == 0
    
    def _compare_records(self,
                        table: str,
                        primary_key: str,
                        old_data: Dict,
                        new_data: Dict,
                        expected: Dict) -> List[ConsistencyViolation]:
        """Compare two records and identify violations"""
        violations = []
        
        for field, expected_value in expected.items():
            old_value = old_data.get(field)
            new_value = new_data.get(field)
            
            # Check if values match within tolerance
            if not self._values_match(old_value, new_value, field):
                violations.append(ConsistencyViolation(
                    table=table,
                    primary_key=primary_key,
                    field=field,
                    old_value=old_value,
                    new_value=new_value,
                    timestamp=datetime.utcnow(),
                    severity=self._calculate_severity(field)
                ))
        
        return violations
    
    def _values_match(self, old_val, new_val, field: str) -> bool:
        """Check if values match within configured tolerance"""
        if old_val == new_val:
            return True
        
        # Check field-specific tolerance
        tolerance = self.tolerance.get(field, {})
        
        if tolerance.get('type') == 'numeric':
            diff = abs(float(old_val) - float(new_val))
            return diff <= tolerance.get('max_diff', 0.001)
        
        if tolerance.get('type') == 'timestamp':
            # Timestamps within seconds
            diff = abs(
                datetime.fromisoformat(str(old_val)) - 
                datetime.fromisoformat(str(new_val))
            ).total_seconds()
            return diff <= tolerance.get('max_seconds', 1)
        
        return False
    
    async def batch_verify(self, 
                          table: str,
                          batch_size: int = 1000) -> Dict:
        """Perform batch consistency verification"""
        
        stats = {
            'total_checked': 0,
            'mismatches': 0,
            'missing_in_new': 0,
            'missing_in_old': 0
        }
        
        cursor = None
        while True:
            batch = await self.old_db.get_batch(table, batch_size, cursor)
            if not batch:
                break
            
            for record in batch:
                pk = record.get('id')
                new_record = await self._fetch_new(table, pk)
                
                if not new_record:
                    stats['missing_in_new'] += 1
                    continue
                
                violations = self._compare_records(
                    table, pk, record, new_record, record
                )
                
                if violations:
                    stats['mismatches'] += 1
                
                stats['total_checked'] += 1
            
            cursor = batch[-1].get('id')
        
        return stats
```

## Automated Rollback Triggers (2026)

### Multi-dimensional Rollback System

```python
from dataclasses import dataclass
from typing import Dict, List, Optional, Callable
from enum import Enum
import asyncio
from datetime import datetime

class RollbackTriggerType(Enum):
    ERROR_RATE = "error_rate"
    LATENCY_PERCENTILE = "latency_percentile"
    BUSINESS_METRIC = "business_metric"
    INFRASTRUCTURE = "infrastructure"
    SECURITY = "security"
    MANUAL = "manual"

@dataclass
class TriggerConfig:
    trigger_type: RollbackTriggerType
    threshold: float
    duration_seconds: int
    consecutive_violations: int
    severity: str

class AutomatedRollbackTriggers:
    """
    Automated rollback system with:
    - Multi-dimensional trigger evaluation
    - Staged rollback (100% -> 50% -> 0%)
    - Integration with feature flags
    - Post-rollback verification
    """
    
    def __init__(self,
                 metrics_client,
                 flag_client,
                 alerting_client,
                 execution_client):
        self.metrics = metrics_client
        self.flags = flag_client
        self.alerts = alerting_client
        self.execution = execution_client
        self.trigger_configs: List[TriggerConfig] = []
        self.violation_history: Dict[str, List[datetime]] = {}
        
    def register_trigger(self, config: TriggerConfig):
        """Register a rollback trigger"""
        self.trigger_configs.append(config)
        
    async def evaluate_triggers(self, feature_name: str) -> Optional[str]:
        """Evaluate all triggers and return action if needed"""
        
        for config in self.trigger_configs:
            is_violated = await self._check_trigger(feature_name, config)
            
            if is_violated:
                # Track violation
                key = f"{feature_name}:{config.trigger_type.value}"
                if key not in self.violation_history:
                    self.violation_history[key] = []
                
                self.violation_history[key].append(datetime.utcnow())
                
                # Check if we have enough consecutive violations
                recent_violations = [
                    v for v in self.violation_history[key]
                    if (datetime.utcnow() - v).total_seconds() < config.duration_seconds
                ]
                
                if len(recent_violations) >= config.consecutive_violations:
                    return await self._execute_rollback(feature_name, config)
        
        return None
    
    async def _check_trigger(self, 
                           feature_name: str, 
                           config: TriggerConfig) -> bool:
        """Check if a specific trigger is violated"""
        
        metrics = await self.metrics.get_metrics(
            feature_name, 
            seconds=config.duration_seconds
        )
        
        if config.trigger_type == RollbackTriggerType.ERROR_RATE:
            return metrics.error_rate > config.threshold
        
        if config.trigger_type == RollbackTriggerType.LATENCY_PERCENTILE:
            return metrics.latency_p99 > config.threshold
        
        if config.trigger_type == RollbackTriggerType.BUSINESS_METRIC:
            # Check if business metric dropped below threshold
            current = await self.metrics.get_business_metric(feature_name)
            baseline = await self.metrics.get_business_baseline(feature_name)
            return (current / max(baseline, 1)) < config.threshold
        
        return False
    
    async def _execute_rollback(self,
                               feature_name: str,
                               trigger_config: TriggerConfig) -> str:
        """Execute staged rollback"""
        
        # Stage 1: Reduce to 50%
        await self.flags.set_percentage(feature_name, 50)
        await self.alerts.send_alert({
            'severity': trigger_config.severity,
            'title': f'Rollback initiated for {feature_name}',
            'trigger': trigger_config.trigger_type.value,
            'stage': '50%'
        })
        
        # Wait and check
        await asyncio.sleep(30)
        
        # Verify improvement
        metrics = await self.metrics.get_metrics(feature_name, seconds=30)
        still_violated = await self._check_trigger(feature_name, trigger_config)
        
        if still_violated:
            # Stage 2: Full rollback
            await self.flags.set_percentage(feature_name, 0)
            await self.alerts.send_alert({
                'severity': 'critical',
                'title': f'Full rollback executed for {feature_name}',
                'stage': '0%'
            })
            return 'full_rollback'
        
        return 'partial_rollback'
```

## Health Check Patterns (2026)

### Comprehensive Migration Health Checks

```python
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import asyncio

class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class HealthCheckResult:
    name: str
    status: HealthStatus
    response_time_ms: float
    details: Dict
    dependencies: List[str]

class MigrationHealthChecker:
    """
    Comprehensive health checking for migration scenarios.
    """
    
    def __init__(self, 
                 new_service,
                 old_service,
                 metrics_client,
                 dependencies: Dict[str, Callable]):
        self.new_service = new_service
        self.old_service = old_service
        self.metrics = metrics_client
        self.dependencies = dependencies
        
    async def full_migration_health_check(self) -> Dict:
        """Run all health checks for migration"""
        
        checks = await asyncio.gather(
            self._check_service_health('new_service', self.new_service),
            self._check_service_health('old_service', self.old_service),
            self._check_data_consistency(),
            self._check_dependency_health(),
            self._check_performance_regression(),
            self._check_error_budget(),
            self._check_business_metrics()
        )
        
        results = {
            'timestamp': datetime.utcnow().isoformat(),
            'overall_status': self._calculate_overall_status(checks),
            'checks': {check.name: {
                'status': check.status.value,
                'response_time_ms': check.response_time_ms,
                'details': check.details
            } for check in checks},
            'can_proceed': all(
                c.status in (HealthStatus.HEALTHY, HealthStatus.DEGRADED) 
                for c in checks
            )
        }
        
        return results
    
    async def _check_service_health(self, 
                                   name: str, 
                                   service) -> HealthCheckResult:
        """Check individual service health"""
        
        start = time.time()
        try:
            if asyncio.iscoroutinefunction(service.health_check):
                healthy = await asyncio.wait_for(
                    service.health_check(), 
                    timeout=5.0
                )
            else:
                healthy = service.health_check()
            
            response_time = (time.time() - start) * 1000
            
            return HealthCheckResult(
                name=name,
                status=HealthStatus.HEALTHY if healthy else HealthStatus.UNHEALTHY,
                response_time_ms=response_time,
                details={'healthy': healthy},
                dependencies=[]
            )
            
        except asyncio.TimeoutError:
            return HealthCheckResult(
                name=name,
                status=HealthStatus.UNHEALTHY,
                response_time_ms=5000,
                details={'error': 'timeout'},
                dependencies=[]
            )
    
    async def _check_data_consistency(self) -> HealthCheckResult:
        """Check data consistency between old and new"""
        
        # Sample and compare
        sample_size = 100
        mismatches = 0
        
        # Implementation of sampling comparison
        # ...
        
        consistency_rate = (sample_size - mismatches) / sample_size
        
        status = HealthStatus.HEALTHY if consistency_rate > 0.99 else \
                 HealthStatus.DEGRADED if consistency_rate > 0.95 else \
                 HealthStatus.UNHEALTHY
        
        return HealthCheckResult(
            name='data_consistency',
            status=status,
            response_time_ms=0,
            details={
                'sample_size': sample_size,
                'mismatches': mismatches,
                'consistency_rate': consistency_rate
            },
            dependencies=[]
        )
    
    def _calculate_overall_status(self, checks: List[HealthCheckResult]) -> str:
        """Calculate overall health status"""
        
        if any(c.status == HealthStatus.UNHEALTHY for c in checks):
            return HealthStatus.UNHEALTHY.value
        
        if any(c.status == HealthStatus.DEGRADED for c in checks):
            return HealthStatus.DEGRADED.value
        
        if all(c.status == HealthStatus.HEALTHY for c in checks):
            return HealthStatus.HEALTHY.value
        
        return HealthStatus.UNKNOWN.value
```

## Safety Checklist (2026 Update)

### Pre-Migration Safety Checklist

```markdown
## Pre-Migration Safety Verification

### System Health
- [ ] All services passing health checks
- [ ] Error rates below SLO for 7 days
- [ ] Latency p99 within acceptable range
- [ ] Resource utilization under 70%
- [ ] Database replication lag < 1 second

### Data Verification
- [ ] Backup verified and restorable
- [ ] Data consistency checks passing
- [ ] Schema migration scripts tested
- [ ] Rollback scripts tested
- [ ] Data migration dry-run completed

### Monitoring & Alerting
- [ ] Dashboards updated for new metrics
- [ ] Alert thresholds configured
- [ ] PagerDuty/Opsgenie integration verified
- [ ] Runbooks updated and accessible
- [ ] Escalation paths confirmed

### Feature Flags
- [ ] Kill switches configured and tested
- [ ] Gradual rollout stages defined
- [ ] Auto-rollback criteria documented
- [ ] Feature flag dashboard accessible
- [ ] Emergency contacts updated

### Testing
- [ ] Shadow traffic analysis passing (>99% match rate)
- [ ] Canary metrics within tolerance
- [ ] Load testing completed at 2x expected traffic
- [ ] Chaos engineering scenarios passed
- [ ] Rollback procedure tested in staging

### Communication
- [ ] On-call team notified
- [ ] Stakeholders informed of migration window
- [ ] Status page prepared
- [ ] Rollback communication templates ready
- [ ] Post-monitoring plan shared
```

## Best Practices (2026)

1. **Zero-Trust Verification**: Don't assume anything works - verify every assumption
2. **Observability First**: If you can't measure it, you can't safely migrate it
3. **Progressive Exposure**: Never expose 100% of traffic without intermediate validation
4. **Automated Guardrails**: Human judgment is fallible - automate safety checks
5. **Immutable Artifacts**: Never modify production directly, always deploy new versions
6. **Rollback Paranoia**: Always have a tested, working rollback ready
7. **Blameless Culture**: Focus on system safety, not individual blame

## References

- Martin Fowler - Feature Toggles: https://martinfowler.com/articles/feature-toggles.html
- Martin Fowler - Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
- Google SRE Book - Error Budgets: https://sre.google/sre-book/embracing-risk/
- AWS Well-Architected - Reliability Pillar: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html
- Azure Chaos Studio: https://azure.microsoft.com/en-us/services/chaos-studio/
