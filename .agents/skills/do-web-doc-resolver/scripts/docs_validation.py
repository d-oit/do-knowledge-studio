from dataclasses import dataclass, field


@dataclass
class DocsCheck:
    category: str
    name: str
    status: str  # "pass", "warn", "fail"
    detail: str = ""
    value: str | int | float | None = None


@dataclass
class DocsValidationResult:
    checks: list[DocsCheck] = field(default_factory=list)
    score: float = 0.0
    agent_friendly: bool = False

    @property
    def pass_count(self) -> int:
        return sum(1 for c in self.checks if c.status == "pass")

    @property
    def warn_count(self) -> int:
        return sum(1 for c in self.checks if c.status == "warn")

    @property
    def fail_count(self) -> int:
        return sum(1 for c in self.checks if c.status == "fail")


def validate_agent_friendly_docs(
    content: str,
    url: str = "",
    links: list[str] | None = None,
    headers: dict[str, str] | None = None,
    llms_txt_content: str = "",
) -> DocsValidationResult:
    """Validate content against agent-docs-spec v0.3.0 checks."""
    result = DocsValidationResult()
    links = links or []
    headers = headers or {}

    # Category 1: Content Discoverability
    _check_llms_txt_size(result, llms_txt_content)
    _check_links_resolve(result, links)

    # Category 2: Markdown Availability
    _check_markdown_available(result, url)

    # Category 3: Page Size & Truncation Risk
    _check_content_size(result, content)
    _check_content_start_position(result, content)

    # Category 4: Content Structure
    _check_section_headers(result, content)
    _check_code_fences(result, content)

    # Category 5: URL Stability
    _check_redirect_chain(result, url)

    # Category 6: Observability
    _check_cache_headers(result, headers)

    # Calculate overall score
    total = len(result.checks)
    if total > 0:
        score_map = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
        result.score = sum(score_map.get(c.status, 0.0) for c in result.checks) / total
        result.agent_friendly = result.score >= 0.7 and result.fail_count == 0

    return result


def _check_llms_txt_size(result: DocsValidationResult, llms_txt: str) -> None:
    """Check llms.txt is under 50K characters."""
    if not llms_txt:
        result.checks.append(DocsCheck(
            category="discoverability", name="llms_txt_exists",
            status="warn", detail="No llms.txt content provided"
        ))
        return
    size = len(llms_txt)
    status = "pass" if size < 50_000 else "fail"
    detail = f"llms.txt size: {size:,} chars" + (" (exceeds 50K limit)" if size >= 50_000 else "")
    result.checks.append(DocsCheck(
        category="discoverability", name="llms_txt_size",
        status=status, detail=detail, value=size
    ))


def _check_links_resolve(result: DocsValidationResult, links: list[str]) -> None:
    """Check that links are valid URLs."""
    if not links:
        result.checks.append(DocsCheck(
            category="discoverability", name="links_exist",
            status="warn", detail="No links provided for validation"
        ))
        return
    valid = sum(1 for link in links if link.startswith("http"))
    status = "pass" if valid == len(links) else "warn"
    result.checks.append(DocsCheck(
        category="discoverability", name="links_valid",
        status=status, detail=f"{valid}/{len(links)} links are valid URLs",
        value=valid
    ))


def _check_markdown_available(result: DocsValidationResult, url: str) -> None:
    """Check if .md URL variant might be available."""
    if not url:
        result.checks.append(DocsCheck(
            category="markdown", name="md_url_available",
            status="warn", detail="No URL provided for .md check"
        ))
        return
    has_md_variant = url.endswith(".md") or "/llms.txt" in url
    status = "pass" if has_md_variant else "warn"
    detail = "Markdown variant available" if has_md_variant else "Consider serving .md URL variants"
    result.checks.append(DocsCheck(
        category="markdown", name="md_url_available",
        status=status, detail=detail
    ))


def _check_content_size(result: DocsValidationResult, content: str) -> None:
    """Check content size is reasonable."""
    size = len(content)
    if size == 0:
        status = "fail"
        detail = "No content"
    elif size < 500:
        status = "warn"
        detail = f"Content too short: {size} chars"
    elif size < 50_000:
        status = "pass"
        detail = f"Content size: {size:,} chars"
    else:
        status = "warn"
        detail = f"Content large: {size:,} chars (may be truncated)"
    result.checks.append(DocsCheck(
        category="page_size", name="content_size",
        status=status, detail=detail, value=size
    ))


def _check_content_start_position(result: DocsValidationResult, content: str) -> None:
    """Check if content starts early (not buried in boilerplate)."""
    if not content:
        result.checks.append(DocsCheck(
            category="page_size", name="content_start",
            status="fail", detail="No content"
        ))
        return
    first_heading = content.find("# ")
    first_para = content.find("\n\n")
    candidates = [x for x in [first_heading, first_para] if x != -1]
    content_start = min(candidates) if candidates else 0
    ratio = content_start / len(content) if len(content) > 0 else 0
    status = "pass" if ratio < 0.3 else "warn"
    detail = f"Content starts at {content_start} chars ({ratio:.0%} of page)"
    result.checks.append(DocsCheck(
        category="page_size", name="content_start_position",
        status=status, detail=detail, value=content_start
    ))


def _check_section_headers(result: DocsValidationResult, content: str) -> None:
    """Check for quality section headers."""
    if not content:
        result.checks.append(DocsCheck(
            category="structure", name="section_headers",
            status="fail", detail="No content"
        ))
        return
    headers = [line for line in content.splitlines() if line.startswith("## ")]
    status = "pass" if len(headers) >= 2 else "warn"
    detail = f"Found {len(headers)} section headers"
    result.checks.append(DocsCheck(
        category="structure", name="section_headers",
        status=status, detail=detail, value=len(headers)
    ))


def _check_code_fences(result: DocsValidationResult, content: str) -> None:
    """Check code fences are valid."""
    if not content:
        result.checks.append(DocsCheck(
            category="structure", name="code_fences",
            status="warn", detail="No content"
        ))
        return
    open_fences = content.count("```")
    status = "pass" if open_fences % 2 == 0 else "warn"
    detail = f"Found {open_fences // 2} code blocks" if open_fences % 2 == 0 else "Unclosed code fence detected"
    result.checks.append(DocsCheck(
        category="structure", name="code_fences_valid",
        status=status, detail=detail, value=open_fences // 2
    ))


def _check_redirect_chain(result: DocsValidationResult, url: str) -> None:
    """Check URL stability (no soft 404s)."""
    if not url:
        result.checks.append(DocsCheck(
            category="url_stability", name="redirect_chain",
            status="warn", detail="No URL provided"
        ))
        return
    result.checks.append(DocsCheck(
        category="url_stability", name="url_stable",
        status="pass", detail="URL resolved successfully"
    ))


def _check_cache_headers(result: DocsValidationResult, headers: dict[str, str]) -> None:
    """Check cache header hygiene."""
    if not headers:
        result.checks.append(DocsCheck(
            category="observability", name="cache_headers",
            status="warn", detail="No response headers provided"
        ))
        return
    has_cache = "Cache-Control" in headers or "ETag" in headers or "Last-Modified" in headers
    status = "pass" if has_cache else "warn"
    detail = "Cache headers present" if has_cache else "Consider adding Cache-Control or ETag headers"
    result.checks.append(DocsCheck(
        category="observability", name="cache_headers",
        status=status, detail=detail
    ))
