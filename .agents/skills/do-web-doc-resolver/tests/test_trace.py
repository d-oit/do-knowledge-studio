"""
Tests for trace-based evaluation.
"""

import json
import subprocess
import sys

from scripts.models import Profile, ResolutionTrace, TraceStep
from scripts.resolve import resolve_query_stream, resolve_url_stream


class TestTraceStep:
    """Tests for TraceStep dataclass."""

    def test_create_minimal(self):
        """Should create with required fields only."""
        step = TraceStep(tool="jina", duration_ms=150, success=True)
        assert step.tool == "jina"
        assert step.duration_ms == 150
        assert step.success is True
        assert step.cache_hit is False
        assert step.quality_score == 0.0
        assert step.error is None
        assert step.content_length == 0

    def test_create_full(self):
        """Should create with all fields populated."""
        step = TraceStep(
            tool="exa",
            duration_ms=300,
            success=True,
            cache_hit=True,
            quality_score=0.85,
            content_length=4500,
        )
        assert step.tool == "exa"
        assert step.duration_ms == 300
        assert step.success is True
        assert step.cache_hit is True
        assert step.quality_score == 0.85
        assert step.error is None
        assert step.content_length == 4500

    def test_create_with_error(self):
        """Should create with error field."""
        step = TraceStep(
            tool="tavily",
            duration_ms=500,
            success=False,
            error="Rate limited",
        )
        assert step.success is False
        assert step.error == "Rate limited"

    def test_to_dict(self):
        """Should serialize to dict via __dict__."""
        step = TraceStep(
            tool="duckduckgo",
            duration_ms=200,
            success=True,
            cache_hit=False,
            quality_score=0.7,
            content_length=1200,
        )
        d = step.__dict__
        assert d["tool"] == "duckduckgo"
        assert d["duration_ms"] == 200
        assert d["success"] is True
        assert d["cache_hit"] is False
        assert d["quality_score"] == 0.7
        assert d["content_length"] == 1200
        assert d["error"] is None

    def test_to_dict_is_json_serializable(self):
        """Should produce JSON-serializable dict."""
        step = TraceStep(tool="jina", duration_ms=100, success=True)
        d = step.__dict__
        json_str = json.dumps(d)
        parsed = json.loads(json_str)
        assert parsed["tool"] == "jina"


class TestResolutionTrace:
    """Tests for ResolutionTrace dataclass."""

    def test_create_minimal(self):
        """Should create with required fields."""
        trace = ResolutionTrace(
            trace_id="abc-123",
            input="https://example.com",
            is_url=True,
            profile="balanced",
        )
        assert trace.trace_id == "abc-123"
        assert trace.input == "https://example.com"
        assert trace.is_url is True
        assert trace.profile == "balanced"
        assert trace.steps == []
        assert trace.total_latency_ms == 0
        assert trace.final_source == "none"
        assert trace.final_score == 0.0
        assert trace.success is False

    def test_create_for_query(self):
        """Should create for query input."""
        trace = ResolutionTrace(
            trace_id="xyz-789",
            input="Python docs",
            is_url=False,
            profile="fast",
        )
        assert trace.is_url is False
        assert trace.profile == "fast"

    def test_add_steps(self):
        """Should accumulate steps."""
        trace = ResolutionTrace(
            trace_id="t1", input="test", is_url=True, profile="free"
        )
        trace.steps.append(TraceStep(tool="llms_txt", duration_ms=50, success=True))
        trace.steps.append(TraceStep(tool="jina", duration_ms=100, success=False))
        assert len(trace.steps) == 2

    def test_to_dict_empty_steps(self):
        """Should serialize with empty steps."""
        trace = ResolutionTrace(
            trace_id="t1", input="test", is_url=True, profile="balanced"
        )
        d = trace.to_dict()
        assert d["trace_id"] == "t1"
        assert d["input"] == "test"
        assert d["is_url"] is True
        assert d["profile"] == "balanced"
        assert d["steps"] == []
        assert d["total_latency_ms"] == 0
        assert d["final_source"] == "none"
        assert d["final_score"] == 0.0
        assert d["success"] is False

    def test_to_dict_with_steps(self):
        """Should serialize steps as list of dicts."""
        trace = ResolutionTrace(
            trace_id="t2", input="test", is_url=False, profile="quality"
        )
        trace.steps.append(
            TraceStep(tool="exa_mcp", duration_ms=200, success=True, quality_score=0.9)
        )
        trace.total_latency_ms = 200
        trace.final_source = "exa_mcp"
        trace.final_score = 0.9
        trace.success = True

        d = trace.to_dict()
        assert len(d["steps"]) == 1
        assert d["steps"][0]["tool"] == "exa_mcp"
        assert d["steps"][0]["quality_score"] == 0.9
        assert d["total_latency_ms"] == 200
        assert d["final_source"] == "exa_mcp"
        assert d["final_score"] == 0.9
        assert d["success"] is True

    def test_to_dict_is_json_serializable(self):
        """Should produce fully JSON-serializable output."""
        trace = ResolutionTrace(
            trace_id="t3", input="test", is_url=True, profile="balanced"
        )
        trace.steps.append(
            TraceStep(tool="jina", duration_ms=100, success=True, error=None)
        )
        trace.total_latency_ms = 100
        trace.final_source = "jina"
        trace.success = True

        json_str = json.dumps(trace.to_dict())
        parsed = json.loads(json_str)
        assert parsed["trace_id"] == "t3"
        assert len(parsed["steps"]) == 1


class TestTraceEmission:
    """Tests that traces are emitted during resolution."""

    def test_url_stream_emits_trace_when_enabled(self):
        """resolve_url_stream should include trace in output when trace is passed."""
        trace = ResolutionTrace(
            trace_id="trace-url-1",
            input="https://example.com",
            is_url=True,
            profile="fast",
        )
        results = list(resolve_url_stream("https://example.com", profile=Profile.FAST, trace=trace))
        assert len(results) > 0
        final = results[-1]
        if final.get("source") != "none":
            assert "trace" in final
            assert final["trace"]["trace_id"] == "trace-url-1"
            assert final["trace"]["success"] is True

    def test_query_stream_emits_trace_when_enabled(self):
        """resolve_query_stream should include trace in output when trace is passed."""
        trace = ResolutionTrace(
            trace_id="trace-query-1",
            input="test query",
            is_url=False,
            profile="fast",
        )
        results = list(resolve_query_stream("test query", profile=Profile.FAST, trace=trace))
        assert len(results) > 0
        final = results[-1]
        if final.get("source") != "none":
            assert "trace" in final
            assert final["trace"]["trace_id"] == "trace-query-1"

    def test_url_stream_no_trace_when_disabled(self):
        """resolve_url_stream should not include trace when trace is None."""
        results = list(resolve_url_stream("https://example.com", profile=Profile.FAST))
        assert len(results) > 0
        final = results[-1]
        assert "trace" not in final

    def test_query_stream_no_trace_when_disabled(self):
        """resolve_query_stream should not include trace when trace is None."""
        results = list(resolve_query_stream("test query", profile=Profile.FAST))
        assert len(results) > 0
        final = results[-1]
        assert "trace" not in final

    def test_trace_records_steps_on_success(self):
        """Trace should record at least one step on successful resolution."""
        trace = ResolutionTrace(
            trace_id="trace-steps-1",
            input="test query",
            is_url=False,
            profile="fast",
        )
        results = list(resolve_query_stream("test query", profile=Profile.FAST, trace=trace))
        final = results[-1]
        if final.get("source") != "none":
            t = final["trace"]
            assert len(t["steps"]) >= 1
            assert t["success"] is True
            assert t["final_source"] != "none"

    def test_trace_populates_total_latency(self):
        """Trace should have non-zero latency on completion."""
        trace = ResolutionTrace(
            trace_id="trace-latency-1",
            input="test query",
            is_url=False,
            profile="fast",
        )
        results = list(resolve_query_stream("test query", profile=Profile.FAST, trace=trace))
        final = results[-1]
        if final.get("source") != "none":
            t = final["trace"]
            assert t["total_latency_ms"] > 0


class TestCLITraceFlag:
    """Tests for --trace CLI flag."""

    def test_trace_flag_produces_json_with_trace(self):
        """--trace --json should output JSON containing trace field."""
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.resolve",
                "--json",
                "--trace",
                "--profile",
                "fast",
                "test query",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            output = result.stdout
            parsed = json.loads(output)
            assert "trace" in parsed
            assert "trace_id" in parsed["trace"]
            assert "steps" in parsed["trace"]
            assert "total_latency_ms" in parsed["trace"]

    def test_trace_flag_produces_valid_json(self):
        """--trace --json should produce valid JSON."""
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.resolve",
                "--json",
                "--trace",
                "--profile",
                "fast",
                "test query",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            parsed = json.loads(result.stdout)
            assert isinstance(parsed, dict)

    def test_no_trace_flag_omits_trace(self):
        """Without --trace, output should not contain trace field."""
        result = subprocess.run(
            [
                sys.executable,
                "-m",
                "scripts.resolve",
                "--json",
                "--profile",
                "fast",
                "test query",
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            parsed = json.loads(result.stdout)
            assert "trace" not in parsed
