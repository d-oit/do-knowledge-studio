"""
Tests for SSRF URL validation (is_safe_url).

Focuses on the private-network blocklist and the socket default-timeout
save/restore contract introduced with the docling/OCR SSRF hardening.
"""

import socket
from unittest.mock import patch

from scripts.utils import is_safe_url


class TestIsSafeUrl:
    """SSRF safety checks."""

    @staticmethod
    def test_blocks_non_http_schemes():
        """file://, data:, javascript: URLs are rejected."""
        assert is_safe_url("file:///etc/passwd") is False
        assert is_safe_url("javascript:alert(1)") is False
        assert is_safe_url("data:text/plain;base64,AA==") is False

    @staticmethod
    def test_blocks_localhost_aliases():
        """localhost and loopback hostnames are rejected."""
        assert is_safe_url("http://localhost/foo") is False
        assert is_safe_url("http://127.0.0.1/foo") is False
        assert is_safe_url("http://0.0.0.0/foo") is False

    @staticmethod
    def test_blocks_private_ipv4():
        """RFC1918 and link-local ranges are rejected."""
        assert is_safe_url("http://10.0.0.1/foo") is False
        assert is_safe_url("http://172.16.0.1/foo") is False
        assert is_safe_url("http://192.168.1.1/foo") is False
        assert is_safe_url("http://169.254.169.254/latest/meta-data/") is False

    @staticmethod
    def test_blocks_private_ipv6():
        """Loopback and ULA IPv6 addresses are rejected."""
        assert is_safe_url("http://[::1]/foo") is False
        assert is_safe_url("http://[fc00::1]/foo") is False

    @staticmethod
    def test_blocks_public_hostname_resolving_to_private_ip():
        """A hostname that resolves to a private IP is rejected."""
        addr = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.1.2.3", 80))
        with patch("socket.getaddrinfo", return_value=[addr]):
            assert is_safe_url("http://example.internal/foo") is False

    @staticmethod
    def test_accepts_public_https_url():
        """A well-formed public https URL is accepted."""
        assert is_safe_url("https://example.com/docs") is True


class TestSocketTimeoutRestore:
    """The DNS-resolution path must restore the previous default timeout."""

    @staticmethod
    def test_restores_previous_timeout_after_resolution():
        """A pre-existing default timeout survives the lookup."""
        original = socket.getdefaulttimeout()
        try:
            socket.setdefaulttimeout(11)
            with patch(
                "socket.getaddrinfo",
                return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 80))],
            ):
                assert is_safe_url("https://example.com/") is True
            assert socket.getdefaulttimeout() == 11
        finally:
            socket.setdefaulttimeout(original)

    @staticmethod
    def test_restores_previous_timeout_when_blocked():
        """A blocked hostname still restores the prior timeout."""
        original = socket.getdefaulttimeout()
        try:
            socket.setdefaulttimeout(7)
            with patch(
                "socket.getaddrinfo",
                return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80))],
            ):
                assert is_safe_url("https://loopback.example/") is False
            assert socket.getdefaulttimeout() == 7
        finally:
            socket.setdefaulttimeout(original)

    @staticmethod
    def test_restores_when_resolution_raises():
        """A failing getaddrinfo still restores the prior timeout."""
        original = socket.getdefaulttimeout()
        try:
            socket.setdefaulttimeout(3)
            with patch("socket.getaddrinfo", side_effect=socket.gaierror("NXDOMAIN")):
                assert is_safe_url("https://nonexistent.invalid/") is True
            assert socket.getdefaulttimeout() == 3
        finally:
            socket.setdefaulttimeout(original)
