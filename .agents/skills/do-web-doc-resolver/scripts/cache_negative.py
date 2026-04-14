"""
Negative caching logic for the Web Doc Resolver.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any


@dataclass
class NegativeCacheEntry:
    key: str
    provider: str
    reason: str
    expires_at: datetime
    metadata: dict[str, Any]


def should_skip_from_negative_cache(cache, key: str, provider: str) -> bool:
    if cache is None:
        return False
    # Check if the cache has a get method (diskcache.Cache does)
    if not hasattr(cache, "get"):
        return False
    entry_dict = cache.get(f"neg:{provider}:{key}")
    if not entry_dict:
        return False
    expires_at = entry_dict.get("expires_at")
    if not expires_at:
        return False
    # diskcache can return strings or dicts depending on serialization
    try:
        dt = datetime.fromisoformat(expires_at)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt > datetime.now(timezone.utc)
    except Exception:
        return False


def write_negative_cache(
    cache, key: str, provider: str, reason: str, ttl_seconds: int, **metadata
) -> None:
    if cache is None:
        return
    if not hasattr(cache, "set"):
        return
    now = datetime.now(timezone.utc)
    entry = {
        "key": key,
        "provider": provider,
        "reason": reason,
        "expires_at": (now + timedelta(seconds=ttl_seconds)).isoformat(),
        "metadata": metadata,
    }
    cache.set(f"neg:{provider}:{key}", entry, expire=ttl_seconds)
