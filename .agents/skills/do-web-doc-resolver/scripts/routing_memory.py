"""
Per-domain routing memory for the Web Doc Resolver.
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

DEFAULT_TTL_SECONDS = 30 * 24 * 3600  # 30 days


def _default_stats() -> dict[str, Any]:
    return {
        "success": 0,
        "failure": 0,
        "avg_latency_ms": 0.0,
        "avg_quality": 0.0,
        "last_updated": datetime.now(timezone.utc),
        "metadata": {},
    }


class RoutingMemory:
    def __init__(self, ttl_seconds: int = DEFAULT_TTL_SECONDS):
        # domain -> provider -> stats dict
        self.domain_stats = defaultdict(lambda: defaultdict(_default_stats))
        self.ttl_seconds = ttl_seconds

    def record(
        self, domain: str, provider: str, success: bool, latency_ms: int, quality_score: float
    ) -> None:
        self.record_with_metadata(domain, provider, success, latency_ms, quality_score)

    def record_with_metadata(
        self,
        domain: str,
        provider: str,
        success: bool,
        latency_ms: int,
        quality_score: float,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        stats = self.domain_stats[domain][provider]
        total = stats["success"] + stats["failure"]
        stats["avg_latency_ms"] = ((stats["avg_latency_ms"] * total) + latency_ms) / (total + 1)
        stats["avg_quality"] = ((stats["avg_quality"] * total) + quality_score) / (total + 1)
        if success:
            stats["success"] += 1
        else:
            stats["failure"] += 1
        stats["last_updated"] = datetime.now(timezone.utc)
        if metadata:
            stats["metadata"].update(metadata)

    def decay_factor(self, last_updated: datetime) -> float:
        age = (datetime.now(timezone.utc) - last_updated).total_seconds()
        if age <= 0:
            return 1.0
        return max(0.0, 1.0 - (age / self.ttl_seconds))

    def get_with_decay(self, domain: str, provider: str) -> dict[str, Any] | None:
        if domain not in self.domain_stats or provider not in self.domain_stats[domain]:
            return None
        stats = self.domain_stats[domain][provider]
        if self.decay_factor(stats["last_updated"]) == 0.0:
            del self.domain_stats[domain][provider]
            if not self.domain_stats[domain]:
                del self.domain_stats[domain]
            return None
        return dict(stats)

    def get_with_decay_all(self, domain: str) -> dict[str, dict[str, Any]]:
        if domain not in self.domain_stats:
            return {}
        results = {}
        expired = []
        for provider, stats in self.domain_stats[domain].items():
            if self.decay_factor(stats["last_updated"]) == 0.0:
                expired.append(provider)
            else:
                results[provider] = dict(stats)
        for provider in expired:
            del self.domain_stats[domain][provider]
        if not self.domain_stats[domain]:
            del self.domain_stats[domain]
        return results

    def query_with_filters(
        self,
        domain: str,
        providers: list[str],
        metadata_filter: dict[str, Any] | None = None,
    ) -> list[str]:
        if domain not in self.domain_stats:
            return providers
        result = []
        for provider in providers:
            if provider not in self.domain_stats[domain]:
                continue
            stats = self.domain_stats[domain][provider]
            if self.decay_factor(stats["last_updated"]) == 0.0:
                continue
            if metadata_filter:
                match = all(
                    stats["metadata"].get(k) == v
                    for k, v in metadata_filter.items()
                )
                if not match:
                    continue
            result.append(provider)
        return result

    def rank(self, domain: str, providers: list[str]) -> list[str]:
        if domain not in self.domain_stats:
            return providers

        def provider_score(provider: str) -> tuple[float, float, float, float]:
            if provider not in self.domain_stats[domain]:
                return (0.5, 0.0, 0.0, 0.0)
            s = self.domain_stats[domain][provider]
            decay = self.decay_factor(s["last_updated"])
            total = s["success"] + s["failure"]
            success_rate = (s["success"] / total) if total else 0.5
            return (success_rate, s["avg_quality"], -s["avg_latency_ms"], decay)

        return sorted(providers, key=provider_score, reverse=True)

    def get_p75_latency(self, domain: str, provider: str, default: int = 2500) -> int:
        stats = self.domain_stats.get(domain, {}).get(provider)
        if not stats or stats["avg_latency_ms"] == 0:
            return default
        decay = self.decay_factor(stats["last_updated"])
        if decay == 0.0:
            return default
        return int(stats["avg_latency_ms"] * 1.5)
