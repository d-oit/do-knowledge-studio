"""
Tests for circuit breaker module.
"""

from datetime import datetime, timedelta, timezone

from scripts.circuit_breaker import CircuitBreakerRegistry, CircuitBreakerState


class TestCircuitBreakerState:
    """Tests for CircuitBreakerState."""

    def test_initial_state_is_closed(self):
        """New circuit breaker should start in closed state."""
        cb = CircuitBreakerState()
        assert cb.failures == 0
        assert cb.open_until is None
        assert cb.is_open() is False

    def test_record_failure_increments_count(self):
        """Recording failure should increment failure count."""
        cb = CircuitBreakerState()
        cb.record_failure()
        assert cb.failures == 1
        assert cb.is_open() is False  # Not yet open with threshold=3

    def test_threshold_opens_circuit(self):
        """Reaching threshold should open the circuit."""
        cb = CircuitBreakerState()
        cb.record_failure(threshold=3)
        cb.record_failure(threshold=3)
        cb.record_failure(threshold=3)
        assert cb.failures == 3
        assert cb.is_open() is True
        assert cb.open_until is not None

    def test_custom_threshold(self):
        """Custom threshold should work."""
        cb = CircuitBreakerState()
        cb.record_failure(threshold=2)
        cb.record_failure(threshold=2)
        assert cb.failures == 2
        assert cb.is_open() is True

    def test_record_success_resets_state(self):
        """Recording success should reset circuit breaker."""
        cb = CircuitBreakerState()
        cb.record_failure(threshold=3)
        cb.record_failure(threshold=3)
        cb.record_failure(threshold=3)
        assert cb.is_open() is True

        cb.record_success()
        assert cb.failures == 0
        assert cb.open_until is None
        assert cb.is_open() is False

    def test_cooldown_duration(self):
        """Circuit should stay open for cooldown duration."""
        cb = CircuitBreakerState()
        cb.record_failure(threshold=3, cooldown_seconds=300)
        cb.record_failure(threshold=3, cooldown_seconds=300)
        cb.record_failure(threshold=3, cooldown_seconds=300)

        # Should be open now
        assert cb.open_until is not None
        expected_close = datetime.now(timezone.utc) + timedelta(seconds=300)
        # Allow 1 second tolerance for test execution time
        diff = abs((cb.open_until - expected_close).total_seconds())
        assert diff < 1

    def test_circuit_auto_closes_after_cooldown(self):
        """Circuit should close after cooldown expires."""
        cb = CircuitBreakerState()
        # Set open_until to past time
        cb.open_until = datetime.now(timezone.utc) - timedelta(seconds=1)
        assert cb.is_open() is False

    def test_timezone_handling(self):
        """Circuit breaker should handle timezone-naive datetime."""
        cb = CircuitBreakerState()
        # Set open_until to timezone-naive future time
        cb.open_until = datetime.now() + timedelta(seconds=300)
        # Should still be open because we convert to UTC internally
        assert cb.is_open() is True


class TestCircuitBreakerRegistry:
    """Tests for CircuitBreakerRegistry."""

    def test_registry_creates_breakers(self):
        """Registry should create breakers on demand."""
        registry = CircuitBreakerRegistry()
        cb = registry.get_breaker("provider_a")
        assert isinstance(cb, CircuitBreakerState)
        assert registry.is_open("provider_a") is False

    def test_registry_tracks_multiple_providers(self):
        """Registry should track multiple providers independently."""
        registry = CircuitBreakerRegistry()
        # Fail provider_a 3 times
        registry.record_failure("provider_a", threshold=3)
        registry.record_failure("provider_a", threshold=3)
        registry.record_failure("provider_a", threshold=3)

        # Fail provider_b only once
        registry.record_failure("provider_b", threshold=3)

        assert registry.is_open("provider_a") is True
        assert registry.is_open("provider_b") is False

    def test_registry_record_success(self):
        """Registry should reset breaker on success."""
        registry = CircuitBreakerRegistry()
        registry.record_failure("provider_a", threshold=3)
        registry.record_failure("provider_a", threshold=3)
        registry.record_failure("provider_a", threshold=3)
        assert registry.is_open("provider_a") is True

        registry.record_success("provider_a")
        assert registry.is_open("provider_a") is False

    def test_registry_persists_breakers(self):
        """Registry should persist breaker state across calls."""
        registry = CircuitBreakerRegistry()
        cb1 = registry.get_breaker("provider_a")
        cb1.record_failure(threshold=3)
        cb1.record_failure(threshold=3)

        # Get same breaker again
        cb2 = registry.get_breaker("provider_a")
        assert cb2.failures == 2

    def test_registry_custom_threshold_and_cooldown(self):
        """Registry should pass custom threshold and cooldown."""
        registry = CircuitBreakerRegistry()
        registry.record_failure("provider", threshold=2, cooldown_seconds=60)
        registry.record_failure("provider", threshold=2, cooldown_seconds=60)
        assert registry.is_open("provider") is True

        cb = registry.get_breaker("provider")
        expected_close = datetime.now(timezone.utc) + timedelta(seconds=60)
        diff = abs((cb.open_until - expected_close).total_seconds())
        assert diff < 1
