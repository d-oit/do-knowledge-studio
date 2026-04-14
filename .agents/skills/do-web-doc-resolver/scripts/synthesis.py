"""
Two-stage synthesis gating logic for the Web Doc Resolver.
"""

import logging
from difflib import SequenceMatcher

from .models import ResolvedResult

logger = logging.getLogger(__name__)


def _content_similarity(a: str, b: str) -> float:
    """Compute similarity ratio between two strings (0.0 to 1.0)."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a[:2000], b[:2000]).ratio()


def _has_conflicts(results: list[ResolvedResult]) -> bool:
    """Check if results contain conflicting information."""
    if len(results) < 2:
        return False
    for i in range(len(results)):
        for j in range(i + 1, len(results)):
            similarity = _content_similarity(results[i].content, results[j].content)
            if similarity < 0.2:
                return True
    return False


def _is_fragmented(results: list[ResolvedResult], min_chars: int = 500) -> bool:
    """Check if results are too fragmented individually."""
    short_count = sum(1 for r in results if len(r.content) < min_chars)
    return short_count > len(results) / 2


def synthesis_gate_decision(
    results: list[ResolvedResult], threshold: float = 0.8
) -> tuple[bool, str]:
    """
    Two-stage synthesis gate: decide whether to call LLM based on result quality.

    Returns (should_call, reason).
    """
    if not results:
        return False, "no_results"

    if len(results) == 1:
        score = results[0].score
        if score >= threshold:
            logger.info("synthesis_gate decision=skip reason=single_high_quality score=%.2f", score)
            return False, "single_high_quality"
        logger.info("synthesis_gate decision=call reason=single_low_quality score=%.2f", score)
        return True, "single_low_quality"

    if _has_conflicts(results):
        logger.info("synthesis_gate decision=call reason=conflicts sources=%d", len(results))
        return True, "conflicts"

    if _is_fragmented(results):
        logger.info("synthesis_gate decision=call reason=fragmented sources=%d", len(results))
        return True, "fragmented"

    total_len = sum(len(r.content) for r in results if r.content)
    if total_len < 1000:
        logger.info("synthesis_gate decision=call reason=insufficient_content total=%d", total_len)
        return True, "insufficient_content"

    logger.info(
        "synthesis_gate decision=skip reason=complete sources=%d total_chars=%d",
        len(results),
        total_len,
    )
    return False, "complete"


def should_call_llm_synthesis(results: list[ResolvedResult], threshold: float = 0.8) -> bool:
    """Decide whether to call LLM synthesis. Wrapper around synthesis_gate_decision."""
    should_call, _reason = synthesis_gate_decision(results, threshold)
    return should_call


def deterministic_merge(results: list[ResolvedResult]) -> str:
    """
    Deterministically merge multiple results without an LLM.
    Deduplicates content and merges with source attribution.
    """
    if not results:
        return ""
    if len(results) == 1:
        return results[0].content

    merged = []
    seen_lines: set[str] = set()

    for i, res in enumerate(results):
        lines = res.content.splitlines()
        unique_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped and stripped not in seen_lines:
                unique_lines.append(line)
                seen_lines.add(stripped)
            elif not stripped:
                unique_lines.append("")
        content = "\n".join(unique_lines).strip()
        if content:
            source_label = res.source.replace("_", " ").title()
            merged.append(f"### Source {i + 1}: {source_label}\n{content}")

    return "\n\n---\n\n".join(merged)
