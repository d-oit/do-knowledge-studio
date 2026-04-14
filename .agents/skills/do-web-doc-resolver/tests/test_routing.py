"""
Tests for routing memory module.
"""

from scripts.routing_memory import RoutingMemory


class TestRoutingMemoryInit:
    """Tests for RoutingMemory initialization."""

    def test_empty_initialization(self):
        """Routing memory should start empty."""
        rm = RoutingMemory()
        assert len(rm.domain_stats) == 0

    def test_default_stats_structure(self):
        """Stats should have expected default structure."""
        rm = RoutingMemory()
        # Accessing unknown domain/provider should create default stats
        stats = rm.domain_stats["unknown.com"]["unknown_provider"]
        assert stats["success"] == 0
        assert stats["failure"] == 0
        assert stats["avg_latency_ms"] == 0.0
        assert stats["avg_quality"] == 0.0


class TestRoutingMemoryRecord:
    """Tests for RoutingMemory.record method."""

    def test_record_success(self):
        """Recording success should update success count."""
        rm = RoutingMemory()
        rm.record("docs.python.org", "jina", success=True, latency_ms=500, quality_score=0.9)
        stats = rm.domain_stats["docs.python.org"]["jina"]
        assert stats["success"] == 1
        assert stats["failure"] == 0
        assert stats["avg_latency_ms"] == 500.0
        assert stats["avg_quality"] == 0.9

    def test_record_failure(self):
        """Recording failure should update failure count."""
        rm = RoutingMemory()
        rm.record("docs.python.org", "firecrawl", success=False, latency_ms=2000, quality_score=0.0)
        stats = rm.domain_stats["docs.python.org"]["firecrawl"]
        assert stats["success"] == 0
        assert stats["failure"] == 1
        assert stats["avg_latency_ms"] == 2000.0
        assert stats["avg_quality"] == 0.0

    def test_record_multiple_updates_average(self):
        """Multiple records should update averages correctly."""
        rm = RoutingMemory()
        # First record
        rm.record("example.com", "provider", success=True, latency_ms=100, quality_score=0.8)
        # Second record
        rm.record("example.com", "provider", success=True, latency_ms=200, quality_score=0.9)

        stats = rm.domain_stats["example.com"]["provider"]
        # Average latency: (100 + 200) / 2 = 150
        assert stats["avg_latency_ms"] == 150.0
        # Average quality: (0.8 + 0.9) / 2 = 0.85
        assert abs(stats["avg_quality"] - 0.85) < 1e-9

    def test_record_mixed_success_failure(self):
        """Mixed success/failure should track both counts."""
        rm = RoutingMemory()
        rm.record("site.com", "provider", success=True, latency_ms=100, quality_score=0.9)
        rm.record("site.com", "provider", success=False, latency_ms=500, quality_score=0.0)
        rm.record("site.com", "provider", success=True, latency_ms=150, quality_score=0.8)

        stats = rm.domain_stats["site.com"]["provider"]
        assert stats["success"] == 2
        assert stats["failure"] == 1


class TestRoutingMemoryRank:
    """Tests for RoutingMemory.rank method."""

    def test_rank_no_history_returns_original(self):
        """Ranking with no history should return original order."""
        rm = RoutingMemory()
        providers = ["exa", "tavily", "serper", "duckduckgo"]
        ranked = rm.rank("unknown.com", providers)
        assert ranked == providers

    def test_rank_with_history_sorts_by_success_rate(self):
        """Ranking should sort by success rate."""
        rm = RoutingMemory()
        # Provider A: 80% success
        rm.record("site.com", "provider_a", success=True, latency_ms=100, quality_score=0.8)
        rm.record("site.com", "provider_a", success=True, latency_ms=100, quality_score=0.8)
        rm.record("site.com", "provider_a", success=True, latency_ms=100, quality_score=0.8)
        rm.record("site.com", "provider_a", success=True, latency_ms=100, quality_score=0.8)
        rm.record("site.com", "provider_a", success=False, latency_ms=500, quality_score=0.0)

        # Provider B: 100% success
        rm.record("site.com", "provider_b", success=True, latency_ms=200, quality_score=0.9)
        rm.record("site.com", "provider_b", success=True, latency_ms=200, quality_score=0.9)

        ranked = rm.rank("site.com", ["provider_a", "provider_b"])
        # provider_b should rank higher (100% vs 80%)
        assert ranked[0] == "provider_b"
        assert ranked[1] == "provider_a"

    def test_rank_uses_quality_as_secondary_sort(self):
        """Ranking should use quality score as secondary sort."""
        rm = RoutingMemory()
        # Provider A: 100% success, quality 0.8
        rm.record("site.com", "provider_a", success=True, latency_ms=100, quality_score=0.8)
        # Provider B: 100% success, quality 0.9
        rm.record("site.com", "provider_b", success=True, latency_ms=100, quality_score=0.9)

        ranked = rm.rank("site.com", ["provider_a", "provider_b"])
        # Both have same success rate, provider_b should win on quality
        assert ranked[0] == "provider_b"

    def test_rank_uses_latency_as_third_sort(self):
        """Ranking should use latency (negative) as third sort."""
        rm = RoutingMemory()
        # Provider A: 100% success, quality 0.9, latency 200ms
        rm.record("site.com", "provider_a", success=True, latency_ms=200, quality_score=0.9)
        # Provider B: 100% success, quality 0.9, latency 100ms
        rm.record("site.com", "provider_b", success=True, latency_ms=100, quality_score=0.9)

        ranked = rm.rank("site.com", ["provider_a", "provider_b"])
        # Same success and quality, provider_b should win on lower latency
        assert ranked[0] == "provider_b"

    def test_rank_filters_unrequested_providers(self):
        """Ranking should only return providers that were requested."""
        rm = RoutingMemory()
        rm.record("site.com", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        rm.record("site.com", "provider_b", success=True, latency_ms=100, quality_score=0.8)
        rm.record("site.com", "provider_c", success=True, latency_ms=100, quality_score=0.7)

        ranked = rm.rank("site.com", ["provider_a", "provider_c"])
        # provider_b not in list, shouldn't appear
        assert "provider_b" not in ranked
        assert set(ranked) == {"provider_a", "provider_c"}


class TestRoutingMemoryP75Latency:
    """Tests for RoutingMemory.get_p75_latency method."""

    def test_p75_latency_no_stats_returns_default(self):
        """No stats should return default latency."""
        rm = RoutingMemory()
        p75 = rm.get_p75_latency("unknown.com", "unknown_provider", default=2500)
        assert p75 == 2500

    def test_p75_latency_empty_stats_returns_default(self):
        """Stats with zero avg_latency should return default."""
        rm = RoutingMemory()
        # Access domain_stats to create empty entry
        _ = rm.domain_stats["site.com"]["provider"]
        p75 = rm.get_p75_latency("site.com", "provider", default=2500)
        assert p75 == 2500

    def test_p75_latency_estimates_from_average(self):
        """P75 should be estimated as 1.5x average."""
        rm = RoutingMemory()
        rm.record("site.com", "provider", success=True, latency_ms=200, quality_score=0.9)
        # P75 heuristic: 200 * 1.5 = 300
        p75 = rm.get_p75_latency("site.com", "provider", default=2500)
        assert p75 == 300

    def test_p75_latency_with_multiple_records(self):
        """P75 should use averaged latency."""
        rm = RoutingMemory()
        rm.record("site.com", "provider", success=True, latency_ms=100, quality_score=0.9)
        rm.record("site.com", "provider", success=True, latency_ms=200, quality_score=0.9)
        rm.record("site.com", "provider", success=True, latency_ms=300, quality_score=0.9)
        # Average = 200, P75 = 200 * 1.5 = 300
        p75 = rm.get_p75_latency("site.com", "provider", default=2500)
        assert p75 == 300


class TestRoutingMemoryMultipleDomains:
    """Tests for RoutingMemory with multiple domains."""

    def test_separate_domain_tracking(self):
        """Different domains should be tracked separately."""
        rm = RoutingMemory()
        rm.record("docs.python.org", "jina", success=True, latency_ms=100, quality_score=0.9)
        rm.record("github.com", "firecrawl", success=True, latency_ms=200, quality_score=0.8)

        assert rm.domain_stats["docs.python.org"]["jina"]["success"] == 1
        assert rm.domain_stats["github.com"]["firecrawl"]["success"] == 1
        assert "firecrawl" not in rm.domain_stats["docs.python.org"]
        assert "jina" not in rm.domain_stats["github.com"]

    def test_rank_per_domain(self):
        """Ranking should be per-domain."""
        rm = RoutingMemory()
        # Provider A works better on docs.python.org
        rm.record("docs.python.org", "provider_a", success=True, latency_ms=100, quality_score=0.9)
        # Provider B works better on github.com
        rm.record("github.com", "provider_b", success=True, latency_ms=100, quality_score=0.9)

        # On docs.python.org, provider_a should rank first
        ranked = rm.rank("docs.python.org", ["provider_a", "provider_b"])
        assert ranked[0] == "provider_a"

        # On github.com, provider_b should rank first
        ranked = rm.rank("github.com", ["provider_a", "provider_b"])
        assert ranked[0] == "provider_b"
