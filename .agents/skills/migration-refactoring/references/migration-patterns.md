# Migration Patterns

Detailed migration pattern implementations with latest 2025-2026 practices.

## Overview

This guide provides detailed implementation patterns for safe code and infrastructure migrations, incorporating the latest practices from Martin Fowler's updated Strangler Fig pattern (August 2024) and modern microservices migration strategies.

## Strangler Fig Pattern (2025-2026 Update)

The Strangler Fig pattern, as updated by Martin Fowler in August 2024, emphasizes gradual legacy modernization through four high-level activities:

1. **Understand the outcomes you want to achieve**
2. **Decide how to break the problem up into smaller parts**
3. **Successfully deliver the parts**
4. **Change the organization to allow this to happen on an ongoing basis**

### Modern Strangler Fig Implementation

```python
# Modern router with cohort-based routing for gradual migration
import hashlib
from enum import Enum
from typing import Dict, List, Optional, Callable

class MigrationPhase(Enum):
    DISCOVERY = "discovery"      # Understanding the system
    SEAM_IDENTIFICATION = "seams" # Finding integration points
    INCREMENTAL_REPLACEMENT = "incremental"  # Replacing piece by piece
    COMPLETION = "completion"     # Legacy system retired

class StranglerRouter:
    """
    Modern strangler fig router with support for:
    - Multi-phase migration tracking
    - Business capability-based routing
    - Transitional architecture support
    """
    
    def __init__(self):
        self.routes: Dict[str, Dict] = {}
        self.current_phase = MigrationPhase.DISCOVERY
        
    def register_route(self, 
                       business_capability: str,
                       legacy_handler: Callable,
                       modern_handler: Callable,
                       rollout_percentage: float = 0.0):
        """Register a business capability for gradual migration"""
        self.routes[business_capability] = {
            'legacy': legacy_handler,
            'modern': modern_handler,
            'rollout_pct': rollout_percentage,
            'metrics': {'modern_calls': 0, 'legacy_calls': 0, 'errors': 0}
        }
    
    def route_request(self, 
                      business_capability: str, 
                      context: Dict,
                      routing_key: Optional[str] = None) -> object:
        """
        Route request based on migration phase and rollout percentage.
        Uses consistent hashing for stable user routing.
        """
        if business_capability not in self.routes:
            raise ValueError(f"Unknown capability: {business_capability}")
        
        route = self.routes[business_capability]
        
        # Calculate user bucket for consistent routing
        if routing_key:
            bucket = self._calculate_bucket(routing_key)
        else:
            bucket = 0  # Default to legacy
            
        # Route decision
        if bucket < route['rollout_pct']:
            try:
                result = route['modern'](context)
                route['metrics']['modern_calls'] += 1
                return result
            except Exception as e:
                route['metrics']['errors'] += 1
                # Fallback to legacy on error
                return route['legacy'](context)
        else:
            route['metrics']['legacy_calls'] += 1
            return route['legacy'](context)
    
    def _calculate_bucket(self, key: str) -> float:
        """Consistent hashing for stable user routing"""
        hash_val = hashlib.md5(key.encode()).hexdigest()
        return (int(hash_val, 16) % 100) + 1  # 1-100
    
    def increase_rollout(self, business_capability: str, 
                         new_percentage: float,
                         validation_callback: Optional[Callable] = None):
        """Safely increase traffic to modern implementation"""
        if validation_callback and not validation_callback():
            raise MigrationValidationError(
                f"Validation failed for {business_capability}"
            )
        
        self.routes[business_capability]['rollout_pct'] = min(new_percentage, 100)
        
    def get_migration_status(self) -> Dict:
        """Get current migration status across all capabilities"""
        return {
            capability: {
                'rollout_percentage': route['rollout_pct'],
                'metrics': route['metrics'],
                'phase': self.current_phase.value
            }
            for capability, route in self.routes.items()
        }

class MigrationValidationError(Exception):
    pass
```

## Microservices Migration Patterns (2025-2026)

### Pattern 1: Branch by Abstraction

Create an abstraction layer that allows swapping implementations:

```python
from abc import ABC, abstractmethod
from typing import TypeVar, Generic

T = TypeVar('T')

class OrderService(ABC):
    """Abstraction for order operations"""
    
    @abstractmethod
    def create_order(self, order_data: Dict) -> T:
        pass
    
    @abstractmethod
    def get_order(self, order_id: str) -> T:
        pass

class LegacyOrderService(OrderService):
    """Legacy monolith implementation"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    def create_order(self, order_data: Dict) -> Dict:
        # Legacy database operations
        return self.db.insert('orders', order_data)
    
    def get_order(self, order_id: str) -> Dict:
        return self.db.query('SELECT * FROM orders WHERE id = %s', (order_id,))

class MicroserviceOrderService(OrderService):
    """New microservice implementation"""
    
    def __init__(self, service_url: str, http_client):
        self.url = service_url
        self.http = http_client
    
    def create_order(self, order_data: Dict) -> Dict:
        response = self.http.post(f"{self.url}/orders", json=order_data)
        return response.json()
    
    def get_order(self, order_id: str) -> Dict:
        response = self.http.get(f"{self.url}/orders/{order_id}")
        return response.json()

class OrderServiceRouter:
    """Router that can switch between implementations"""
    
    def __init__(self, 
                 legacy: OrderService, 
                 modern: OrderService,
                 feature_flags):
        self.legacy = legacy
        self.modern = modern
        self.flags = feature_flags
        self.dual_write_mode = False
        
    def create_order(self, order_data: Dict) -> Dict:
        """Route order creation with dual-write support during transition"""
        use_modern = self.flags.is_enabled('orders-microservice')
        
        if self.dual_write_mode:
            # Write to both during transition
            legacy_result = self.legacy.create_order(order_data)
            try:
                modern_result = self.modern.create_order(order_data)
                # Log any discrepancies
                self._verify_consistency(legacy_result, modern_result)
            except Exception as e:
                self._log_dual_write_error('create_order', order_data, e)
            
            return legacy_result if not use_modern else modern_result
        
        return self.modern.create_order(order_data) if use_modern \
               else self.legacy.create_order(order_data)
    
    def _verify_consistency(self, legacy_result, modern_result):
        """Verify data consistency between implementations"""
        # Implementation-specific validation
        pass
    
    def _log_dual_write_error(self, operation, data, error):
        """Log errors during dual-write for monitoring"""
        pass
```

### Pattern 2: Parallel Run

Run both old and new systems simultaneously to verify correctness:

```python
import asyncio
from dataclasses import dataclass
from typing import Any, Dict, List
import time

@dataclass
class ParallelRunResult:
    legacy_result: Any
    modern_result: Any
    legacy_latency_ms: float
    modern_latency_ms: float
    matches: bool
    differences: List[str]

class ParallelRunComparator:
    """
    Run both legacy and modern systems in parallel,
    comparing results without affecting users.
    """
    
    def __init__(self, legacy_service, modern_service, 
                 comparison_rules=None):
        self.legacy = legacy_service
        self.modern = modern_service
        self.comparison_rules = comparison_rules or {}
        self.mismatches = []
        
    async def execute_parallel(self, operation: str, 
                               params: Dict) -> ParallelRunResult:
        """Execute operation on both systems and compare"""
        
        # Run both calls concurrently
        legacy_task = self._call_with_timing(self.legacy, operation, params)
        modern_task = self._call_with_timing(self.modern, operation, params)
        
        legacy_result, legacy_time = await legacy_task
        modern_result, modern_time = await modern_task
        
        # Compare results
        differences = self._compare_results(
            legacy_result, modern_result, operation
        )
        
        result = ParallelRunResult(
            legacy_result=legacy_result,
            modern_result=modern_result,
            legacy_latency_ms=legacy_time,
            modern_latency_ms=modern_time,
            matches=len(differences) == 0,
            differences=differences
        )
        
        if not result.matches:
            self._log_mismatch(operation, params, result)
        
        return result
    
    async def _call_with_timing(self, service, operation: str, 
                                 params: Dict):
        """Call service and record timing"""
        start = time.time()
        method = getattr(service, operation)
        
        if asyncio.iscoroutinefunction(method):
            result = await method(**params)
        else:
            result = method(**params)
            
        elapsed = (time.time() - start) * 1000
        return result, elapsed
    
    def _compare_results(self, legacy: Any, modern: Any, 
                         operation: str) -> List[str]:
        """Compare results based on operation-specific rules"""
        rules = self.comparison_rules.get(operation, {})
        differences = []
        
        if rules.get('ignore_fields'):
            legacy = self._filter_fields(legacy, rules['ignore_fields'])
            modern = self._filter_fields(modern, rules['ignore_fields'])
        
        if rules.get('numeric_tolerance'):
            if not self._compare_numeric(
                legacy, modern, rules['numeric_tolerance']
            ):
                differences.append(f"Numeric mismatch in {operation}")
        else:
            if legacy != modern:
                differences.append(f"Value mismatch in {operation}")
        
        return differences
```

### Pattern 3: Change Data Capture (CDC) for Database Migration

```python
from dataclasses import dataclass
from typing import Callable, Dict
import json

@dataclass
class CDCEvent:
    table: str
    operation: str  # INSERT, UPDATE, DELETE
    before: Dict
    after: Dict
    timestamp: int
    transaction_id: str

class CDCProcessor:
    """
    Process CDC events to keep legacy and modern systems synchronized
    during database migration.
    """
    
    def __init__(self, source_db, target_db, 
                 schema_transformer: Callable):
        self.source = source_db
        self.target = target_db
        self.transformer = schema_transformer
        self.processors: Dict[str, Callable] = {
            'INSERT': self._handle_insert,
            'UPDATE': self._handle_update,
            'DELETE': self._handle_delete
        }
        
    def process_event(self, event: CDCEvent):
        """Process a CDC event and apply to target database"""
        processor = self.processors.get(event.operation)
        if processor:
            processor(event)
    
    def _handle_insert(self, event: CDCEvent):
        """Transform and insert into target database"""
        transformed = self.transformer.transform_insert(
            event.table, event.after
        )
        self.target.insert(transformed['table'], transformed['data'])
    
    def _handle_update(self, event: CDCEvent):
        """Transform and update in target database"""
        # Handle both old and new schema simultaneously
        pass
    
    def _handle_delete(self, event: CDCEvent):
        """Apply delete to target database"""
        pass

class SchemaTransformer:
    """
    Transform data between legacy and modern schemas.
    Supports expand-contract pattern.
    """
    
    def __init__(self):
        self.mappings: Dict[str, Dict] = {}
        
    def register_mapping(self, source_table: str, target_table: str,
                        column_mappings: Dict[str, str],
                        transformations: Dict[str, Callable] = None):
        """Register schema transformation rules"""
        self.mappings[source_table] = {
            'target_table': target_table,
            'columns': column_mappings,
            'transforms': transformations or {}
        }
    
    def transform_insert(self, source_table: str, 
                         data: Dict) -> Dict:
        """Transform data according to registered mappings"""
        mapping = self.mappings.get(source_table)
        if not mapping:
            return {'table': source_table, 'data': data}
        
        transformed = {}
        for source_col, target_col in mapping['columns'].items():
            value = data.get(source_col)
            if source_col in mapping['transforms']:
                value = mapping['transforms'][source_col](value)
            transformed[target_col] = value
        
        return {
            'table': mapping['target_table'],
            'data': transformed
        }
```

## Feature Flags for Migrations (2025-2026 Best Practices)

Modern feature flag systems support sophisticated migration scenarios:

```python
from enum import Enum
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
import time

class ToggleCategory(Enum):
    RELEASE = "release"           # Short-lived, for trunk-based development
    EXPERIMENT = "experiment"     # For A/B testing
    OPS = "ops"                   # Kill switches and operational controls
    PERMISSIONING = "permissioning" # Premium/alpha/beta features

@dataclass
class RolloutStage:
    percentage: float
    duration_minutes: int
    validation_criteria: Dict

class ModernMigrationFlags:
    """
    Feature flag system supporting modern migration patterns.
    Based on Martin Fowler's Feature Toggle patterns (2017)
    with 2025-2026 enhancements.
    """
    
    def __init__(self, flag_service, metrics_client):
        self.flags = flag_service
        self.metrics = metrics_client
        self.active_rollouts: Dict[str, Dict] = {}
        
    def configure_migration(self, 
                           feature_name: str,
                           category: ToggleCategory,
                           stages: List[RolloutStage],
                           auto_rollback_criteria: Optional[Dict] = None):
        """
        Configure a multi-stage migration rollout.
        
        Example stages:
        - Stage 1: 1% for 30 min (internal users)
        - Stage 2: 5% for 60 min  
        - Stage 3: 10% for 60 min
        - Stage 4: 25% for 120 min
        - Stage 5: 50% for 120 min
        - Stage 6: 100%
        """
        self.active_rollouts[feature_name] = {
            'category': category,
            'stages': stages,
            'current_stage': 0,
            'auto_rollback': auto_rollback_criteria,
            'start_time': None
        }
    
    def start_rollout(self, feature_name: str):
        """Begin automated staged rollout"""
        rollout = self.active_rollouts.get(feature_name)
        if not rollout:
            raise ValueError(f"No rollout configured for {feature_name}")
        
        rollout['start_time'] = time.time()
        self._advance_stage(feature_name, 0)
    
    def _advance_stage(self, feature_name: str, stage_idx: int):
        """Advance to the next rollout stage"""
        rollout = self.active_rollouts[feature_name]
        stage = rollout['stages'][stage_idx]
        
        # Set the new percentage
        self.flags.set_percentage(feature_name, stage.percentage)
        
        # Schedule validation and next stage
        if stage_idx < len(rollout['stages']) - 1:
            # Validate current stage before proceeding
            self._schedule_validation_and_advance(
                feature_name, stage_idx, stage
            )
    
    def _schedule_validation_and_advance(self, feature_name: str,
                                           current_stage: int,
                                           stage_config: RolloutStage):
        """Schedule validation and automatic stage advancement"""
        # In production, this would use a scheduler/cron
        # For now, we'll document the pattern
        pass
    
    def check_and_auto_rollback(self, feature_name: str) -> bool:
        """
        Check if auto-rollback criteria are met and execute if necessary.
        Returns True if rollback was triggered.
        """
        rollout = self.active_rollouts.get(feature_name)
        if not rollout or not rollout['auto_rollback']:
            return False
        
        criteria = rollout['auto_rollback']
        metrics = self.metrics.get_metrics(feature_name, minutes=5)
        
        # Check error rate
        if metrics.error_rate > criteria.get('max_error_rate', 0.01):
            self._emergency_rollback(feature_name, 'error_rate')
            return True
        
        # Check latency
        if metrics.latency_p99 > criteria.get('max_latency_p99', 2000):
            self._emergency_rollback(feature_name, 'latency')
            return True
        
        return False
    
    def _emergency_rollback(self, feature_name: str, reason: str):
        """Execute emergency rollback"""
        self.flags.set_percentage(feature_name, 0)
        # Alert on-call team
        # Log detailed rollback information
        pass
```

## Database Migration Patterns (2025-2026)

### Expand-Contract with CDC Support

```python
from enum import Enum
from typing import Optional
import logging

class MigrationPhase(Enum):
    EXPAND = "expand"          # Add new columns/tables
    DUAL_WRITE = "dual_write"  # Write to both schemas
    BACKFILL = "backfill"      # Migrate existing data
    READ_NEW = "read_new"      # Switch reads to new schema
    CONTRACT = "contract"      # Remove old schema

class ModernExpandContractMigration:
    """
    Expand-contract pattern with Change Data Capture support.
    Supports zero-downtime schema evolution.
    """
    
    def __init__(self, old_db, new_db, message_queue, feature_flags):
        self.old_db = old_db
        self.new_db = new_db
        self.mq = message_queue
        self.flags = feature_flags
        self.phase = MigrationPhase.EXPAND
        self.logger = logging.getLogger(__name__)
        
    def execute_phase(self, phase: MigrationPhase):
        """Execute a specific migration phase"""
        phases = {
            MigrationPhase.EXPAND: self._phase_expand,
            MigrationPhase.DUAL_WRITE: self._phase_dual_write,
            MigrationPhase.BACKFILL: self._phase_backfill,
            MigrationPhase.READ_NEW: self._phase_read_new,
            MigrationPhase.CONTRACT: self._phase_contract
        }
        
        handler = phases.get(phase)
        if handler:
            handler()
            self.phase = phase
    
    def _phase_expand(self):
        """Phase 1: Add new schema elements without breaking old"""
        # Add new tables/columns
        self.new_db.create_schema()
        # Add compatibility views in old database
        self.old_db.create_compatibility_views()
        
    def _phase_dual_write(self):
        """Phase 2: Write to both databases, read from old"""
        # Enable dual-write mode
        self.flags.enable('orders-dual-write')
        # Set up CDC from old to new for any missed writes
        self._setup_cdc_replication()
        
    def _setup_cdc_replication(self):
        """Set up Change Data Capture replication"""
        # Configure Debezium or similar CDC tool
        pass
    
    def _phase_backfill(self):
        """Phase 3: Migrate existing data in batches"""
        batch_size = 1000
        cursor = None
        
        while True:
            batch = self.old_db.get_batch(batch_size, cursor)
            if not batch:
                break
            
            for record in batch:
                transformed = self._transform_record(record)
                self.new_db.insert(transformed)
            
            cursor = batch[-1]['id']
            self._verify_batch(batch)
    
    def _phase_read_new(self):
        """Phase 4: Switch reads to new database"""
        # Gradual rollout using feature flags
        self.flags.configure_rollout('orders-read-new', [
            {'percentage': 1, 'duration': 30},
            {'percentage': 5, 'duration': 60},
            {'percentage': 10, 'duration': 60},
            {'percentage': 50, 'duration': 120},
            {'percentage': 100, 'duration': 0}
        ])
    
    def _phase_contract(self):
        """Phase 5: Remove old schema after verification"""
        # Ensure all data migrated
        # Verify consistency
        # Remove old tables/views
        pass
    
    def _transform_record(self, record: Dict) -> Dict:
        """Transform record from old to new schema"""
        # Schema-specific transformation logic
        return record
    
    def _verify_batch(self, batch: List[Dict]):
        """Verify batch was correctly migrated"""
        # Sample verification
        pass
```

## API Migration Patterns

### Dual-Write Pattern with Consistency Verification

```python
import asyncio
from typing import Dict, Optional, List
from dataclasses import dataclass
from datetime import datetime

@dataclass
class ConsistencyReport:
    timestamp: datetime
    total_operations: int
    mismatches: int
    error_count: int
    sample_mismatches: List[Dict]

class DualWriteAPIMigrator:
    """
    Modern dual-write pattern with automatic consistency checking
    and divergence detection.
    """
    
    def __init__(self, old_api, new_api, consistency_checker):
        self.old_api = old_api
        self.new_api = new_api
        self.checker = consistency_checker
        self.consistency_reports: List[ConsistencyReport] = []
        
    async def update_user(self, user_id: str, data: Dict) -> Dict:
        """Write to both APIs with consistency verification"""
        
        # Write to legacy API first (source of truth during migration)
        legacy_result = await self.old_api.update_user(user_id, data)
        
        # Async write to new API
        new_result = None
        try:
            new_result = await self.new_api.update_user(user_id, data)
        except Exception as e:
            self._log_new_api_error('update_user', user_id, data, e)
        
        # If both succeeded, verify consistency
        if new_result:
            consistent = self.checker.compare_user_update(
                legacy_result, new_result
            )
            if not consistent:
                self._log_consistency_violation(
                    'update_user', user_id, legacy_result, new_result
                )
        
        # Always return legacy result during migration
        return legacy_result
    
    def generate_consistency_report(self, hours: int = 24) -> ConsistencyReport:
        """Generate consistency report for monitoring"""
        # Aggregate consistency metrics
        pass

class APICircuitBreaker:
    """
    Circuit breaker specifically for API migration scenarios.
    Protects the system during new API instability.
    """
    
    def __init__(self, 
                 failure_threshold: int = 5,
                 recovery_timeout: int = 60,
                 half_open_max_calls: int = 3):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        
        self.failures = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED
        self.half_open_calls = 0
    
    def can_execute(self) -> bool:
        if self.state == CircuitState.CLOSED:
            return True
        elif self.state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                return True
            return False
        elif self.state == CircuitState.HALF_OPEN:
            return self.half_open_calls < self.half_open_max_calls
        
    def record_failure(self):
        self.failures += 1
        self.last_failure_time = datetime.now()
        
        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
        elif self.failures >= self.failure_threshold:
            self.state = CircuitState.OPEN
    
    def record_success(self):
        if self.state == CircuitState.HALF_OPEN:
            self.half_open_calls += 1
            if self.half_open_calls >= self.half_open_max_calls:
                self.state = CircuitState.CLOSED
                self.failures = 0
        elif self.state == CircuitState.CLOSED:
            self.failures = max(0, self.failures - 1)
```

## Testing Migration Code (2025-2026)

### Shadow Traffic Testing with ML-Based Anomaly Detection

```python
from typing import Callable, Dict, List
import numpy as np
from dataclasses import dataclass

@dataclass
class AnomalyScore:
    score: float
    threshold: float
    is_anomaly: bool
    features: Dict[str, float]

class ShadowTrafficTester:
    """
    Advanced shadow testing with ML-based anomaly detection
    for catching subtle migration issues.
    """
    
    def __init__(self, 
                 old_service,
                 new_service,
                 anomaly_detector,
                 feature_extractor):
        self.old_service = old_service
        self.new_service = new_service
        self.anomaly_detector = anomaly_detector
        self.feature_extractor = feature_extractor
        self.anomaly_history: List[AnomalyScore] = []
        
    async def shadow_request(self, request: Dict) -> Dict:
        """
        Process request through both services,
        return old service result while analyzing differences.
        """
        # Get result from old service (user-facing)
        old_result = await self.old_service.handle(request)
        
        # Async call to new service (shadow)
        try:
            new_result = await self.new_service.handle(request)
            
            # Extract features for comparison
            features = self.feature_extractor.extract(
                request, old_result, new_result
            )
            
            # ML-based anomaly detection
            anomaly_score = self.anomaly_detector.score(features)
            
            if anomaly_score.is_anomaly:
                self._log_anomaly(request, features, anomaly_score)
                
        except Exception as e:
            self._log_shadow_error(request, e)
        
        return old_result
    
    def _log_anomaly(self, request: Dict, features: Dict, 
                     score: AnomalyScore):
        """Log detected anomalies for investigation"""
        self.anomaly_history.append(score)
        # Send to monitoring/alerting system
```

### Modern Canary Analysis

```python
from dataclasses import dataclass
from typing import Dict, List, Optional
from statistics import mean, stdev
import scipy.stats as stats

@dataclass
class MetricSnapshot:
    timestamp: int
    requests: int
    errors: int
    latency_p50: float
    latency_p99: float
    business_metric: Optional[float] = None

class ModernCanaryAnalyzer:
    """
    Statistical canary analysis with automatic promotion/rollback decisions.
    """
    
    def __init__(self,
                 error_rate_threshold: float = 0.05,
                 latency_threshold: float = 0.20,
                 confidence_level: float = 0.95):
        self.error_rate_threshold = error_rate_threshold
        self.latency_threshold = latency_threshold
        self.confidence_level = confidence_level
        
    def analyze(self, 
                canary_metrics: List[MetricSnapshot],
                baseline_metrics: List[MetricSnapshot]) -> Dict:
        """
        Perform statistical comparison of canary vs baseline.
        Returns recommendation: promote, rollback, or continue.
        """
        
        # Aggregate metrics
        canary_errors = sum(m.errors for m in canary_metrics)
        canary_requests = sum(m.requests for m in canary_metrics)
        baseline_errors = sum(m.errors for m in baseline_metrics)
        baseline_requests = sum(m.requests for m in baseline_metrics)
        
        # Statistical tests
        results = {
            'error_rate_check': self._check_error_rate_statistical(
                canary_errors, canary_requests,
                baseline_errors, baseline_requests
            ),
            'latency_check': self._check_latency_statistical(
                canary_metrics, baseline_metrics
            ),
            'business_metric_check': self._check_business_metrics(
                canary_metrics, baseline_metrics
            )
        }
        
        all_pass = all(r['passed'] for r in results.values())
        
        if all_pass:
            recommendation = 'promote'
        elif any(r.get('critical', False) for r in results.values()):
            recommendation = 'rollback'
        else:
            recommendation = 'continue'  # Keep monitoring
        
        return {
            'recommendation': recommendation,
            'checks': results,
            'sample_size': len(canary_metrics)
        }
    
    def _check_error_rate_statistical(self,
                                       canary_errors: int,
                                       canary_requests: int,
                                       baseline_errors: int,
                                       baseline_requests: int) -> Dict:
        """Statistical test for error rate comparison"""
        # Two-proportion z-test
        p1 = canary_errors / canary_requests
        p2 = baseline_errors / baseline_requests
        
        # Pooled proportion
        p_pool = (canary_errors + baseline_errors) / \
                 (canary_requests + baseline_requests)
        
        # Standard error
        se = np.sqrt(p_pool * (1 - p_pool) * 
                     (1/canary_requests + 1/baseline_requests))
        
        # Z-score
        z = (p1 - p2) / se if se > 0 else 0
        
        # Critical value for confidence level
        z_critical = stats.norm.ppf(1 - (1 - self.confidence_level) / 2)
        
        return {
            'passed': abs(z) < z_critical and p1 <= p2 * (1 + self.error_rate_threshold),
            'canary_rate': p1,
            'baseline_rate': p2,
            'z_score': z,
            'critical': p1 > p2 * 1.5  # 50% increase is critical
        }
    
    def _check_latency_statistical(self,
                                    canary: List[MetricSnapshot],
                                    baseline: List[MetricSnapshot]) -> Dict:
        """Statistical test for latency comparison"""
        canary_p99s = [m.latency_p99 for m in canary]
        baseline_p99s = [m.latency_p99 for m in baseline]
        
        # Mann-Whitney U test (non-parametric)
        statistic, p_value = stats.mannwhitneyu(
            canary_p99s, baseline_p99s, alternative='greater'
        )
        
        canary_mean = mean(canary_p99s)
        baseline_mean = mean(baseline_p99s)
        
        return {
            'passed': p_value > (1 - self.confidence_level) and \
                     canary_mean <= baseline_mean * (1 + self.latency_threshold),
            'canary_mean_p99': canary_mean,
            'baseline_mean_p99': baseline_mean,
            'p_value': p_value
        }
```

## Best Practices (2025-2026 Update)

1. **Start with clear outcomes**: Define what success looks like before beginning migration
2. **Identify seams early**: Use legacy seams to break the system into replaceable parts
3. **Build transitional architecture**: Accept that temporary code is necessary and valuable
4. **Change organizational processes**: Legacy systems become brittle due to processes, not just code
5. **Use cohort-based routing**: Consistently route users to maintain session consistency
6. **Implement cluster immune systems**: Automatically detect regressions and roll back
7. **Monitor business metrics**: Not just technical metrics - watch conversion rates, user engagement
8. **Practice rollbacks regularly**: Ensure rollback procedures work before you need them

## References

- Martin Fowler - Strangler Fig Application (August 2024): https://martinfowler.com/bliki/StranglerFigApplication.html
- Martin Fowler - Patterns of Legacy Displacement: https://martinfowler.com/articles/patterns-legacy-displacement/
- Martin Fowler - Feature Toggles: https://martinfowler.com/articles/feature-toggles.html
- Thoughtworks - Embracing Strangler Fig Pattern: https://www.thoughtworks.com/insights/articles/embracing-strangler-fig-pattern-legacy-modernization-part-one
