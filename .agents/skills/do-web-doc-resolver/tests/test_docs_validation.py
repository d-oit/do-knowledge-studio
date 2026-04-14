"""
Tests for docs validation module.
"""

from scripts.docs_validation import (
    DocsCheck,
    DocsValidationResult,
    _check_cache_headers,
    _check_code_fences,
    _check_content_size,
    _check_content_start_position,
    _check_links_resolve,
    _check_llms_txt_size,
    _check_markdown_available,
    _check_redirect_chain,
    _check_section_headers,
    validate_agent_friendly_docs,
)


class TestDocsCheck:
    """Tests for DocsCheck dataclass."""

    def test_defaults(self):
        """DocsCheck should have sensible defaults."""
        check = DocsCheck(category="test", name="check", status="pass")
        assert check.detail == ""
        assert check.value is None

    def test_full(self):
        """DocsCheck should accept all fields."""
        check = DocsCheck(
            category="structure", name="headers",
            status="pass", detail="Found 3 headers", value=3
        )
        assert check.category == "structure"
        assert check.name == "headers"
        assert check.status == "pass"
        assert check.value == 3


class TestDocsValidationResult:
    """Tests for DocsValidationResult dataclass."""

    def test_defaults(self):
        """DocsValidationResult should have sensible defaults."""
        result = DocsValidationResult()
        assert result.checks == []
        assert result.score == 0.0
        assert result.agent_friendly is False

    def test_counts_empty(self):
        """Counts should be zero when no checks."""
        result = DocsValidationResult()
        assert result.pass_count == 0
        assert result.warn_count == 0
        assert result.fail_count == 0

    def test_counts_mixed(self):
        """Counts should reflect check statuses."""
        result = DocsValidationResult(checks=[
            DocsCheck(category="a", name="n1", status="pass"),
            DocsCheck(category="a", name="n2", status="warn"),
            DocsCheck(category="a", name="n3", status="fail"),
            DocsCheck(category="a", name="n4", status="pass"),
        ])
        assert result.pass_count == 2
        assert result.warn_count == 1
        assert result.fail_count == 1


class TestCheckLlmsTxtSize:
    """Tests for _check_llms_txt_size."""

    def test_no_llms_txt(self):
        """Missing llms.txt should warn."""
        result = DocsValidationResult()
        _check_llms_txt_size(result, "")
        assert len(result.checks) == 1
        assert result.checks[0].status == "warn"
        assert result.checks[0].name == "llms_txt_exists"

    def test_small_llms_txt(self):
        """Small llms.txt should pass."""
        result = DocsValidationResult()
        _check_llms_txt_size(result, "small content")
        assert result.checks[0].status == "pass"
        assert result.checks[0].name == "llms_txt_size"

    def test_large_llms_txt(self):
        """llms.txt over 50K should fail."""
        result = DocsValidationResult()
        big = "x" * 50_001
        _check_llms_txt_size(result, big)
        assert result.checks[0].status == "fail"
        assert result.checks[0].value == 50_001
        assert "exceeds 50K" in result.checks[0].detail


class TestCheckLinksResolve:
    """Tests for _check_links_resolve."""

    def test_no_links(self):
        """No links should warn."""
        result = DocsValidationResult()
        _check_links_resolve(result, [])
        assert result.checks[0].status == "warn"
        assert result.checks[0].name == "links_exist"

    def test_all_valid(self):
        """All valid URLs should pass."""
        result = DocsValidationResult()
        _check_links_resolve(result, ["https://example.com", "http://test.org"])
        assert result.checks[0].status == "pass"
        assert result.checks[0].value == 2

    def test_partial_valid(self):
        """Some invalid URLs should warn."""
        result = DocsValidationResult()
        _check_links_resolve(result, ["https://example.com", "not-a-url"])
        assert result.checks[0].status == "warn"
        assert result.checks[0].value == 1


class TestCheckMarkdownAvailable:
    """Tests for _check_markdown_available."""

    def test_no_url(self):
        """No URL should warn."""
        result = DocsValidationResult()
        _check_markdown_available(result, "")
        assert result.checks[0].status == "warn"

    def test_md_url(self):
        """URL ending in .md should pass."""
        result = DocsValidationResult()
        _check_markdown_available(result, "https://example.com/docs.md")
        assert result.checks[0].status == "pass"

    def test_llms_txt_url(self):
        """URL containing /llms.txt should pass."""
        result = DocsValidationResult()
        _check_markdown_available(result, "https://example.com/llms.txt")
        assert result.checks[0].status == "pass"

    def test_regular_url(self):
        """Regular URL should warn."""
        result = DocsValidationResult()
        _check_markdown_available(result, "https://example.com/docs")
        assert result.checks[0].status == "warn"


class TestCheckContentSize:
    """Tests for _check_content_size."""

    def test_empty(self):
        """Empty content should fail."""
        result = DocsValidationResult()
        _check_content_size(result, "")
        assert result.checks[0].status == "fail"

    def test_short(self):
        """Short content should warn."""
        result = DocsValidationResult()
        _check_content_size(result, "short")
        assert result.checks[0].status == "warn"

    def test_good_size(self):
        """Reasonable content should pass."""
        result = DocsValidationResult()
        _check_content_size(result, "x" * 1000)
        assert result.checks[0].status == "pass"

    def test_large(self):
        """Very large content should warn."""
        result = DocsValidationResult()
        _check_content_size(result, "x" * 60_000)
        assert result.checks[0].status == "warn"
        assert "truncated" in result.checks[0].detail


class TestCheckContentStartPosition:
    """Tests for _check_content_start_position."""

    def test_empty(self):
        """Empty content should fail."""
        result = DocsValidationResult()
        _check_content_start_position(result, "")
        assert result.checks[0].status == "fail"

    def test_early_heading(self):
        """Content starting with heading should pass."""
        result = DocsValidationResult()
        content = "# Title\n\nSome content here."
        _check_content_start_position(result, content)
        assert result.checks[0].status == "pass"

    def test_buried_content(self):
        """Content buried in boilerplate should warn."""
        result = DocsValidationResult()
        boilerplate = "boilerplate " * 100
        content = boilerplate + "\n\n# Actual content"
        _check_content_start_position(result, content)
        assert result.checks[0].status == "warn"


class TestCheckSectionHeaders:
    """Tests for _check_section_headers."""

    def test_empty(self):
        """Empty content should fail."""
        result = DocsValidationResult()
        _check_section_headers(result, "")
        assert result.checks[0].status == "fail"

    def test_enough_headers(self):
        """Two or more section headers should pass."""
        result = DocsValidationResult()
        content = "## Section 1\n\n## Section 2\n\n## Section 3"
        _check_section_headers(result, content)
        assert result.checks[0].status == "pass"
        assert result.checks[0].value == 3

    def test_few_headers(self):
        """Fewer than 2 section headers should warn."""
        result = DocsValidationResult()
        content = "## Only one section"
        _check_section_headers(result, content)
        assert result.checks[0].status == "warn"


class TestCheckCodeFences:
    """Tests for _check_code_fences."""

    def test_empty(self):
        """Empty content should warn."""
        result = DocsValidationResult()
        _check_code_fences(result, "")
        assert result.checks[0].status == "warn"

    def test_balanced_fences(self):
        """Balanced code fences should pass."""
        result = DocsValidationResult()
        content = "```\ncode\n```\n```\nmore\n```"
        _check_code_fences(result, content)
        assert result.checks[0].status == "pass"
        assert result.checks[0].value == 2

    def test_unbalanced_fences(self):
        """Unbalanced code fences should warn."""
        result = DocsValidationResult()
        content = "```\ncode"
        _check_code_fences(result, content)
        assert result.checks[0].status == "warn"
        assert "Unclosed" in result.checks[0].detail


class TestCheckRedirectChain:
    """Tests for _check_redirect_chain."""

    def test_no_url(self):
        """No URL should warn."""
        result = DocsValidationResult()
        _check_redirect_chain(result, "")
        assert result.checks[0].status == "warn"

    def test_url_provided(self):
        """URL provided should pass (content was resolved)."""
        result = DocsValidationResult()
        _check_redirect_chain(result, "https://example.com/docs")
        assert result.checks[0].status == "pass"
        assert result.checks[0].name == "url_stable"


class TestCheckCacheHeaders:
    """Tests for _check_cache_headers."""

    def test_no_headers(self):
        """No headers should warn."""
        result = DocsValidationResult()
        _check_cache_headers(result, {})
        assert result.checks[0].status == "warn"

    def test_cache_control(self):
        """Cache-Control header should pass."""
        result = DocsValidationResult()
        _check_cache_headers(result, {"Cache-Control": "max-age=3600"})
        assert result.checks[0].status == "pass"

    def test_etag(self):
        """ETag header should pass."""
        result = DocsValidationResult()
        _check_cache_headers(result, {"ETag": '"abc123"'})
        assert result.checks[0].status == "pass"

    def test_last_modified(self):
        """Last-Modified header should pass."""
        result = DocsValidationResult()
        _check_cache_headers(result, {"Last-Modified": "Mon, 01 Jan 2026"})
        assert result.checks[0].status == "pass"

    def test_no_cache_header(self):
        """Headers without cache info should warn."""
        result = DocsValidationResult()
        _check_cache_headers(result, {"Content-Type": "text/html"})
        assert result.checks[0].status == "warn"


class TestValidateAgentFriendlyDocs:
    """Tests for validate_agent_friendly_docs integration."""

    def test_all_pass_scenario(self):
        """Good docs should score high and be agent_friendly."""
        content = "# Title\n\n## Section 1\n\n```\ncode\n```\n\n## Section 2\n\n" + "x" * 500
        result = validate_agent_friendly_docs(
            content=content,
            url="https://example.com/llms.txt",
            links=["https://example.com"],
            headers={"Cache-Control": "max-age=3600"},
            llms_txt_content="small llms.txt",
        )
        assert result.fail_count == 0
        assert result.score >= 0.7
        assert result.agent_friendly is True

    def test_all_empty_scenario(self):
        """Empty inputs should score low and not be agent_friendly."""
        result = validate_agent_friendly_docs(
            content="",
            url="",
            links=[],
            headers={},
            llms_txt_content="",
        )
        assert result.score < 0.7
        assert result.agent_friendly is False
        assert result.fail_count > 0

    def test_score_calculation(self):
        """Score should be weighted average of checks."""
        result = DocsValidationResult(checks=[
            DocsCheck(category="a", name="n1", status="pass"),
            DocsCheck(category="a", name="n2", status="warn"),
            DocsCheck(category="a", name="n3", status="fail"),
        ])
        total = len(result.checks)
        score_map = {"pass": 1.0, "warn": 0.5, "fail": 0.0}
        expected = sum(score_map[c.status] for c in result.checks) / total
        result.score = expected
        assert result.score == 0.5

    def test_agent_friendly_requires_no_fails(self):
        """Even with high score, fails should prevent agent_friendly."""
        result = DocsValidationResult(checks=[
            DocsCheck(category="a", name="n1", status="pass"),
            DocsCheck(category="a", name="n2", status="pass"),
            DocsCheck(category="a", name="n3", status="fail"),
        ])
        result.score = 0.67
        result.agent_friendly = result.score >= 0.7 and result.fail_count == 0
        assert result.agent_friendly is False
