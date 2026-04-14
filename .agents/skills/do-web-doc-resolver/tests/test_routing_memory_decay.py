"""
Tests for routing memory TTL decay, metadata filtering, and recency weighting.
"""

import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from scripts.routing_memory import DEFAULT_TTL_SECONDS, RoutingMemory


class TestTTLExpiration:
    """Tests for TTL-based expiration."""

    def test_default_ttl_is_30_days(self):
        """DEFAULT_TTL_SECONDS should equal 30 days in seconds."""
        assert DEFAULT_TTL_SECONDS == 30 * 24 * 3600

    def test_get_with_decay_returns_data_when_not_expired(self):
        """get_with_decay should return data for fresh entries."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        result = rm.get_with_decay("example.com", "provider_a")
        assert result is not None
        assert result["success"] == 1
        assert result["failure"] == 0

    def test_get_with_decay_returns_none_for_missing(self):
        """get_with_decay should return None for non-existent entries."""
        rm = RoutingMemory()
        result = rm.get_with_decay("example.com", "provider_a")
        assert result is None

    def test_get_with_decay_removes_expired_entry(self):
        """get_with_decay should remove and return None for expired entries."""
        rm = RoutingMemory(ttl_seconds=1)
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        with patch("scripts.routing_memory.datetime") as mock_dt:
            mock_dt.now.return_value = datetime.now(timezone.utc) + timedelta(seconds=2)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw) if a else datetime.now(timezone.utc)
            result = rm.get_with_decay("example.com", "provider_a")
        assert result is None
        assert "example.com" not in rm.domain_stats

    def test_get_with_decay_all_returns_only_valid(self):
        """get_with_decay_all should return only non-expired entries."""
        rm = RoutingMemory(ttl_seconds=1)
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        rm.record("example.com", "provider_b", success=True, latency_ms=200, quality_score=0.8)
        with patch("scripts.routing_memory.datetime") as mock_dt:
            mock_dt.now.return_value = datetime.now(timezone.utc) + timedelta(seconds=2)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw) if a else datetime.now(timezone.utc)
            results = rm.get_with_decay_all("example.com")
        assert results == {}
        assert "example.com" not in rm.domain_stats

    def test_get_with_decay_all_cleans_empty_domain(self):
        """get_with_decay_all should remove domain when all entries expire."""
        rm = RoutingMemory(ttl_seconds=1)
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        with patch("scripts.routing_memory.datetime") as mock_dt:
            mock_dt.now.return_value = datetime.now(timezone.utc) + timedelta(seconds=2)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw) if a else datetime.now(timezone.utc)
            rm.get_with_decay_all("example.com")
        assert "example.com" not in rm.domain_stats


class TestMetadataFiltering:
    """Tests for metadata filtering support."""

    def test_record_with_metadata_stores_metadata(self):
        """record_with_metadata should store metadata in stats."""
        rm = RoutingMemory()
        rm.record_with_metadata(
            "example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9,
            metadata={"region": "us-east", "tier": "premium"}
        )
        result = rm.get_with_decay("example.com", "provider_a")
        assert result["metadata"]["region"] == "us-east"
        assert result["metadata"]["tier"] == "premium"

    def test_record_with_metadata_no_metadata(self):
        """record_with_metadata should work without metadata."""
        rm = RoutingMemory()
        rm.record_with_metadata(
            "example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9
        )
        result = rm.get_with_decay("example.com", "provider_a")
        assert result["metadata"] == {}

    def test_query_with_filters_no_filter_returns_all(self):
        """query_with_filters without filter should return all matching providers."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        rm.record("example.com", "provider_b", success=True, latency_ms=200, quality_score=0.8)
        result = rm.query_with_filters("example.com", ["provider_a", "provider_b"])
        assert set(result) == {"provider_a", "provider_b"}

    def test_query_with_filters_matches_metadata(self):
        """query_with_filters should filter by metadata values."""
        rm = RoutingMemory()
        rm.record_with_metadata(
            "example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9,
            metadata={"region": "us-east"}
        )
        rm.record_with_metadata(
            "example.com", "provider_b", success=True, latency_ms=200, quality_score=0.8,
            metadata={"region": "eu-west"}
        )
        result = rm.query_with_filters("example.com", ["provider_a", "provider_b"], metadata_filter={"region": "us-east"})
        assert result == ["provider_a"]

    def test_query_with_filters_excludes_non_matching(self):
        """query_with_filters should exclude providers not matching metadata."""
        rm = RoutingMemory()
        rm.record_with_metadata(
            "example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9,
            metadata={"tier": "premium"}
        )
        rm.record_with_metadata(
            "example.com", "provider_b", success=True, latency_ms=200, quality_score=0.8,
            metadata={"tier": "basic"}
        )
        result = rm.query_with_filters("example.com", ["provider_a", "provider_b"], metadata_filter={"tier": "enterprise"})
        assert result == []

    def test_query_with_filters_missing_domain_returns_providers(self):
        """query_with_filters should return providers for missing domain."""
        rm = RoutingMemory()
        result = rm.query_with_filters("unknown.com", ["provider_a", "provider_b"])
        assert result == ["provider_a", "provider_b"]

    def test_query_with_filters_excludes_expired(self):
        """query_with_filters should exclude expired entries."""
        rm = RoutingMemory(ttl_seconds=1)
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        with patch("scripts.routing_memory.datetime") as mock_dt:
            mock_dt.now.return_value = datetime.now(timezone.utc) + timedelta(seconds=2)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw) if a else datetime.now(timezone.utc)
            result = rm.query_with_filters("example.com", ["provider_a"])
        assert result == []

    def test_metadata_accumulates_on_multiple_records(self):
        """Multiple record_with_metadata calls should accumulate metadata."""
        rm = RoutingMemory()
        rm.record_with_metadata(
            "example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9,
            metadata={"region": "us-east"}
        )
        rm.record_with_metadata(
            "example.com", "provider_a", success=True, latency_ms=150, quality_score=0.85,
            metadata={"tier": "premium"}
        )
        result = rm.get_with_decay("example.com", "provider_a")
        assert result["metadata"]["region"] == "us-east"
        assert result["metadata"]["tier"] == "premium"


class TestRecencyWeighting:
    """Tests for recency weighting in ranking."""

    def test_decay_factor_is_one_for_fresh(self):
        """decay_factor should return ~1.0 for current timestamps."""
        rm = RoutingMemory()
        now = datetime.now(timezone.utc)
        assert rm.decay_factor(now) > 0.99

    def test_decay_factor_decreases_with_age(self):
        """decay_factor should decrease as entry ages."""
        rm = RoutingMemory(ttl_seconds=100)
        now = datetime.now(timezone.utc)
        old = now - timedelta(seconds=50)
        assert 0.49 < rm.decay_factor(old) < 0.51

    def test_decay_factor_is_zero_past_ttl(self):
        """decay_factor should return 0.0 past TTL."""
        rm = RoutingMemory(ttl_seconds=100)
        now = datetime.now(timezone.utc)
        old = now - timedelta(seconds=200)
        assert rm.decay_factor(old) == 0.0

    def test_decay_factor_negative_age_is_one(self):
        """decay_factor should return 1.0 for future timestamps."""
        rm = RoutingMemory()
        future = datetime.now(timezone.utc) + timedelta(seconds=100)
        assert rm.decay_factor(future) == 1.0

    def test_rank_uses_decay_as_tiebreaker(self):
        """Ranking should use recency as tiebreaker when scores are equal."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        time.sleep(0.01)
        rm.record("example.com", "provider_b", success=True, latency_ms=100, quality_score=0.9)
        ranked = rm.rank("example.com", ["provider_a", "provider_b"])
        assert ranked[0] == "provider_b"

    def test_get_p75_latency_returns_default_for_expired(self):
        """get_p75_latency should return default for expired entries."""
        rm = RoutingMemory(ttl_seconds=1)
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        with patch("scripts.routing_memory.datetime") as mock_dt:
            mock_dt.now.return_value = datetime.now(timezone.utc) + timedelta(seconds=2)
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw) if a else datetime.now(timezone.utc)
            result = rm.get_p75_latency("example.com", "provider_a", default=5000)
        assert result == 5000


class TestBackwardCompatibility:
    """Tests for backward compatibility with existing API."""

    def test_record_still_works(self):
        """record() should work unchanged."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        stats = rm.domain_stats["example.com"]["provider_a"]
        assert stats["success"] == 1
        assert stats["failure"] == 0
        assert stats["avg_latency_ms"] == 100.0
        assert stats["avg_quality"] == 0.9

    def test_record_sets_last_updated(self):
        """record() should set last_updated timestamp."""
        rm = RoutingMemory()
        before = datetime.now(timezone.utc)
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        after = datetime.now(timezone.utc)
        stats = rm.domain_stats["example.com"]["provider_a"]
        assert before <= stats["last_updated"] <= after

    def test_record_initializes_metadata(self):
        """record() should initialize empty metadata dict."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        stats = rm.domain_stats["example.com"]["provider_a"]
        assert stats["metadata"] == {}

    def test_rank_still_works(self):
        """rank() should work unchanged."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        rm.record("example.com", "provider_b", success=False, latency_ms=500, quality_score=0.0)
        ranked = rm.rank("example.com", ["provider_a", "provider_b"])
        assert ranked[0] == "provider_a"

    def test_get_p75_still_works(self):
        """get_p75_latency() should work unchanged."""
        rm = RoutingMemory()
        rm.record("example.com", "provider_a", success=True, latency_ms=200, quality_score=0.9)
        p75 = rm.get_p75_latency("example.com", "provider_a")
        assert p75 == 300

    def test_custom_ttl_seconds(self):
        """RoutingMemory should accept custom TTL."""
        rm = RoutingMemory(ttl_seconds=86400)
        assert rm.ttl_seconds == 86400
