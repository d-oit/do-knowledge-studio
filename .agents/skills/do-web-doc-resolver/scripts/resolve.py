#!/usr/bin/env python3
"""
Web Doc Resolver - Resolve queries or URLs into compact, LLM-ready markdown.
Main orchestrator and CLI.
"""

import argparse
import concurrent.futures
import json
import logging
import os
import time
import uuid
from collections.abc import Callable, Generator
from typing import Any

from . import (
    cache_negative,
    circuit_breaker,
    quality,
    routing,
    routing_memory,
    synthesis,
)
from .models import (
    ErrorType,
    Profile,
    ProviderResult,
    ProviderType,
    ResolutionTrace,
    ResolvedResult,
    ResolveMetrics,
    TraceStep,
    ValidationResult,
)
from .providers_impl import (
    _is_rate_limited,
    _rate_limits,
    _set_rate_limit,
    resolve_with_docling,
    resolve_with_duckduckgo,
    resolve_with_exa,
    resolve_with_exa_mcp,
    resolve_with_firecrawl,
    resolve_with_jina,
    resolve_with_mistral_browser,
    resolve_with_mistral_websearch,
    resolve_with_ocr,
    resolve_with_tavily,
)
from .utils import (
    _cache_key,
    _detect_error_type,
    _get_cache,
    _get_from_cache,
    _save_to_cache,
    compact_content,
    fetch_llms_txt,
    fetch_url_content,
    get_cache,
    get_session,
    is_url,
    validate_links,
    validate_url,
)

# Configuration Constants
MAX_CHARS = int(os.getenv("WEB_RESOLVER_MAX_CHARS", "8000"))
MIN_CHARS = int(os.getenv("WEB_RESOLVER_MIN_CHARS", "200"))
DEFAULT_TIMEOUT = int(os.getenv("WEB_RESOLVER_TIMEOUT", "30"))

logger = logging.getLogger(__name__)

# Global State
_circuit_breakers = circuit_breaker.CircuitBreakerRegistry()
_routing_memory = routing_memory.RoutingMemory()
_cache = None

# Aliases for backward compatibility in tests
is_rate_limited = _is_rate_limited
set_rate_limit = _set_rate_limit

# Provider cascade for search queries: name → (type, (query, max_chars) callable).
_QUERY_CASCADE: dict[str, tuple[ProviderType, Callable[[str, int], Any]]] = {
    "exa_mcp": (ProviderType.EXA_MCP, resolve_with_exa_mcp),
    "exa": (ProviderType.EXA, resolve_with_exa),
    "tavily": (ProviderType.TAVILY, resolve_with_tavily),
    "duckduckgo": (ProviderType.DUCKDUCKGO, resolve_with_duckduckgo),
    "mistral_websearch": (ProviderType.MISTRAL_WEBSEARCH, resolve_with_mistral_websearch),
}

__all__ = [
    "resolve",
    "resolve_url",
    "resolve_query",
    "resolve_direct",
    "resolve_with_order",
    "resolve_url_with_order",
    "resolve_query_with_order",
    "ResolvedResult",
    "ValidationResult",
    "ErrorType",
    "ProviderType",
    "is_url",
    "validate_url",
    "validate_links",
    "fetch_url_content",
    "fetch_llms_txt",
    "MAX_CHARS",
    "MIN_CHARS",
    "DEFAULT_TIMEOUT",
    "_detect_error_type",
    "_is_rate_limited",
    "_set_rate_limit",
    "get_session",
    "_get_from_cache",
    "_save_to_cache",
    "_cache_key",
    "_get_cache",
    "get_cache",
    "_rate_limits",
    "_cache",
]


def synthesize_results(query: str, results: list[ResolvedResult], api_key: str, model: str) -> str:
    """Synthesize resolved results into a single cited markdown answer.

    Uses LLM synthesis when the results are rich enough; otherwise falls
    back to a deterministic merge.

    Args:
        query: The original search query.
        results: Resolved results to synthesize.
        api_key: Mistral API key for LLM synthesis.
        model: Model name to use for synthesis.

    Returns:
        The synthesized markdown answer.
    """
    if not results:
        return "No results to synthesize."
    if not synthesis.should_call_llm_synthesis(results):
        return synthesis.deterministic_merge(results)
    context = "".join(
        [
            f"\nResult {i+1}:\nURL: {res.url or 'unk'}\nContent: {res.content}\n---\n"
            for i, res in enumerate(results)
        ]
    )
    prompt = (
        f"Synthesize for query: '{query}'. Provide markdown with citations.\n\nContext:\n{context}"
    )
    try:
        import requests

        resp = requests.post(
            "https://api.mistral.ai/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": "Assistant"},
                    {"role": "user", "content": prompt},
                ],
            },
            timeout=30,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        return str(content)
    except Exception as e:
        logger.error(f"LLM Synthesis failed: {e}")
        return synthesis.deterministic_merge(results)


def resolve_url(
    url: str, max_chars: int = MAX_CHARS, profile: Profile = Profile.BALANCED
) -> dict[str, Any]:
    """Resolve a URL to a single result dict (first non-partial output).

    Args:
        url: The URL to resolve.
        max_chars: Maximum content length to retain.
        profile: Resolution profile controlling the budget.

    Returns:
        The first non-partial result dict, or a "none" failure dict.
    """
    for result in resolve_url_stream(url, max_chars, profile):
        if result.get("source") != "partial":
            return result
    return {"source": "none", "url": url, "content": "Failed"}


_SPECIAL_DOCUMENT_PROVIDERS: tuple[tuple[tuple[str, ...], str], ...] = (
    ((".pdf", ".docx", ".pptx"), "docling"),
    ((".png", ".jpg", ".jpeg"), "ocr"),
)


def _special_document_provider(name: str) -> Callable[[str, int], ProviderResult]:
    """Resolve a special-document provider function by tool name.

    The lookup happens at call time so module-attribute patching in tests
    (e.g. ``@patch("scripts.resolve.resolve_with_docling")``) keeps working.

    Args:
        name: Tool name (``docling`` or ``ocr``).

    Returns:
        The provider function for the tool name (ocr as fallback).
    """
    if name == "docling":
        return resolve_with_docling
    return resolve_with_ocr


def _resolve_special_document(
    url: str,
    max_chars: int,
    start_time: float,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
) -> dict[str, Any] | None:
    """Resolve document/image URLs via docling or OCR, returning a result dict or None.

    Falls through to the regular provider cascade when no special provider
    matches the URL extension or the provider reports a failure.

    Args:
        url: The URL being resolved.
        max_chars: Maximum content length to retain.
        start_time: Epoch seconds when the resolution started (for traces).
        metrics: Metrics accumulator for the resolution.
        trace: Optional trace to populate on success.

    Returns:
        A result dict to yield, or None to continue with the cascade.
    """
    lower_url = url.lower()
    for extensions, tool in _SPECIAL_DOCUMENT_PROVIDERS:
        if not any(lower_url.endswith(ext) for ext in extensions):
            continue
        res = _special_document_provider(tool)(url, max_chars)
        if not res.ok:
            return None
        result = ResolvedResult(source=res.source, content=res.content or "", url=res.url)
        result.meta = res.meta
        result.metrics = metrics
        result_dict = result.to_dict()
        if trace:
            step = TraceStep(
                tool=tool,
                duration_ms=int((time.time() - start_time) * 1000),
                success=True,
                quality_score=res.meta.quality_score if res.meta else 0.0,
                content_length=len(res.content or ""),
            )
            trace.steps.append(step)
            trace.total_latency_ms = int((time.time() - start_time) * 1000)
            trace.final_source = tool
            trace.final_score = res.meta.quality_score if res.meta else 0.0
            trace.success = True
            result_dict["trace"] = trace.to_dict()
        return result_dict
    return None


def _record_probe_rejection(
    p_name_done: str,
    pt_done: ProviderType,
    latency: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    error: str | None = None,
) -> None:
    """Record a failed probe across the circuit breaker, metrics, and trace.

    Args:
        p_name_done: Provider name that failed.
        pt_done: Provider type that failed.
        latency: Probe latency in milliseconds.
        metrics: Metrics accumulator.
        trace: Optional trace to append a failure step to.
        error: Optional error message recorded in the trace.
    """
    _circuit_breakers.record_failure(p_name_done)
    metrics.record_provider(pt_done, latency, False)
    if error and trace:
        step = TraceStep(tool=p_name_done, duration_ms=latency, success=False, error=error)
        trace.steps.append(step)


def _record_probe_success(
    p_name_done: str,
    pt_done: ProviderType,
    latency: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
    domain: str,
    q_score: Any,
) -> None:
    """Record a successful probe across the circuit breaker, metrics, memory, and trace.

    Args:
        p_name_done: Provider name that succeeded.
        pt_done: Provider type that succeeded.
        latency: Probe latency in milliseconds.
        metrics: Metrics accumulator.
        trace: Optional trace to mark successful.
        start_time: Epoch seconds when the resolution started.
        domain: Extracted domain used for routing-memory keys.
        q_score: Quality score of the accepted content.
    """
    _circuit_breakers.record_success(p_name_done)
    metrics.record_provider(pt_done, latency, True)
    if domain:
        _routing_memory.record(domain, p_name_done, True, latency, q_score.score)
    if trace:
        trace.total_latency_ms = int((time.time() - start_time) * 1000)
        trace.final_source = p_name_done
        trace.final_score = q_score.score
        trace.success = True


def _build_probe_output(
    res_or_content: Any,
    p_name_done: str,
    pt_done: ProviderType,
    latency: int,
    url: str,
    max_chars: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
    domain: str,
) -> tuple[dict[str, Any] | None, bool]:
    """Build the output dict for a completed provider result, or None if unusable.

    Returns ``(output_dict, accepted)``; ``accepted`` tells the caller to stop
    processing further futures in the current completion batch.

    Args:
        res_or_content: The provider's result object or raw content.
        p_name_done: Provider name that completed.
        pt_done: Provider type that completed.
        latency: Probe latency in milliseconds.
        url: The URL being resolved.
        max_chars: Maximum content length to retain.
        metrics: Metrics accumulator.
        trace: Optional trace to update on success.
        start_time: Epoch seconds when the resolution started.
        domain: Extracted domain used for routing-memory keys.

    Returns:
        (output dict to yield, accepted flag); accepted means the caller
        should stop processing the current completion batch.
    """
    if not res_or_content:
        _record_probe_rejection(p_name_done, pt_done, latency, metrics, trace)
        return None, False
    if isinstance(res_or_content, ProviderResult):
        if not res_or_content.ok:
            _record_probe_rejection(
                p_name_done, pt_done, latency, metrics, trace, res_or_content.error
            )
            return None, False
        content = res_or_content.content or ""
    elif isinstance(res_or_content, ResolvedResult):
        content = res_or_content.content
    else:
        content = str(res_or_content)

    q_score = quality.score_content(content)
    if not (q_score.acceptable or pt_done == ProviderType.LLMS_TXT):
        cache_negative.write_negative_cache(_get_cache(), url, p_name_done, "thin_content", 1800)
        if domain:
            _routing_memory.record(domain, p_name_done, False, latency, q_score.score)
        return None, False

    _record_probe_success(
        p_name_done, pt_done, latency, metrics, trace, start_time, domain, q_score
    )
    out = _build_success_output(
        res_or_content, p_name_done, pt_done, url, content, max_chars, metrics, trace, q_score
    )
    return out, True


def _build_success_output(
    res_or_content: Any,
    p_name_done: str,
    pt_done: ProviderType,
    url: str,
    content: str,
    max_chars: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    q_score: quality.QualityScore,
) -> dict[str, Any]:
    """Build the yielded result dict for an accepted probe result.

    llms.txt probes yield a compacted text dict; ResolvedResult objects yield
    their serialized form; anything else (plain strings, ProviderResult)
    yields a generic result dict keyed by the provider name. Previously the
    generic case returned ``(None, True)`` — the probe was recorded as a
    success but the result was dropped, failing the resolution.

    Args:
        res_or_content: The provider result object or raw content.
        p_name_done: Provider name that completed.
        pt_done: Provider type that completed.
        url: The URL being resolved.
        content: Normalized probe content.
        max_chars: Maximum content length to retain.
        metrics: Metrics accumulator.
        trace: Optional trace to attach.
        q_score: Quality score of the content.

    Returns:
        The result dict to yield.
    """
    if pt_done == ProviderType.LLMS_TXT:
        out: dict[str, Any] = {
            "source": "llms.txt",
            "url": url,
            "content": compact_content(content, max_chars),
            "metrics": metrics,
        }
    elif isinstance(res_or_content, ResolvedResult):
        res_or_content.metrics, res_or_content.score = metrics, q_score.score
        out = res_or_content.to_dict()
    else:
        out = {
            "source": p_name_done,
            "url": url,
            "content": compact_content(content, max_chars),
            "metrics": metrics,
        }
    if trace:
        out["trace"] = trace.to_dict()
    return out


def _process_probe_result(
    future: concurrent.futures.Future[Any],
    active_futures: dict[concurrent.futures.Future[Any], tuple[str, ProviderType, float]],
    budget: routing.ResolutionBudget,
    url: str,
    max_chars: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
    domain: str,
) -> tuple[dict[str, Any] | None, bool]:
    """Process a single completed provider probe, recording budget and metrics.

    Args:
        future: The completed provider future.
        active_futures: Map of in-flight futures to probe metadata.
        budget: Resolution budget tracker.
        url: The URL being resolved.
        max_chars: Maximum content length to retain.
        metrics: Metrics accumulator.
        trace: Optional trace to update.
        start_time: Epoch seconds when the resolution started.
        domain: Extracted domain used for routing-memory keys.

    Returns:
        (output dict to yield, accepted flag); accepted means the caller
        should stop processing the current completion batch.
    """
    p_name_done, pt_done, s_time = active_futures.pop(future)
    latency = int((time.time() - s_time) * 1000)
    budget.record_attempt(is_paid=pt_done.is_paid(), latency_ms=latency)
    try:
        res_or_content = future.result()
    except Exception as e:
        err_type = _detect_error_type(e)
        if err_type not in (ErrorType.AUTH_ERROR, ErrorType.SSRF_BLOCKED):
            _circuit_breakers.record_failure(p_name_done)
        if trace:
            step = TraceStep(tool=p_name_done, duration_ms=latency, success=False, error=str(e))
            trace.steps.append(step)
        metrics.record_provider(pt_done, latency, False)
        return None, False
    return _build_probe_output(
        res_or_content,
        p_name_done,
        pt_done,
        latency,
        url,
        max_chars,
        metrics,
        trace,
        start_time,
        domain,
    )


def _launch_url_probe(
    p_name: str,
    pt: ProviderType,
    func: Callable[[], Any],
    budget: routing.ResolutionBudget,
    cache: Any,
    url: str,
    executor: concurrent.futures.ThreadPoolExecutor,
) -> tuple[concurrent.futures.Future[Any] | None, bool]:
    """Submit a provider probe when budget/cache/circuit state allow.

    Returns ``(future, stop)``: ``future`` is None when the probe was skipped
    and the cascade should continue with the next provider; ``stop`` signals
    that the whole cascade should halt.

    Args:
        p_name: Provider name to probe.
        pt: Provider type to probe.
        func: Zero-argument callable that performs the probe.
        budget: Resolution budget tracker.
        cache: Cache handle for negative-cache lookups.
        url: The URL being resolved.
        executor: Thread pool used to launch the probe.

    Returns:
        (future or None, stop flag) as described above.
    """
    if not budget.can_try(is_paid=pt.is_paid()):
        return None, budget.stop_reason not in ("paid_disabled", "max_paid_attempts")
    if cache_negative.should_skip_from_negative_cache(cache, url, p_name):
        return None, False
    if _circuit_breakers.is_open(p_name):
        return None, False
    return executor.submit(func), False


def _drain_completed_probes(
    active_futures: dict[concurrent.futures.Future[Any], tuple[str, ProviderType, float]],
    i: int,
    eligible: list[str],
    p_name: str,
    threshold: float,
    start_time_probe: float,
    budget: routing.ResolutionBudget,
    url: str,
    max_chars: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
    domain: str,
) -> dict[str, Any] | None:
    """Process completed probe futures until the batch yields an acceptable result.

    Returns the output dict to yield, or None when the batch is exhausted
    (the caller then proceeds to the next eligible provider). Hedging breaks
    out of the wait loop so the next provider can be launched early.

    Args:
        active_futures: Map of in-flight futures to probe metadata.
        i: Index of the current provider in the eligible list.
        eligible: List of eligible provider names.
        p_name: Current provider name (for hedge logging).
        threshold: Hedging latency threshold in seconds.
        start_time_probe: Epoch seconds when this probe was launched.
        budget: Resolution budget tracker.
        url: The URL being resolved.
        max_chars: Maximum content length to retain.
        metrics: Metrics accumulator.
        trace: Optional trace to update.
        start_time: Epoch seconds when the resolution started.
        domain: Extracted domain used for routing-memory keys.

    Returns:
        The output dict to yield, or None when the batch is exhausted.
    """
    while active_futures:
        elapsed = time.time() - start_time_probe
        if i < len(eligible) - 1 and elapsed >= threshold:
            logger.info("Hedging threshold reached for %s (%ss)", p_name, threshold)
            break
        done, _ = concurrent.futures.wait(
            active_futures.keys(),
            timeout=0.01,
            return_when=concurrent.futures.FIRST_COMPLETED,
        )
        for f in list(done):
            if f not in active_futures:
                continue
            out, accepted = _process_probe_result(
                f,
                active_futures,
                budget,
                url,
                max_chars,
                metrics,
                trace,
                start_time,
                domain,
            )
            if accepted:
                return out
        if done:
            break
        if not active_futures:
            break
    return None


def _url_cascade(url: str, max_chars: int) -> dict[str, tuple[ProviderType, Callable[[], Any]]]:
    """Build the URL provider cascade: provider name → (type, zero-arg launcher).

    Args:
        url: The URL being resolved.
        max_chars: Maximum content length to retain.

    Returns:
        Mapping of provider name to (ProviderType, probe callable).
    """
    return {
        "llms_txt": (ProviderType.LLMS_TXT, lambda: fetch_llms_txt(url)),
        "jina": (ProviderType.JINA, lambda: resolve_with_jina(url, max_chars)),
        "firecrawl": (ProviderType.FIRECRAWL, lambda: resolve_with_firecrawl(url, max_chars)),
        "direct_fetch": (
            ProviderType.DIRECT_FETCH,
            lambda: fetch_url_content(url, max_chars=max_chars),
        ),
        "mistral_browser": (
            ProviderType.MISTRAL_BROWSER,
            lambda: resolve_with_mistral_browser(url, max_chars),
        ),
        "duckduckgo": (ProviderType.DUCKDUCKGO, lambda: resolve_with_duckduckgo(url, max_chars)),
    }


def _probe_round(
    i: int,
    p_name: str,
    pt: ProviderType,
    func: Callable[[], Any],
    eligible: list[str],
    budget: routing.ResolutionBudget,
    cache: Any,
    url: str,
    executor: concurrent.futures.ThreadPoolExecutor,
    active_futures: dict[concurrent.futures.Future[Any], tuple[str, ProviderType, float]],
    domain: str,
    max_chars: int,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
) -> tuple[bool, dict[str, Any] | None]:
    """Launch one URL probe and drain completed futures.

    Returns ``(stop, output)``: ``stop`` halts the cascade, ``output`` is the
    result to yield (or None when nothing completed acceptably yet).

    Args:
        i: Index of the current provider in the eligible list.
        p_name: Provider name to probe.
        pt: Provider type to probe.
        func: Zero-argument probe callable.
        eligible: Ordered provider list for the cascade.
        budget: Resolution budget tracker.
        cache: Cache handle for negative-cache lookups.
        url: The URL being resolved.
        executor: Thread pool used to launch probes.
        active_futures: Map of in-flight futures to probe metadata.
        domain: Extracted domain used for routing-memory keys.
        max_chars: Maximum content length to retain.
        metrics: Metrics accumulator.
        trace: Optional trace to populate.
        start_time: Epoch seconds when the resolution started.

    Returns:
        (stop flag, output dict or None).
    """
    future, stop = _launch_url_probe(p_name, pt, func, budget, cache, url, executor)
    if stop:
        return True, None
    if future is None:
        return False, None
    logger.info("Starting probe: %s", p_name)
    start_time_probe = time.time()
    active_futures[future] = (p_name, pt, start_time_probe)
    threshold = _routing_memory.get_p75_latency(domain or "any", p_name) / 1000.0
    out = _drain_completed_probes(
        active_futures,
        i,
        eligible,
        p_name,
        threshold,
        start_time_probe,
        budget,
        url,
        max_chars,
        metrics,
        trace,
        start_time,
        domain,
    )
    return False, out


def resolve_url_stream(
    url: str, max_chars: int = MAX_CHARS, profile: Profile = Profile.BALANCED,
    trace: ResolutionTrace | None = None,
) -> Generator[dict[str, Any], None, None]:
    """Resolve a URL through the provider cascade, yielding results as found.

    Special document/image URLs are handled first (docling/OCR), then the
    eligible web providers are probed with hedging until an acceptable result
    is produced or the budget is exhausted.

    Args:
        url: The URL to resolve.
        max_chars: Maximum content length to retain.
        profile: Resolution profile controlling the budget.
        trace: Optional trace to populate during resolution.

    Yields:
        Result dicts; the final dict reports "none" when nothing succeeded.
    """
    logger.info("Resolving URL: %s", url)
    metrics = ResolveMetrics()
    budget_data = routing.PROFILE_BUDGETS.get(profile.value, routing.PROFILE_BUDGETS["balanced"])
    budget = routing.ResolutionBudget(
        max_provider_attempts=budget_data["max_provider_attempts"],
        max_paid_attempts=budget_data["max_paid_attempts"],
        max_total_latency_ms=budget_data["max_total_latency_ms"],
        allow_paid=bool(budget_data["allow_paid"]),
    )
    start_time = time.time()

    special = _resolve_special_document(url, max_chars, start_time, metrics, trace)
    if special is not None:
        yield special
        return

    provider_names = routing.plan_provider_order(
        target=url, is_url=True, routing_memory=_routing_memory
    )
    cascade_map = _url_cascade(url, max_chars)

    cache = _get_cache()
    domain = routing.extract_domain(url)
    eligible = [p for p in provider_names if p in cascade_map]
    active_futures = {}

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    try:
        for i, p_name in enumerate(eligible):
            pt, func = cascade_map[p_name]
            stop, out = _probe_round(
                i, p_name, pt, func, eligible, budget, cache, url, executor,
                active_futures, domain, max_chars, metrics, trace, start_time,
            )
            if stop:
                break
            if out is not None:
                yield out
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    if trace:
        trace.total_latency_ms = int((time.time() - start_time) * 1000)
        trace.final_source = "none"
        trace.success = False

    yield {
        "source": "none",
        "url": url,
        "content": "Failed",
        "error": f"No resolution method available. Stop reason: {budget.stop_reason}",
        **({"trace": trace.to_dict()} if trace else {}),
    }


def resolve_query(
    query: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
) -> dict[str, Any]:
    """Resolve a search query to a single result dict (first non-partial output).

    Args:
        query: The search query.
        max_chars: Maximum content length to retain.
        skip_providers: Optional set of provider names to skip.
        profile: Resolution profile controlling the budget.

    Returns:
        The first non-partial result dict, or a "none" failure dict.
    """
    for result in resolve_query_stream(query, max_chars, skip_providers, profile):
        if result.get("source") != "partial":
            return result
    return {"source": "none", "query": query, "content": "Failed"}


def _build_query_output(
    res: Any,
    p_name_done: str,
    metrics: ResolveMetrics,
    q_score: quality.QualityScore,
    trace: ResolutionTrace | None,
    start_time: float,
) -> dict[str, Any]:
    """Build the yielded dict for an accepted query result.

    ProviderResult objects are normalized into ResolvedResult so consumers get
    a uniform ``source``/``url``/``query`` shape; ResolvedResult passes through.

    Args:
        res: The provider result (ProviderResult or ResolvedResult).
        p_name_done: Provider name that completed.
        metrics: Metrics accumulator.
        q_score: Quality score of the content.
        trace: Optional trace to attach.
        start_time: Epoch seconds when the resolution started.

    Returns:
        The serialized result dict.
    """
    if isinstance(res, ProviderResult):
        result = ResolvedResult(
            source=res.source,
            content=res.content or "",
            url=res.url,
            query=res.query,
        )
        result.meta = res.meta
        result.metrics, result.score = metrics, q_score.score
        out = result.to_dict()
    else:
        res.metrics, res.score = metrics, q_score.score
        out = res.to_dict()
    if trace:
        trace.total_latency_ms = int((time.time() - start_time) * 1000)
        trace.final_source = p_name_done
        trace.final_score = q_score.score
        trace.success = True
        out["trace"] = trace.to_dict()
    return out


def _process_query_result(
    future: concurrent.futures.Future[Any],
    active_futures: dict[concurrent.futures.Future[Any], tuple[str, ProviderType, float]],
    budget: routing.ResolutionBudget,
    query: str,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
) -> tuple[dict[str, Any] | None, bool]:
    """Process one completed query probe.

    Records budget/circuit/metrics outcomes, gates on content quality, and
    returns ``(output, acceptable)``; ``acceptable`` tells the caller to stop.

    Args:
        future: The completed provider future.
        active_futures: Map of in-flight futures to probe metadata.
        budget: Resolution budget tracker.
        query: The search query being resolved.
        metrics: Metrics accumulator.
        trace: Optional trace to populate.
        start_time: Epoch seconds when the resolution started.

    Returns:
        (output dict to yield, acceptable flag).
    """
    p_name_done, pt_done, s_time = active_futures.pop(future)
    latency = int((time.time() - s_time) * 1000)
    budget.record_attempt(is_paid=pt_done.is_paid(), latency_ms=latency)
    try:
        res = future.result()
    except Exception as e:
        err_type = _detect_error_type(e)
        if err_type not in (ErrorType.AUTH_ERROR, ErrorType.SSRF_BLOCKED):
            _circuit_breakers.record_failure(p_name_done)
        if trace:
            step = TraceStep(
                tool=p_name_done, duration_ms=latency, success=False, error=str(e)
            )
            trace.steps.append(step)
        metrics.record_provider(pt_done, latency, False)
        return None, False
    if not res:
        _circuit_breakers.record_failure(p_name_done)
        metrics.record_provider(pt_done, latency, False)
        return None, False
    if isinstance(res, ProviderResult):
        if not res.ok:
            _circuit_breakers.record_failure(p_name_done)
            if trace:
                step = TraceStep(
                    tool=p_name_done, duration_ms=latency, success=False, error=res.error
                )
                trace.steps.append(step)
            metrics.record_provider(pt_done, latency, False)
            return None, False
        content = res.content or ""
    else:
        content = res.content
    q_score = quality.score_content(content)
    if not q_score.acceptable:
        cache_negative.write_negative_cache(_get_cache(), query, p_name_done, "thin_content", 1800)
        _routing_memory.record("query", p_name_done, False, latency, q_score.score)
        return None, False
    _circuit_breakers.record_success(p_name_done)
    metrics.record_provider(pt_done, latency, True)
    _routing_memory.record("query", p_name_done, True, latency, q_score.score)
    out = _build_query_output(res, p_name_done, metrics, q_score, trace, start_time)
    return out, True


def _drain_query_probes(
    active_futures: dict[concurrent.futures.Future[Any], tuple[str, ProviderType, float]],
    i: int,
    eligible: list[str],
    threshold: float,
    start_time_probe: float,
    budget: routing.ResolutionBudget,
    query: str,
    metrics: ResolveMetrics,
    trace: ResolutionTrace | None,
    start_time: float,
) -> dict[str, Any] | None:
    """Wait for query probe completions until an acceptable result appears.

    Returns the output dict to yield, or None when the batch is exhausted
    without an acceptable result.

    Args:
        active_futures: Map of in-flight futures to probe metadata.
        i: Index of the current provider in the eligible list.
        eligible: Ordered provider list for the cascade.
        threshold: Hedging threshold in seconds.
        start_time_probe: Epoch seconds when the current probe launched.
        budget: Resolution budget tracker.
        query: The search query being resolved.
        metrics: Metrics accumulator.
        trace: Optional trace to populate.
        start_time: Epoch seconds when the resolution started.

    Returns:
        The result dict to yield, or None.
    """
    while active_futures:
        elapsed = time.time() - start_time_probe
        if i < len(eligible) - 1 and elapsed >= threshold:
            break

        done, _ = concurrent.futures.wait(
            active_futures.keys(),
            timeout=0.01,
            return_when=concurrent.futures.FIRST_COMPLETED,
        )
        for f in list(done):
            if f not in active_futures:
                continue
            out, acceptable = _process_query_result(
                f, active_futures, budget, query, metrics, trace, start_time
            )
            if acceptable:
                return out
        if done:
            break
        if not active_futures:
            break
    return None


def _launch_query_probe(
    p_name: str,
    pt: ProviderType,
    func: Callable[[str, int], Any],
    budget: routing.ResolutionBudget,
    cache: Any,
    query: str,
    max_chars: int,
    executor: concurrent.futures.ThreadPoolExecutor,
) -> tuple[concurrent.futures.Future[Any] | None, bool]:
    """Submit a query probe when budget/cache/circuit state allow.

    Returns ``(future, stop)``: ``future`` is None when the probe was skipped
    and the cascade should continue with the next provider; ``stop`` signals
    that the whole cascade should halt.

    Args:
        p_name: Provider name to probe.
        pt: Provider type to probe.
        func: (query, max_chars) callable that performs the probe.
        budget: Resolution budget tracker.
        cache: Cache handle for negative-cache lookups.
        query: The search query being resolved.
        max_chars: Maximum content length to retain.
        executor: Thread pool used to launch the probe.

    Returns:
        (future or None, stop flag) as described above.
    """
    if not budget.can_try(is_paid=pt.is_paid()):
        return None, budget.stop_reason not in ("paid_disabled", "max_paid_attempts")
    if cache_negative.should_skip_from_negative_cache(cache, query, p_name):
        return None, False
    if _circuit_breakers.is_open(p_name):
        return None, False
    return executor.submit(func, query, max_chars), False


def resolve_query_stream(
    query: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
    trace: ResolutionTrace | None = None,
) -> Generator[dict[str, Any], None, None]:
    """Resolve a search query through the provider cascade, yielding results as found.

    Args:
        query: The search query.
        max_chars: Maximum content length to retain.
        skip_providers: Optional set of provider names to skip.
        profile: Resolution profile controlling the budget.
        trace: Optional trace to populate during resolution.

    Yields:
        Result dicts; the final dict reports "none" when nothing succeeded.
    """
    skip = skip_providers or set()
    metrics = ResolveMetrics()
    budget_data = routing.PROFILE_BUDGETS.get(profile.value, routing.PROFILE_BUDGETS["balanced"])
    budget = routing.ResolutionBudget(
        max_provider_attempts=budget_data["max_provider_attempts"],
        max_paid_attempts=budget_data["max_paid_attempts"],
        max_total_latency_ms=budget_data["max_total_latency_ms"],
        allow_paid=bool(budget_data["allow_paid"]),
    )
    start_time = time.time()
    provider_names = routing.plan_provider_order(
        target=query, is_url=False, skip_providers=skip, routing_memory=_routing_memory
    )
    cache = _get_cache()
    eligible = [p for p in provider_names if p in _QUERY_CASCADE]
    active_futures = {}
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    try:
        for i, p_name in enumerate(eligible):
            pt, func = _QUERY_CASCADE[p_name]
            future, stop = _launch_query_probe(
                p_name, pt, func, budget, cache, query, max_chars, executor
            )
            if stop:
                break
            if future is None:
                continue
            logger.info("Starting probe: %s", p_name)
            start_time_probe = time.time()
            active_futures[future] = (p_name, pt, start_time_probe)
            threshold = _routing_memory.get_p75_latency("query", p_name) / 1000.0
            out = _drain_query_probes(
                active_futures,
                i,
                eligible,
                threshold,
                start_time_probe,
                budget,
                query,
                metrics,
                trace,
                start_time,
            )
            if out is not None:
                yield out
                return
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    if trace:
        trace.total_latency_ms = int((time.time() - start_time) * 1000)
        trace.final_source = "none"
        trace.success = False

    yield {
        "source": "none",
        "query": query,
        "content": "Failed",
        "error": f"No resolution method available. Stop reason: {budget.stop_reason}",
        **({"trace": trace.to_dict()} if trace else {}),
    }


def resolve(
    input_str: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
) -> dict[str, Any]:
    """Resolve either a URL or a query based on the input shape.

    Args:
        input_str: A URL or a search query.
        max_chars: Maximum content length to retain.
        skip_providers: Optional set of provider names to skip.
        profile: Resolution profile controlling the budget.

    Returns:
        The resolution result dict.
    """
    if is_url(input_str):
        return resolve_url(input_str, max_chars, profile=profile)
    return resolve_query(input_str, max_chars, skip_providers, profile=profile)


def resolve_direct(
    input_str: str, provider: ProviderType, max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    """Resolve input with a single named provider, bypassing the cascade.

    Args:
        input_str: A URL or a search query.
        provider: The provider to use.
        max_chars: Maximum content length to retain.

    Returns:
        The resolution result dict.
    """
    funcs = {
        ProviderType.JINA: resolve_with_jina,
        ProviderType.EXA_MCP: resolve_with_exa_mcp,
        ProviderType.EXA: resolve_with_exa,
        ProviderType.TAVILY: resolve_with_tavily,
        ProviderType.DUCKDUCKGO: resolve_with_duckduckgo,
        ProviderType.FIRECRAWL: resolve_with_firecrawl,
        ProviderType.MISTRAL_BROWSER: resolve_with_mistral_browser,
        ProviderType.MISTRAL_WEBSEARCH: resolve_with_mistral_websearch,
    }
    if provider in funcs:
        res = funcs[provider](input_str, max_chars)
        if isinstance(res, ProviderResult):
            if res.ok:
                result = ResolvedResult(
                    source=res.source,
                    content=res.content or "",
                    url=res.url,
                    query=res.query,
                )
                result.meta = res.meta
                return result.to_dict()
            return {"source": "none", "error": res.error or "Provider failed"}
        return res.to_dict() if res else {"source": "none", "error": "Provider failed"}
    return {"source": "none", "error": "Unknown provider"}


def resolve_with_order(
    input_str: str, providers_order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    """Resolve input trying providers sequentially until one succeeds.

    Args:
        input_str: A URL or a search query.
        providers_order: Providers to try in order.
        max_chars: Maximum content length to retain.

    Returns:
        The first successful result dict, or a "none" failure dict.
    """
    for pt in providers_order:
        res = resolve_direct(input_str, pt, max_chars)
        if res.get("source") != "none":
            return res
    return {"source": "none", "error": "All providers failed"}


def resolve_url_with_order(
    url: str, order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    """Resolve a URL with an explicit provider order.

    Args:
        url: The URL to resolve.
        order: Providers to try in order.
        max_chars: Maximum content length to retain.

    Returns:
        The first successful result dict, or a "none" failure dict.
    """
    return resolve_with_order(url, order, max_chars)


def resolve_query_with_order(
    query: str, order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    """Resolve a query with an explicit provider order.

    Args:
        query: The search query.
        order: Providers to try in order.
        max_chars: Maximum content length to retain.

    Returns:
        The first successful result dict, or a "none" failure dict.
    """
    return resolve_with_order(query, order, max_chars)


def _build_cli_parser() -> argparse.ArgumentParser:
    """Build the CLI argument parser.

    Returns:
        A configured ArgumentParser for the resolver CLI.
    """
    parser = argparse.ArgumentParser(description="Web Doc Resolver")
    parser.add_argument("input", nargs="?", help="URL or query")
    parser.add_argument("--max-chars", type=int, default=MAX_CHARS)
    parser.add_argument("--json", action="store_true")
    parser.add_argument(
        "--profile", type=str, choices=[p.value for p in Profile], default="balanced"
    )
    parser.add_argument("--skip", action="append")
    parser.add_argument("--provider", type=str)
    parser.add_argument("--providers-order", type=str)
    parser.add_argument("--log-level", default="INFO")
    parser.add_argument("--trace", action="store_true")
    return parser


def _run_cli_resolution(
    args: argparse.Namespace,
    profile: Profile,
    skip: set[str] | None,
    trace: ResolutionTrace | None,
) -> list[dict[str, Any]]:
    """Dispatch the CLI input to the matching resolution pipeline.

    Args:
        args: Parsed CLI arguments.
        profile: Resolution profile.
        skip: Optional set of provider names to skip.
        trace: Optional trace to populate.

    Returns:
        The list of result dicts to print.
    """
    if args.provider:
        return [resolve_direct(args.input, ProviderType(args.provider), args.max_chars)]
    if args.providers_order:
        order = [ProviderType(p.strip()) for p in args.providers_order.split(",")]
        return [resolve_with_order(args.input, order, args.max_chars)]
    if is_url(args.input):
        return list(resolve_url_stream(args.input, args.max_chars, profile, trace=trace))
    return list(resolve_query_stream(args.input, args.max_chars, skip, profile, trace=trace))


def _print_cli_results(
    results: list[dict[str, Any]], as_json: bool, show_trace: bool
) -> None:
    """Print resolution results as JSON or human-readable text.

    Args:
        results: Result dicts produced by the resolution pipeline.
        as_json: Print compact JSON when True.
        show_trace: Include the trace section when True.
    """
    final_result = None
    for res in results:
        if not as_json and res.get("source") != "partial":
            print(f"--- Source: {res.get('source')} ---")
            print(res.get("content", "")[:500] + "...")
        final_result = res
    if as_json:
        print(
            json.dumps(
                final_result,
                indent=2,
                default=lambda o: o.__dict__ if hasattr(o, "__dict__") else str(o),
            )
        )
        return
    print("\n=== FINAL RESULT ===")
    if final_result:
        print(final_result.get("content", ""))
    if show_trace and final_result and "trace" in final_result:
        print("\n=== TRACE ===")
        print(json.dumps(final_result["trace"], indent=2))


def main():
    """CLI entry point: resolve a URL or query with optional tracing."""
    parser = _build_cli_parser()
    args = parser.parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level))
    if not args.input:
        parser.error("Input required")
    profile = Profile(args.profile)
    skip = set(args.skip) if args.skip else None
    is_url_input = is_url(args.input)
    trace = None
    if args.trace:
        trace = ResolutionTrace(
            trace_id=str(uuid.uuid4()),
            input=args.input,
            is_url=is_url_input,
            profile=args.profile,
        )
    results = _run_cli_resolution(args, profile, skip, trace)
    _print_cli_results(results, args.json, args.trace)


if __name__ == "__main__":
    main()
