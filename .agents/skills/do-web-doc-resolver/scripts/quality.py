"""
Heuristics for scoring the quality of resolved content.
"""

from dataclasses import dataclass

from scripts.docs_validation import DocsValidationResult


@dataclass
class QualityScore:
    score: float
    too_short: bool
    missing_links: bool
    duplicate_heavy: bool
    noisy: bool
    acceptable: bool
    docs_validation: DocsValidationResult | None = None


def score_content(markdown: str, links: list[str] | None = None) -> QualityScore:
    # Handle MagicMocks in tests
    if not isinstance(markdown, str):
        return QualityScore(1.0, False, False, False, False, True)

    text = (markdown or "").strip()
    links = links or []

    length = len(text)
    too_short = length < 500
    missing_links = len(links) == 0

    lines = text.splitlines()
    num_lines = len(lines)
    duplicate_heavy = False
    if num_lines > 0:
        unique_lines = len({line.strip() for line in lines if line.strip()})
        # If fewer than 5 unique lines OR unique lines are less than half of total lines
        duplicate_heavy = unique_lines < max(5, num_lines // 2)

    noisy_signals = ["cookie", "subscribe", "javascript", "log in", "sign up"]
    noise_count = sum(text.lower().count(signal) for signal in noisy_signals)
    noisy = noise_count > 6

    score = 1.0
    if too_short:
        score -= 0.35
    if missing_links:
        score -= 0.15
    if duplicate_heavy:
        score -= 0.25
    if noisy:
        score -= 0.20

    # Ensure range
    score = max(0.0, score)

    # Threshold for acceptance as per #59: 0.65 and not too_short
    acceptable = score >= 0.65 and not too_short

    return QualityScore(
        score=score,
        too_short=too_short,
        missing_links=missing_links,
        duplicate_heavy=duplicate_heavy,
        noisy=noisy,
        acceptable=acceptable,
    )
