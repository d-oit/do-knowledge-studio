"""Tests for shared utility helpers in scripts.utils."""

import pytest

from scripts.models import ErrorType
from scripts.utils import _detect_error_type


class TestDetectErrorType:
    """Error classification is stable and order-dependent."""

    @staticmethod
    @pytest.mark.parametrize(
        ("message", "expected"),
        [
            ("HTTP 429 Too Many Requests", ErrorType.RATE_LIMIT),
            ("rate limit exceeded", ErrorType.RATE_LIMIT),
            ("rate_limit hit", ErrorType.RATE_LIMIT),
            ("401 unauthorized", ErrorType.AUTH_ERROR),
            ("403 forbidden", ErrorType.AUTH_ERROR),
            ("invalid api key", ErrorType.AUTH_ERROR),
            ("authentication failed", ErrorType.AUTH_ERROR),
            ("402 payment required", ErrorType.QUOTA_EXHAUSTED),
            ("quota exhausted", ErrorType.QUOTA_EXHAUSTED),
            ("credit limit reached", ErrorType.QUOTA_EXHAUSTED),
            ("request timed out", ErrorType.TIMEOUT),
            ("connection refused", ErrorType.NETWORK_ERROR),
            ("network unreachable", ErrorType.NETWORK_ERROR),
            ("404 not found", ErrorType.NOT_FOUND),
            ("ssrf blocked", ErrorType.SSRF_BLOCKED),
            ("private ip address", ErrorType.SSRF_BLOCKED),
            ("content too large", ErrorType.CONTENT_TOO_LARGE),
            ("body exceeds limit", ErrorType.CONTENT_TOO_LARGE),
            ("something else entirely", ErrorType.UNKNOWN),
        ],
    )
    def test_maps_message_to_error_type(message: str, expected: ErrorType) -> None:
        """Every trigger pattern resolves to its declared ErrorType."""
        assert _detect_error_type(Exception(message)) is expected

    @staticmethod
    def test_first_match_wins() -> None:
        """Table order is respected: RATE_LIMIT is checked ahead of AUTH_ERROR."""
        assert (
            _detect_error_type(Exception("429 too many requests (401 code)"))
            is ErrorType.RATE_LIMIT
        )
