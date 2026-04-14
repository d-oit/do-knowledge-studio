"""
Tests for quality scoring module.
"""

from scripts.quality import score_content


class TestScoreContent:
    """Tests for score_content function."""

    def test_empty_content(self):
        """Empty content should be too_short and not acceptable."""
        result = score_content("")
        assert result.too_short is True
        assert result.score < 1.0
        assert result.acceptable is False

    def test_short_content(self):
        """Content under 500 chars should be too_short."""
        short_text = "This is a short piece of text that is under the 500 char threshold."
        result = score_content(short_text)
        assert result.too_short is True
        # too_short (-0.35) + missing_links (-0.15) + duplicate_heavy (-0.25) = 0.25
        assert result.score == 0.25
        assert result.acceptable is False

    def test_min_acceptable_length(self):
        """Content at exactly 500 chars should not be too_short."""
        # Create content that's exactly 500 chars with unique lines
        content = "\n".join([f"Line {i} of unique content here" for i in range(20)])
        assert len(content) >= 500
        result = score_content(content)
        assert result.too_short is False

    def test_acceptable_content(self):
        """Good content should score well."""
        content = """
# Python Documentation

Python is a programming language that lets you work quickly
and integrate systems more effectively.

## Features

- Easy to learn
- Powerful standard library
- Cross-platform compatibility

## Installation

Visit https://python.org to download.

For more details, see https://docs.python.org/3/

Additional documentation is available at the official Python website
which provides comprehensive guides and tutorials for beginners
and advanced users alike. The standard library includes modules
for file I/O, system calls, sockets, and many other interfaces.
"""
        links = ["https://python.org", "https://docs.python.org/3/"]
        result = score_content(content, links)
        assert result.too_short is False
        assert result.missing_links is False
        assert result.duplicate_heavy is False
        assert result.noisy is False
        assert result.score == 1.0
        assert result.acceptable is True

    def test_missing_links_penalty(self):
        """Content without links should get -0.15 penalty."""
        # Create long content with unique lines to avoid duplicate_heavy
        content = "\n".join([f"Unique line number {i} with some text" for i in range(50)])
        result = score_content(content, [])
        assert result.missing_links is True
        assert result.score == 0.85  # 1.0 - 0.15
        assert result.acceptable is True

    def test_duplicate_heavy_content(self):
        """High duplicate line ratio should trigger duplicate_heavy."""
        # Repeated lines
        content = "\n".join(["Same line repeated"] * 20)
        result = score_content(content, ["https://example.com"])
        assert result.duplicate_heavy is True
        # too_short (-0.35) + duplicate_heavy (-0.25) = 0.40
        assert result.score == 0.40

    def test_noisy_content(self):
        """Too many noise signals should trigger noisy flag."""
        content = """
Subscribe now! Log in to continue. Sign up for free.
JavaScript enabled required. Accept cookies to proceed.
Subscribe to newsletter. Log in with your account.
Subscribe to our service. Log in today. Sign up now please.
Cookie consent required for all users. JavaScript is mandatory.
Subscribe to updates. Log in with credentials. Sign up free today.
"""
        result = score_content(content, ["https://example.com"])
        assert result.noisy is True

    def test_threshold_0_65_acceptable(self):
        """Score >= 0.65 and not too_short should be acceptable."""
        # Content with missing_links penalty only
        content = "\n".join([f"Unique line number {i} with some text" for i in range(50)])
        result = score_content(content, [])
        assert result.score == 0.85
        assert result.acceptable is True

    def test_threshold_below_0_65_not_acceptable(self):
        """Score < 0.65 should not be acceptable."""
        # Short content + missing links + duplicate heavy
        content = "short"
        result = score_content(content, [])
        # too_short (-0.35) + missing_links (-0.15) + duplicate_heavy (-0.25) = 0.25
        assert result.score == 0.25
        assert result.acceptable is False

    def test_multiple_penalties(self):
        """Multiple penalties should compound correctly."""
        # Short, no links, duplicate heavy, noisy
        content = "Subscribe log in sign up JavaScript cookie Subscribe log in\n" * 3
        result = score_content(content, [])
        # All penalties apply, score clamped to >= 0.0
        assert result.score >= 0.0
        assert result.acceptable is False

    def test_score_never_negative(self):
        """Score should never go below 0."""
        content = ""
        result = score_content(content, [])
        assert result.score >= 0.0


class TestQualityScoreDataclass:
    """Tests for QualityScore dataclass."""

    def test_quality_score_fields(self):
        """QualityScore should have all expected fields."""
        result = score_content("test content here", [])
        assert hasattr(result, "score")
        assert hasattr(result, "too_short")
        assert hasattr(result, "missing_links")
        assert hasattr(result, "duplicate_heavy")
        assert hasattr(result, "noisy")
        assert hasattr(result, "acceptable")

    def test_quality_score_types(self):
        """All QualityScore fields should have correct types."""
        result = score_content("test content", ["https://example.com"])
        assert isinstance(result.score, float)
        assert isinstance(result.too_short, bool)
        assert isinstance(result.missing_links, bool)
        assert isinstance(result.duplicate_heavy, bool)
        assert isinstance(result.noisy, bool)
        assert isinstance(result.acceptable, bool)
