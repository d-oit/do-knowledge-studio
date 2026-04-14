"""
Data models and Enums for the Web Doc Resolver.
"""

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class ErrorType(Enum):
    """Types of errors that can occur during resolution."""

    RATE_LIMIT = "rate_limit"
    AUTH_ERROR = "auth_error"
    QUOTA_EXHAUSTED = "quota_exhausted"
    NETWORK_ERROR = "network_error"
    NOT_FOUND = "not_found"
    INVALID_URL = "invalid_url"
    TIMEOUT = "timeout"
    INVALID_RESPONSE = "invalid_response"
    SSRF_BLOCKED = "ssrf_blocked"
    CONTENT_TOO_LARGE = "content_too_large"
    UNKNOWN = "unknown"


class Profile(Enum):
    """Execution profiles for resource management."""

    FREE = "free"
    BALANCED = "balanced"
    FAST = "fast"
    QUALITY = "quality"

    def is_provider_allowed(self, provider: "ProviderType") -> bool:
        if self == Profile.FREE:
            return not provider.is_paid()
        if self == Profile.FAST:
            return provider.is_fast()
        return True

    def max_hops(self) -> int:
        if self == Profile.FREE:
            return 3
        if self == Profile.FAST:
            return 2
        if self == Profile.BALANCED:
            return 6
        if self == Profile.QUALITY:
            return 8


class ProviderType(Enum):
    """Available providers for resolution."""

    # URL providers
    LLMS_TXT = "llms_txt"
    JINA = "jina"
    FIRECRAWL = "firecrawl"
    DIRECT_FETCH = "direct_fetch"
    MISTRAL_BROWSER = "mistral_browser"

    # Query providers
    EXA_MCP = "exa_mcp"
    EXA = "exa"
    TAVILY = "tavily"
    SERPER = "serper"
    DUCKDUCKGO = "duckduckgo"
    MISTRAL_WEBSEARCH = "mistral_websearch"

    # New providers
    DOCLING = "docling"
    OCR = "ocr"

    def is_paid(self) -> bool:
        return self in (
            ProviderType.EXA,
            ProviderType.TAVILY,
            ProviderType.SERPER,
            ProviderType.FIRECRAWL,
            ProviderType.MISTRAL_WEBSEARCH,
            ProviderType.MISTRAL_BROWSER,
        )

    def is_fast(self) -> bool:
        return self in (
            ProviderType.EXA_MCP,
            ProviderType.DUCKDUCKGO,
            ProviderType.LLMS_TXT,
            ProviderType.JINA,
            ProviderType.DIRECT_FETCH,
        )


@dataclass
class ValidationResult:
    """Result of URL validation."""

    is_valid: bool
    status_code: int | None = None
    content_type: str | None = None
    final_url: str | None = None
    error: str | None = None
    redirect_chain: list[str] = field(default_factory=list)


@dataclass
class ProviderMetric:
    """Metrics for a single provider call."""

    provider: str
    latency_ms: int
    success: bool
    paid: bool


@dataclass
class ResolveMetrics:
    """Aggregated metrics for a resolution request."""

    total_latency_ms: int = 0
    provider_metrics: list[ProviderMetric] = field(default_factory=list)
    cascade_depth: int = 0
    paid_usage: bool = False
    cache_hit: bool = False

    def record_provider(self, provider: "ProviderType", latency_ms: int, success: bool):
        paid = provider.is_paid()
        if paid and success:
            self.paid_usage = True
        self.provider_metrics.append(
            ProviderMetric(
                provider=provider.value,
                latency_ms=latency_ms,
                success=success,
                paid=paid,
            )
        )
        self.total_latency_ms += latency_ms


@dataclass
class ProviderMeta:
    """Metadata about a single provider call."""

    tool: str
    duration_ms: int
    cache_hit: bool = False
    quality_score: float = 0.0
    error_type: str | None = None


@dataclass
class ProviderResult:
    """Structured envelope for provider results."""

    ok: bool
    content: str | None = None
    error: str | None = None
    meta: ProviderMeta | None = None
    url: str | None = None
    query: str | None = None
    source: str = "unknown"


@dataclass
class ResolvedResult:
    """Result of a successful resolution."""

    source: str
    content: str
    url: str | None = None
    query: str | None = None
    score: float = 0.0
    validated_links: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    metrics: ResolveMetrics | None = None
    meta: ProviderMeta | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class TraceStep:
    """A single step in the resolution trace."""

    tool: str
    duration_ms: int
    success: bool
    cache_hit: bool = False
    quality_score: float = 0.0
    error: str | None = None
    content_length: int = 0


@dataclass
class ResolutionTrace:
    """Full trace of a resolution request."""

    trace_id: str
    input: str
    is_url: bool
    profile: str
    steps: list[TraceStep] = field(default_factory=list)
    total_latency_ms: int = 0
    final_source: str = "none"
    final_score: float = 0.0
    success: bool = False

    def to_dict(self) -> dict:
        return {
            "trace_id": self.trace_id,
            "input": self.input,
            "is_url": self.is_url,
            "profile": self.profile,
            "steps": [s.__dict__ for s in self.steps],
            "total_latency_ms": self.total_latency_ms,
            "final_source": self.final_source,
            "final_score": self.final_score,
            "success": self.success,
        }
