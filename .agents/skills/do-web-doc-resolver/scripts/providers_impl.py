"""
Individual provider implementations for the Web Doc Resolver.
"""

import json
import logging
import os
import subprocess
import time

from .models import ProviderMeta, ProviderResult, ResolvedResult
from .utils import (
    _get_from_cache,
    _save_to_cache,
    get_session,
)

logger = logging.getLogger(__name__)

MAX_CHARS = int(os.getenv("WEB_RESOLVER_MAX_CHARS", "8000"))
MIN_CHARS = int(os.getenv("WEB_RESOLVER_MIN_CHARS", "200"))
DEFAULT_TIMEOUT = int(os.getenv("WEB_RESOLVER_TIMEOUT", "30"))
EXA_RESULTS = int(os.getenv("WEB_RESOLVER_EXA_RESULTS", "5"))
TAVILY_RESULTS = int(os.getenv("WEB_RESOLVER_TAVILY_RESULTS", "5"))
DDG_RESULTS = int(os.getenv("WEB_RESOLVER_DDG_RESULTS", "5"))

_rate_limits: dict[str, float] = {}


def _is_rate_limited(provider: str) -> bool:
    if provider in _rate_limits:
        if time.time() < _rate_limits[provider]:
            return True
        del _rate_limits[provider]
    return False


def _set_rate_limit(provider: str, cooldown: int = 60):
    _rate_limits[provider] = time.time() + cooldown


# Exported names for both internal use and tests
is_rate_limited = _is_rate_limited
set_rate_limit = _set_rate_limit


def resolve_with_jina(url: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(url, "jina")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="jina", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, url=url, source="jina")
    if _is_rate_limited("jina"):
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="jina", duration_ms=duration, error_type="rate_limit")
        return ProviderResult(ok=False, error="rate_limited", meta=meta, url=url, source="jina")
    try:
        session = get_session()
        response = session.get(
            f"https://r.jina.ai/{url}", timeout=DEFAULT_TIMEOUT, headers={"Accept": "text/markdown"}
        )
        duration = int((time.time() - start) * 1000)
        if response.status_code == 429:
            _set_rate_limit("jina")
            meta = ProviderMeta(tool="jina", duration_ms=duration, error_type="rate_limit")
            return ProviderResult(ok=False, error="rate_limited", meta=meta, url=url, source="jina")
        if response.status_code != 200:
            meta = ProviderMeta(tool="jina", duration_ms=duration, error_type="network_error")
            return ProviderResult(ok=False, error=f"http_{response.status_code}", meta=meta, url=url, source="jina")
        content = response.text.strip()
        if len(content) < MIN_CHARS:
            meta = ProviderMeta(tool="jina", duration_ms=duration, error_type="not_found")
            return ProviderResult(ok=False, error="content_too_short", meta=meta, url=url, source="jina")
        result = ResolvedResult(source="jina", content=content[:max_chars], url=url)
        _save_to_cache(url, "jina", result.to_dict())
        meta = ProviderMeta(tool="jina", duration_ms=duration)
        return ProviderResult(ok=True, content=content[:max_chars], meta=meta, url=url, source="jina")
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="jina", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, url=url, source="jina")


def resolve_with_exa_mcp(query: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(query, "exa_mcp")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="exa_mcp", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, query=query, source="exa_mcp")
    if _is_rate_limited("exa_mcp"):
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="exa_mcp", duration_ms=duration, error_type="rate_limit")
        return ProviderResult(ok=False, error="rate_limited", meta=meta, query=query, source="exa_mcp")
    try:
        mcp_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": "web_search_exa", "arguments": {"query": query, "numResults": 8}},
        }
        session = get_session()
        response = session.post("https://mcp.exa.ai/mcp", json=mcp_request, timeout=25)
        duration = int((time.time() - start) * 1000)
        if response.status_code != 200:
            meta = ProviderMeta(tool="exa_mcp", duration_ms=duration, error_type="network_error")
            return ProviderResult(ok=False, error=f"http_{response.status_code}", meta=meta, query=query, source="exa_mcp")
        for line in response.text.split("\n"):
            if line.startswith("data: "):
                data = json.loads(line[6:])
                if data.get("result") and data["result"].get("content"):
                    content = data["result"]["content"][0].get("text", "")
                    meta = ProviderMeta(tool="exa_mcp", duration_ms=duration)
                    result = ProviderResult(ok=True, content=content[:max_chars], meta=meta, query=query, source="exa_mcp")
                    _save_to_cache(query, "exa_mcp", {"source": "exa_mcp", "content": content[:max_chars], "query": query})
                    return result
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="exa_mcp", duration_ms=duration, error_type="not_found")
        return ProviderResult(ok=False, error="no_content_found", meta=meta, query=query, source="exa_mcp")
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="exa_mcp", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, query=query, source="exa_mcp")


def resolve_with_exa(query: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(query, "exa")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="exa", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, query=query, source="exa")
    api_key = os.getenv("EXA_API_KEY")
    if not api_key or _is_rate_limited("exa"):
        duration = int((time.time() - start) * 1000)
        error_type = "auth_error" if not api_key else "rate_limit"
        meta = ProviderMeta(tool="exa", duration_ms=duration, error_type=error_type)
        return ProviderResult(ok=False, error="missing_api_key_or_rate_limited", meta=meta, query=query, source="exa")
    try:
        from exa_py import Exa

        client = Exa(api_key)
        res = client.search_and_contents(
            query, use_autoprompt=True, highlights=True, num_results=EXA_RESULTS
        )
        duration = int((time.time() - start) * 1000)
        if not res or not res.results:
            meta = ProviderMeta(tool="exa", duration_ms=duration, error_type="not_found")
            return ProviderResult(ok=False, error="no_results", meta=meta, query=query, source="exa")
        content = "\n\n---\n\n".join(
            [
                (r.highlight if hasattr(r, "highlight") and r.highlight else r.text)
                for r in res.results
                if (hasattr(r, "highlight") and r.highlight) or (hasattr(r, "text") and r.text)
            ]
        )
        meta = ProviderMeta(tool="exa", duration_ms=duration)
        result = ProviderResult(ok=True, content=content[:max_chars], meta=meta, query=query, source="exa")
        _save_to_cache(query, "exa", {"source": "exa", "content": content[:max_chars], "query": query})
        return result
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="exa", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, query=query, source="exa")


def resolve_with_tavily(query: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(query, "tavily")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="tavily", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, query=query, source="tavily")
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key or _is_rate_limited("tavily"):
        duration = int((time.time() - start) * 1000)
        error_type = "auth_error" if not api_key else "rate_limit"
        meta = ProviderMeta(tool="tavily", duration_ms=duration, error_type=error_type)
        return ProviderResult(ok=False, error="missing_api_key_or_rate_limited", meta=meta, query=query, source="tavily")
    try:
        from tavily import TavilyClient

        client = TavilyClient(api_key=api_key)
        res = client.search(query, max_results=TAVILY_RESULTS)
        duration = int((time.time() - start) * 1000)
        if not res or not res.get("results"):
            meta = ProviderMeta(tool="tavily", duration_ms=duration, error_type="not_found")
            return ProviderResult(ok=False, error="no_results", meta=meta, query=query, source="tavily")
        content = "\n\n---\n\n".join([f"## {r['title']}\n\n{r['content']}" for r in res["results"]])
        meta = ProviderMeta(tool="tavily", duration_ms=duration)
        result = ProviderResult(ok=True, content=content[:max_chars], meta=meta, query=query, source="tavily")
        _save_to_cache(query, "tavily", {"source": "tavily", "content": content[:max_chars], "query": query})
        return result
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="tavily", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, query=query, source="tavily")


def resolve_with_duckduckgo(query: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(query, "duckduckgo")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="duckduckgo", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, query=query, source="duckduckgo")
    if _is_rate_limited("duckduckgo"):
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="duckduckgo", duration_ms=duration, error_type="rate_limit")
        return ProviderResult(ok=False, error="rate_limited", meta=meta, query=query, source="duckduckgo")
    try:
        from ddgs import DDGS

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=DDG_RESULTS))
        duration = int((time.time() - start) * 1000)
        if not results:
            meta = ProviderMeta(tool="duckduckgo", duration_ms=duration, error_type="not_found")
            return ProviderResult(ok=False, error="no_results", meta=meta, query=query, source="duckduckgo")
        content = "\n\n---\n\n".join(
            [f"## {r.get('title','')}\n\n{r.get('body','')}" for r in results]
        )
        meta = ProviderMeta(tool="duckduckgo", duration_ms=duration)
        result = ProviderResult(ok=True, content=content[:max_chars], meta=meta, query=query, source="duckduckgo")
        _save_to_cache(query, "duckduckgo", {"source": "duckduckgo", "content": content[:max_chars], "query": query})
        return result
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="duckduckgo", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, query=query, source="duckduckgo")


def resolve_with_firecrawl(url: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(url, "firecrawl")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="firecrawl", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, url=url, source="firecrawl")
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key or _is_rate_limited("firecrawl"):
        duration = int((time.time() - start) * 1000)
        error_type = "auth_error" if not api_key else "rate_limit"
        meta = ProviderMeta(tool="firecrawl", duration_ms=duration, error_type=error_type)
        return ProviderResult(ok=False, error="missing_api_key_or_rate_limited", meta=meta, url=url, source="firecrawl")
    try:
        from firecrawl import Firecrawl

        app = Firecrawl(api_key=api_key)
        res = app.scrape(url, formats=["markdown"])
        duration = int((time.time() - start) * 1000)
        markdown = res.markdown if res and hasattr(res, "markdown") else ""
        meta = ProviderMeta(tool="firecrawl", duration_ms=duration)
        result = ProviderResult(ok=True, content=markdown[:max_chars], meta=meta, url=url, source="firecrawl")
        _save_to_cache(url, "firecrawl", {"source": "firecrawl", "content": markdown[:max_chars], "url": url})
        return result
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="firecrawl", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, url=url, source="firecrawl")


def resolve_with_mistral_browser(url: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(url, "mistral_browser")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="mistral_browser", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, url=url, source="mistral-browser")
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key or _is_rate_limited("mistral"):
        duration = int((time.time() - start) * 1000)
        error_type = "auth_error" if not api_key else "rate_limit"
        meta = ProviderMeta(tool="mistral_browser", duration_ms=duration, error_type=error_type)
        return ProviderResult(ok=False, error="missing_api_key_or_rate_limited", meta=meta, url=url, source="mistral-browser")
    try:
        from mistralai.client import Mistral
        from mistralai.client.models import UserMessage, WebSearchTool

        client = Mistral(api_key=api_key)
        resp = client.beta.conversations.start(
            inputs=UserMessage(content=f"Extract URL: {url}"), tools=[WebSearchTool()]
        )
        duration = int((time.time() - start) * 1000)
        content = resp.outputs[0].content if resp.outputs else ""
        meta = ProviderMeta(tool="mistral_browser", duration_ms=duration)
        result = ProviderResult(ok=True, content=content[:max_chars], meta=meta, url=url, source="mistral-browser")
        _save_to_cache(url, "mistral_browser", {"source": "mistral-browser", "content": content[:max_chars], "url": url})
        return result
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="mistral_browser", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, url=url, source="mistral-browser")


def resolve_with_mistral_websearch(query: str, max_chars: int = MAX_CHARS) -> ProviderResult:
    start = time.time()
    cached = _get_from_cache(query, "mistral_websearch")
    if cached:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="mistral_websearch", duration_ms=duration, cache_hit=True)
        return ProviderResult(ok=True, content=cached.get("content", ""), meta=meta, query=query, source="mistral-websearch")
    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key or _is_rate_limited("mistral"):
        duration = int((time.time() - start) * 1000)
        error_type = "auth_error" if not api_key else "rate_limit"
        meta = ProviderMeta(tool="mistral_websearch", duration_ms=duration, error_type=error_type)
        return ProviderResult(ok=False, error="missing_api_key_or_rate_limited", meta=meta, query=query, source="mistral-websearch")
    try:
        from mistralai.client import Mistral
        from mistralai.client.models import UserMessage

        client = Mistral(api_key=api_key)
        resp = client.chat.complete(
            model="mistral-small-latest", messages=[UserMessage(content=f"Search: {query}")]
        )
        duration = int((time.time() - start) * 1000)
        content = resp.choices[0].message.content if resp.choices else ""
        meta = ProviderMeta(tool="mistral_websearch", duration_ms=duration)
        result = ProviderResult(ok=True, content=content[:max_chars], meta=meta, query=query, source="mistral-websearch")
        _save_to_cache(query, "mistral_websearch", {"source": "mistral-websearch", "content": content[:max_chars], "query": query})
        return result
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="mistral_websearch", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, query=query, source="mistral-websearch")


def resolve_with_docling(url: str, max_chars: int) -> ProviderResult:
    start = time.time()
    try:
        res = subprocess.run(
            ["docling", "--format", "markdown", url], capture_output=True, text=True, timeout=60
        )
        duration = int((time.time() - start) * 1000)
        if res.returncode == 0:
            meta = ProviderMeta(tool="docling", duration_ms=duration)
            return ProviderResult(ok=True, content=res.stdout[:max_chars], meta=meta, url=url, source="docling")
        else:
            meta = ProviderMeta(tool="docling", duration_ms=duration, error_type="unknown")
            return ProviderResult(ok=False, error=f"exit_code_{res.returncode}", meta=meta, url=url, source="docling")
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="docling", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, url=url, source="docling")


def resolve_with_ocr(url: str, max_chars: int) -> ProviderResult:
    start = time.time()
    try:
        res = subprocess.run(
            ["tesseract", url, "stdout"], capture_output=True, text=True, timeout=30
        )
        duration = int((time.time() - start) * 1000)
        if res.returncode == 0:
            meta = ProviderMeta(tool="ocr", duration_ms=duration)
            return ProviderResult(ok=True, content=res.stdout[:max_chars], meta=meta, url=url, source="ocr-tesseract")
        else:
            meta = ProviderMeta(tool="ocr", duration_ms=duration, error_type="unknown")
            return ProviderResult(ok=False, error=f"exit_code_{res.returncode}", meta=meta, url=url, source="ocr-tesseract")
    except Exception as e:
        duration = int((time.time() - start) * 1000)
        meta = ProviderMeta(tool="ocr", duration_ms=duration, error_type="unknown")
        return ProviderResult(ok=False, error=str(e), meta=meta, url=url, source="ocr-tesseract")
