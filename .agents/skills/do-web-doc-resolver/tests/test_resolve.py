"""
Tests for main resolve module.
"""

from unittest.mock import patch

import pytest

from scripts.resolve import MAX_CHARS, MIN_CHARS, is_url, resolve


class TestIsUrl:
    """Tests for URL detection."""

    def test_detects_https_url(self):
        """Should detect https URLs."""
        assert is_url("https://example.com") is True
        assert is_url("https://docs.python.org/3/library/json.html") is True

    def test_detects_http_url(self):
        """Should detect http URLs."""
        assert is_url("http://example.com") is True
        assert is_url("http://localhost:8000") is True

    def test_detects_ftp_url(self):
        """Should detect ftp URLs."""
        assert is_url("ftp://ftp.example.com") is True
        assert is_url("ftps://secure.example.com") is True

    def test_detects_url_with_path(self):
        """Should detect URLs with paths."""
        assert is_url("https://example.com/path/to/page") is True
        assert is_url("https://example.com/path?query=value") is True

    def test_detects_url_with_fragment(self):
        """Should detect URLs with fragments."""
        assert is_url("https://example.com/page#section") is True

    def test_detects_url_with_port(self):
        """Should detect URLs with port numbers."""
        assert is_url("https://example.com:8080") is True
        assert is_url("http://localhost:3000/app") is True

    def test_rejects_query_string(self):
        """Should not detect plain text queries as URLs."""
        assert is_url("hello world") is False
        assert is_url("Python json module documentation") is False

    def test_rejects_empty_string(self):
        """Should not detect empty string as URL."""
        assert is_url("") is False

    def test_rejects_whitespace(self):
        """Should not detect whitespace as URL."""
        assert is_url("   ") is False
        assert is_url("\n\t") is False

    def test_rejects_partial_url(self):
        """Should not detect partial URLs without scheme."""
        assert is_url("example.com") is False
        assert is_url("www.example.com") is False

    def test_rejects_file_path(self):
        """Should not detect file paths as URLs."""
        assert is_url("/path/to/file") is False
        assert is_url("./relative/path") is False

    def test_rejects_email_address(self):
        """Should not detect email addresses as URLs."""
        assert is_url("user@example.com") is False

    def test_url_with_subdomain(self):
        """Should detect URLs with subdomains."""
        assert is_url("https://docs.python.org") is True
        assert is_url("https://sub.sub.example.com") is True

    def test_url_with_unicode(self):
        """Should handle URLs with unicode characters."""
        assert is_url("https://example.com/path/üñíçödé") is True

    def test_url_with_special_chars(self):
        """Should handle URLs with encoded special chars."""
        assert is_url("https://example.com/path?query=a%20b%20c") is True


class TestConstants:
    """Tests for module constants."""

    def test_max_chars_exists(self):
        """MAX_CHARS should exist and be positive."""
        assert isinstance(MAX_CHARS, int)
        assert MAX_CHARS > 0

    def test_min_chars_exists(self):
        """MIN_CHARS should exist and be positive."""
        assert isinstance(MIN_CHARS, int)
        assert MIN_CHARS > 0

    def test_min_less_than_max(self):
        """MIN_CHARS should be less than MAX_CHARS."""
        assert MIN_CHARS < MAX_CHARS

    def test_reasonable_defaults(self):
        """Constants should have reasonable default values."""
        # MAX_CHARS is typically 8000
        assert MAX_CHARS >= 4000
        assert MAX_CHARS <= 32000
        # MIN_CHARS is typically 200
        assert MIN_CHARS >= 100
        assert MIN_CHARS <= 500


class TestResolve:
    """Tests for resolve function."""

    @pytest.mark.live
    def test_resolve_url_returns_dict(self, sample_url, max_chars):
        """Resolving a URL should return a dict."""
        result = resolve(sample_url, max_chars=max_chars)
        assert isinstance(result, dict)
        assert "source" in result
        assert "content" in result

    @pytest.mark.live
    def test_resolve_query_returns_dict(self, sample_query, max_chars):
        """Resolving a query should return a dict."""
        result = resolve(sample_query, max_chars=max_chars)
        assert isinstance(result, dict)
        assert "source" in result
        assert "content" in result

    @pytest.mark.live
    def test_resolve_url_content_not_empty(self, sample_url, max_chars):
        """Resolved content should not be empty."""
        result = resolve(sample_url, max_chars=max_chars)
        assert result.get("content")
        assert len(result["content"]) > 0

    @pytest.mark.live
    def test_resolve_query_content_not_empty(self, sample_query, max_chars):
        """Resolved query content should not be empty."""
        result = resolve(sample_query, max_chars=max_chars)
        assert result.get("content")
        assert len(result["content"]) > 0

    @pytest.mark.live
    def test_resolve_respects_max_chars(self, sample_url):
        """Resolved content should respect max_chars limit."""
        small_max = 500
        result = resolve(sample_url, max_chars=small_max)
        if result and "content" in result:
            assert len(result["content"]) <= small_max + 100  # Allow some tolerance

    @pytest.mark.live
    def test_resolve_includes_source(self, sample_url, max_chars):
        """Resolved result should include source provider."""
        result = resolve(sample_url, max_chars=max_chars)
        assert result.get("source")
        assert isinstance(result["source"], str)


class TestResolveEdgeCases:
    """Tests for edge cases in resolve function."""

    def test_resolve_empty_input(self, max_chars):
        """Empty input should return a failure dict."""
        result = resolve("", max_chars=max_chars)
        assert isinstance(result, dict)
        assert result.get("source") == "none"

    def test_resolve_whitespace_input(self, max_chars):
        """Whitespace-only input should return a failure dict."""
        result = resolve("   ", max_chars=max_chars)
        assert isinstance(result, dict)
        assert result.get("source") == "none"

    def test_resolve_none_input(self, max_chars):
        """None input should return a failure dict."""
        result = resolve(None, max_chars=max_chars)
        assert isinstance(result, dict)
        assert result.get("source") == "none"


class TestResolveUrlStreamCascade:
    """Mock-based tests for the resolve_url_stream provider cascade."""

    @pytest.fixture(autouse=True)
    def _isolate_state(self):
        """Isolate persistent cache, circuit breakers, and routing memory."""
        from scripts.circuit_breaker import CircuitBreakerRegistry
        from scripts.routing_memory import RoutingMemory

        with (
            patch("scripts.resolve._get_cache", return_value=None),
            patch("scripts.resolve._circuit_breakers", CircuitBreakerRegistry()),
            patch("scripts.resolve._routing_memory", RoutingMemory()),
        ):
            yield

    @staticmethod
    def _make_quality(acceptable: bool = True):
        """Build a QualityScore for the given acceptance flag."""
        from scripts.quality import QualityScore

        return QualityScore(
            score=0.9 if acceptable else 0.3,
            too_short=not acceptable,
            missing_links=False,
            duplicate_heavy=False,
            noisy=False,
            acceptable=acceptable,
        )

    @patch("scripts.resolve.routing.plan_provider_order", return_value=["direct_fetch"])
    @patch("scripts.resolve.fetch_url_content")
    @patch("scripts.resolve.quality.score_content")
    def test_acceptable_resolved_result_yields_content(self, mock_score, mock_fetch, mock_plan):
        """An acceptable ResolvedResult should be yielded as the first output."""
        from scripts.models import Profile, ResolvedResult
        from scripts.resolve import resolve_url_stream

        mock_score.return_value = self._make_quality(acceptable=True)
        mock_fetch.return_value = ResolvedResult(
            source="direct_fetch", content="B" * 600, url="https://example.com"
        )
        results = list(resolve_url_stream("https://example.com", profile=Profile.FAST))
        assert results
        first = results[0]
        assert first["source"] == "direct_fetch"
        assert first["url"] == "https://example.com"
        assert len(first["content"]) >= 600

    @patch("scripts.resolve.routing.plan_provider_order", return_value=["llms_txt"])
    @patch("scripts.resolve.fetch_llms_txt")
    def test_llms_txt_yields_compacted_output(self, mock_llms, mock_plan):
        """An llms.txt hit should yield compacted content regardless of quality."""
        from scripts.models import Profile
        from scripts.resolve import resolve_url_stream

        mock_llms.return_value = ("line1\n" + "line2\n") * 300
        results = list(resolve_url_stream("https://example.com", profile=Profile.FAST))
        assert results
        first = results[0]
        assert first["source"] == "llms.txt"
        assert "line1" in first["content"]

    @patch("scripts.resolve.routing.plan_provider_order", return_value=["jina"])
    @patch("scripts.resolve.resolve_with_jina")
    @patch("scripts.resolve.quality.score_content")
    def test_thin_content_falls_through_to_failure(self, mock_score, mock_jina, mock_plan):
        """Thin provider content should not be yielded; final result is 'none'."""
        from scripts.models import Profile, ProviderMeta, ProviderResult
        from scripts.resolve import resolve_url_stream

        mock_score.return_value = self._make_quality(acceptable=False)
        mock_jina.return_value = ProviderResult(
            ok=True,
            content="short",
            meta=ProviderMeta(tool="jina", duration_ms=5),
            url="https://example.com",
            source="jina",
        )
        results = list(resolve_url_stream("https://example.com", profile=Profile.FAST))
        assert results
        # ProviderResult with acceptable=False is rejected; only the failure dict is emitted.
        assert all(r["source"] != "jina" for r in results)
        assert results[-1]["source"] == "none"

    @patch("scripts.resolve.resolve_with_docling")
    def test_special_document_uses_docling(self, mock_docling):
        """A PDF URL should be resolved via docling without a provider cascade."""
        from scripts.models import Profile, ProviderMeta, ProviderResult
        from scripts.resolve import resolve_url_stream

        mock_docling.return_value = ProviderResult(
            ok=True,
            content="extracted pdf text",
            meta=ProviderMeta(tool="docling", duration_ms=10),
            url="https://8.8.8.8/report.pdf",
            source="docling",
        )
        results = list(resolve_url_stream("https://8.8.8.8/report.pdf", profile=Profile.FAST))
        assert results
        assert results[0]["source"] == "docling"
        assert results[0]["content"] == "extracted pdf text"

    @patch("scripts.resolve.resolve_with_docling")
    @patch("scripts.resolve.routing.plan_provider_order", return_value=[])
    def test_special_document_failure_falls_through(self, mock_plan, mock_docling):
        """A failed docling attempt should fall through to the regular failure result."""
        from scripts.models import Profile, ProviderMeta, ProviderResult
        from scripts.resolve import resolve_url_stream

        mock_docling.return_value = ProviderResult(
            ok=False,
            error="exit_code_1",
            meta=ProviderMeta(tool="docling", duration_ms=10, error_type="unknown"),
            url="https://8.8.8.8/report.pdf",
            source="docling",
        )
        results = list(resolve_url_stream("https://8.8.8.8/report.pdf", profile=Profile.FAST))
        assert results
        assert results[-1]["source"] == "none"


class TestResolveQuality:
    """Tests for content quality in resolve function."""

    @pytest.mark.live
    def test_resolved_content_above_min_chars(self, sample_url, max_chars):
        """Resolved content should typically be above MIN_CHARS."""
        result = resolve(sample_url, max_chars=max_chars)
        if result and "content" in result:
            # Most successful resolutions should exceed MIN_CHARS
            assert len(result["content"]) >= MIN_CHARS or result["content"] == ""

    @pytest.mark.live
    def test_resolved_content_has_structure(self, sample_query, max_chars):
        """Resolved content should have some markdown structure."""
        result = resolve(sample_query, max_chars=max_chars)
        if result and "content" in result and len(result["content"]) > 100:
            content = result["content"]
            # Should have some structure (headers, lists, etc.)
            has_structure = "#" in content or "-" in content or "*" in content or "\n\n" in content
            assert has_structure or len(content) > 200  # Or just substantial content
