#!/usr/bin/env python3
"""Warm the Web Doc Resolver cache by resolving a list of URLs/queries.

Each item is resolved through the resolver pipeline so subsequent lookups
hit the on-disk cache (`~/.cache/do-web-doc-resolver` by default, overridable
via `WEB_RESOLVER_CACHE_DIR`).

Usage (from the skill directory):

    python -m scripts.warm_cache "topic one" "topic two"
    python -m scripts.warm_cache --file queries.txt
    python -m scripts.warm_cache --file queries.txt --dry-run

Network access is required unless `--dry-run` is used. The resolver Python
dependencies are imported lazily so `--help` and `--dry-run` work without
them installed.
"""

import argparse
import sys
from pathlib import Path


def load_items(path: str) -> list[str]:
    """Read one item per line; blank lines and #-comments are ignored."""
    text = Path(path).read_text(encoding="utf-8")
    return [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]


def _resolve_item(item: str, max_chars: int, profile_name: str) -> None:
    # Lazy imports keep --help/--dry-run usable without resolver deps.
    from .models import Profile  # type: ignore[import-not-found]
    from .resolve import resolve  # type: ignore[import-not-found]

    resolve(item, max_chars=max_chars, profile=Profile(profile_name))


def main() -> int:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.warm_cache",
        description="Warm the Web Doc Resolver cache by resolving URLs/queries.",
    )
    parser.add_argument("items", nargs="*", help="URLs or queries to resolve")
    parser.add_argument("--file", help="Read items from a file (one per line, # comments ignored)")
    parser.add_argument("--dry-run", action="store_true", help="List items without resolving")
    parser.add_argument("--max-chars", type=int, default=8000, help="Max content length to retain (default: 8000)")
    parser.add_argument("--profile", default="balanced", help="Resolution profile: free, balanced, or quality (default: balanced)")
    args = parser.parse_args()

    items = list(args.items)
    if args.file:
        try:
            items += load_items(args.file)
        except FileNotFoundError:
            parser.error(f"file not found: {args.file}")

    if not items:
        parser.error("no items given (pass arguments or use --file)")

    if args.dry_run:
        for item in items:
            print(f"would warm: {item}")
        print(f"{len(items)} item(s) would be warmed")
        return 0

    for item in items:
        try:
            _resolve_item(item, args.max_chars, args.profile)
        except ImportError as exc:
            print(f"error: resolver dependencies missing ({exc})", file=sys.stderr)
            print(
                "install them with: pip install -r .agents/skills/do-web-doc-resolver/requirements.txt",
                file=sys.stderr,
            )
            return 1
        print(f"warmed: {item}")
    print(f"warmed {len(items)} item(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
