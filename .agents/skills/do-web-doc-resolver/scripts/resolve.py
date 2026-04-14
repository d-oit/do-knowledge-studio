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
from collections.abc import Generator
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
    for result in resolve_url_stream(url, max_chars, profile):
        if result.get("source") != "partial":
            return result
    return {"source": "none", "url": url, "content": "Failed"}


def resolve_url_stream(
    url: str, max_chars: int = MAX_CHARS, profile: Profile = Profile.BALANCED,
    trace: ResolutionTrace | None = None,
) -> Generator[dict[str, Any], None, None]:
    logger.info(f"Resolving URL: {url}")
    metrics = ResolveMetrics()
    budget_data = routing.PROFILE_BUDGETS.get(profile.value, routing.PROFILE_BUDGETS["balanced"])
    budget = routing.ResolutionBudget(
        max_provider_attempts=budget_data["max_provider_attempts"],
        max_paid_attempts=budget_data["max_paid_attempts"],
        max_total_latency_ms=budget_data["max_total_latency_ms"],
        allow_paid=bool(budget_data["allow_paid"]),
    )
    start_time = time.time()

    if any(url.lower().endswith(ext) for ext in [".pdf", ".docx", ".pptx"]):
        res = resolve_with_docling(url, max_chars)
        if res.ok:
            result = ResolvedResult(source=res.source, content=res.content or "", url=res.url)
            result.meta = res.meta
            result.metrics = metrics
            result_dict = result.to_dict()
            if trace:
                step = TraceStep(
                    tool="docling",
                    duration_ms=int((time.time() - start_time) * 1000),
                    success=True,
                    quality_score=res.meta.quality_score if res.meta else 0.0,
                    content_length=len(res.content or ""),
                )
                trace.steps.append(step)
                trace.total_latency_ms = int((time.time() - start_time) * 1000)
                trace.final_source = "docling"
                trace.final_score = res.meta.quality_score if res.meta else 0.0
                trace.success = True
                result_dict["trace"] = trace.to_dict()
            yield result_dict
            return
    if any(url.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg"]):
        res = resolve_with_ocr(url, max_chars)
        if res.ok:
            result = ResolvedResult(source=res.source, content=res.content or "", url=res.url)
            result.meta = res.meta
            result.metrics = metrics
            result_dict = result.to_dict()
            if trace:
                step = TraceStep(
                    tool="ocr",
                    duration_ms=int((time.time() - start_time) * 1000),
                    success=True,
                    quality_score=res.meta.quality_score if res.meta else 0.0,
                    content_length=len(res.content or ""),
                )
                trace.steps.append(step)
                trace.total_latency_ms = int((time.time() - start_time) * 1000)
                trace.final_source = "ocr"
                trace.final_score = res.meta.quality_score if res.meta else 0.0
                trace.success = True
                result_dict["trace"] = trace.to_dict()
            yield result_dict
            return

    provider_names = routing.plan_provider_order(
        target=url, is_url=True, routing_memory=_routing_memory
    )
    cascade_map: dict[str, tuple[ProviderType, Any]] = {
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

    cache = _get_cache()
    domain = routing.extract_domain(url)
    eligible = [p for p in provider_names if p in cascade_map]
    active_futures = {}

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    try:
        for i, p_name in enumerate(eligible):
            pt, func = cascade_map[p_name]
            if not budget.can_try(is_paid=pt.is_paid()):
                if budget.stop_reason in ("paid_disabled", "max_paid_attempts"):
                    continue
                break
            if cache_negative.should_skip_from_negative_cache(cache, url, p_name):
                continue
            if _circuit_breakers.is_open(p_name):
                continue

            logger.info(f"Starting probe: {p_name}")
            start_time_probe = time.time()
            future = executor.submit(func)
            active_futures[future] = (p_name, pt, start_time_probe)
            threshold = _routing_memory.get_p75_latency(domain or "any", p_name) / 1000.0

            while active_futures:
                elapsed = time.time() - start_time_probe

                # If we've hit the threshold, start the next provider (hedging)
                if i < len(eligible) - 1 and elapsed >= threshold:
                    logger.info(f"Hedging threshold reached for {p_name} ({threshold}s)")
                    break

                # Wait for any task to complete
                done, _ = concurrent.futures.wait(
                    active_futures.keys(),
                    timeout=0.01,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )

                found_acceptable = False
                for f in list(done):
                    if f not in active_futures:
                        continue
                    p_name_done, pt_done, s_time = active_futures.pop(f)
                    latency = int((time.time() - s_time) * 1000)
                    budget.record_attempt(is_paid=pt_done.is_paid(), latency_ms=latency)
                    try:
                        res_or_content = f.result()
                    except Exception as e:
                        err_type = _detect_error_type(e)
                        if err_type not in (ErrorType.AUTH_ERROR, ErrorType.SSRF_BLOCKED):
                            _circuit_breakers.record_failure(p_name_done)
                        if trace:
                            step = TraceStep(
                                tool=p_name_done,
                                duration_ms=latency,
                                success=False,
                                error=str(e),
                            )
                            trace.steps.append(step)
                        metrics.record_provider(pt_done, latency, False)
                        continue
                    if res_or_content:
                        if isinstance(res_or_content, ProviderResult):
                            if res_or_content.ok:
                                content = res_or_content.content or ""
                            else:
                                _circuit_breakers.record_failure(p_name_done)
                                metrics.record_provider(pt_done, latency, False)
                                if trace:
                                    step = TraceStep(
                                        tool=p_name_done,
                                        duration_ms=latency,
                                        success=False,
                                        error=res_or_content.error,
                                    )
                                    trace.steps.append(step)
                                continue
                        elif isinstance(res_or_content, ResolvedResult):
                            content = res_or_content.content
                        else:
                            content = str(res_or_content)

                        q_score = quality.score_content(content)
                        if q_score.acceptable or pt_done == ProviderType.LLMS_TXT:
                            _circuit_breakers.record_success(p_name_done)
                            metrics.record_provider(pt_done, latency, True)
                            if domain:
                                _routing_memory.record(
                                    domain, p_name_done, True, latency, q_score.score
                                )

                            if trace:
                                trace.total_latency_ms = int((time.time() - start_time) * 1000)
                                trace.final_source = p_name_done
                                trace.final_score = q_score.score
                                trace.success = True
                            if pt_done == ProviderType.LLMS_TXT:
                                out = {
                                    "source": "llms.txt",
                                    "url": url,
                                    "content": compact_content(content, max_chars),
                                    "metrics": metrics,
                                }
                                if trace:
                                    out["trace"] = trace.to_dict()
                                yield out
                            elif isinstance(res_or_content, ResolvedResult):
                                res_or_content.metrics, res_or_content.score = (
                                    metrics,
                                    q_score.score,
                                )
                                out = res_or_content.to_dict()
                                if trace:
                                    out["trace"] = trace.to_dict()
                                yield out
                            break
                        else:
                            cache_negative.write_negative_cache(
                                cache, url, p_name_done, "thin_content", 1800
                            )
                            if domain:
                                _routing_memory.record(
                                    domain, p_name_done, False, latency, q_score.score
                                )
                    else:
                        _circuit_breakers.record_failure(p_name_done)
                        metrics.record_provider(pt_done, latency, False)

                if found_acceptable:
                    return
                if done:
                    break
                if not active_futures:
                    break
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
    for result in resolve_query_stream(query, max_chars, skip_providers, profile):
        if result.get("source") != "partial":
            return result
    return {"source": "none", "query": query, "content": "Failed"}


def resolve_query_stream(
    query: str,
    max_chars: int = MAX_CHARS,
    skip_providers: set[str] | None = None,
    profile: Profile = Profile.BALANCED,
    trace: ResolutionTrace | None = None,
) -> Generator[dict[str, Any], None, None]:
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
    cascade_map = {
        "exa_mcp": (ProviderType.EXA_MCP, resolve_with_exa_mcp),
        "exa": (ProviderType.EXA, resolve_with_exa),
        "tavily": (ProviderType.TAVILY, resolve_with_tavily),
        "duckduckgo": (ProviderType.DUCKDUCKGO, resolve_with_duckduckgo),
        "mistral_websearch": (ProviderType.MISTRAL_WEBSEARCH, resolve_with_mistral_websearch),
    }
    cache = _get_cache()
    eligible = [p for p in provider_names if p in cascade_map]
    active_futures = {}
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(eligible)))
    try:
        for i, p_name in enumerate(eligible):
            pt, func = cascade_map[p_name]
            if not budget.can_try(is_paid=pt.is_paid()):
                if budget.stop_reason in ("paid_disabled", "max_paid_attempts"):
                    continue
                break
            if cache_negative.should_skip_from_negative_cache(cache, query, p_name):
                continue
            if _circuit_breakers.is_open(p_name):
                continue
            logger.info(f"Starting probe: {p_name}")
            start_time_probe = time.time()
            future = executor.submit(func, query, max_chars)
            active_futures[future] = (p_name, pt, start_time_probe)
            threshold = _routing_memory.get_p75_latency("query", p_name) / 1000.0
            while active_futures:
                elapsed = time.time() - start_time_probe
                if i < len(eligible) - 1 and elapsed >= threshold:
                    break

                done, _ = concurrent.futures.wait(
                    active_futures.keys(),
                    timeout=0.01,
                    return_when=concurrent.futures.FIRST_COMPLETED,
                )
                found_acceptable = False
                for f in list(done):
                    if f not in active_futures:
                        continue
                    p_name_done, pt_done, s_time = active_futures.pop(f)
                    latency = int((time.time() - s_time) * 1000)
                    budget.record_attempt(is_paid=pt_done.is_paid(), latency_ms=latency)
                    try:
                        res = f.result()
                    except Exception as e:
                        err_type = _detect_error_type(e)
                        if err_type not in (ErrorType.AUTH_ERROR, ErrorType.SSRF_BLOCKED):
                            _circuit_breakers.record_failure(p_name_done)
                        if trace:
                            step = TraceStep(
                                tool=p_name_done,
                                duration_ms=latency,
                                success=False,
                                error=str(e),
                            )
                            trace.steps.append(step)
                        metrics.record_provider(pt_done, latency, False)
                        continue
                    if res:
                        if isinstance(res, ProviderResult):
                            if not res.ok:
                                _circuit_breakers.record_failure(p_name_done)
                                if trace:
                                    step = TraceStep(
                                        tool=p_name_done,
                                        duration_ms=latency,
                                        success=False,
                                        error=res.error,
                                    )
                                    trace.steps.append(step)
                                metrics.record_provider(pt_done, latency, False)
                                continue
                            content = res.content or ""
                        else:
                            content = res.content
                        q_score = quality.score_content(content)
                        if q_score.acceptable:
                            _circuit_breakers.record_success(p_name_done)
                            metrics.record_provider(pt_done, latency, True)
                            _routing_memory.record(
                                "query", p_name_done, True, latency, q_score.score
                            )

                            found_acceptable = True
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
                            yield out
                            break
                        else:
                            cache_negative.write_negative_cache(
                                cache, query, p_name_done, "thin_content", 1800
                            )
                            _routing_memory.record(
                                "query", p_name_done, False, latency, q_score.score
                            )
                    else:
                        _circuit_breakers.record_failure(p_name_done)
                        metrics.record_provider(pt_done, latency, False)

                if found_acceptable:
                    return
                if done:
                    break
                if not active_futures:
                    break
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
    if is_url(input_str):
        return resolve_url(input_str, max_chars, profile=profile)
    return resolve_query(input_str, max_chars, skip_providers, profile=profile)


def resolve_direct(
    input_str: str, provider: ProviderType, max_chars: int = MAX_CHARS
) -> dict[str, Any]:
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
    for pt in providers_order:
        res = resolve_direct(input_str, pt, max_chars)
        if res.get("source") != "none":
            return res
    return {"source": "none", "error": "All providers failed"}


def resolve_url_with_order(
    url: str, order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    return resolve_with_order(url, order, max_chars)


def resolve_query_with_order(
    query: str, order: list[ProviderType], max_chars: int = MAX_CHARS
) -> dict[str, Any]:
    return resolve_with_order(query, order, max_chars)


def main():
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
    if args.provider:
        results = [resolve_direct(args.input, ProviderType(args.provider), args.max_chars)]
    elif args.providers_order:
        order = [ProviderType(p.strip()) for p in args.providers_order.split(",")]
        results = [resolve_with_order(args.input, order, args.max_chars)]
    else:
        if is_url_input:
            results = resolve_url_stream(args.input, args.max_chars, profile, trace=trace)
        else:
            results = resolve_query_stream(args.input, args.max_chars, skip, profile, trace=trace)
    final_result = None
    for res in results:
        if not args.json and res.get("source") != "partial":
            print(f"--- Source: {res.get('source')} ---")
            print(res.get("content", "")[:500] + "...")
        final_result = res
    if args.json:
        print(
            json.dumps(
                final_result,
                indent=2,
                default=lambda o: o.__dict__ if hasattr(o, "__dict__") else str(o),
            )
        )
    else:
        print("\n=== FINAL RESULT ===")
        if final_result:
            print(final_result.get("content", ""))
        if args.trace and final_result and "trace" in final_result:
            print("\n=== TRACE ===")
            print(json.dumps(final_result["trace"], indent=2))


if __name__ == "__main__":
    main()
