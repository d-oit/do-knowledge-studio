#!/usr/bin/env python3
"""Render the Knowledge Studio PWA raster icons from the shipped logo mark.

`public/logo.svg` uses `currentColor` plus a `prefers-color-scheme` media
query, neither of which a manifest icon can carry. Chrome and Android require
real raster PNGs at 192x192 and 512x512 for installability, so the mark is
rasterized here from the same 30x30 viewBox geometry with the light-theme
saffron accent resolved explicitly.

The maskable variant scales the artwork into the 80% safe zone so a circular
or squircle launcher mask never clips the mark.

Usage:  python3 scripts/generate-pwa-icons.py
Output: public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

# --- Design tokens (mirrors the light theme in src/app/globals.css) ---------
BACKGROUND = (0xFA, 0xF8, 0xF3)
INK = (0x1F, 0x1D, 0x1A)
SAFFRON = (0xC7, 0x7D, 0x3A)

VIEWBOX = 30.0

# The outer diamond and the accent node, in logo.svg's 30x30 viewBox units.
DIAMOND = [(15, 2.5), (26.5, 9), (26.5, 21), (15, 27.5), (3.5, 21), (3.5, 9)]
ACCENT_NODE = (15.0, 11.0, 3.2)  # cx, cy, r

# Radiating connection lines: (x1, y1, x2, y2, opacity).
SPOKES = [
    (15, 11, 8, 7, 0.4),
    (15, 11, 22, 7, 0.4),
    (15, 11, 15, 18, 0.3),
]

SPOKE_WIDTH = 1.0

# Fraction of the canvas the maskable artwork occupies (PWA safe zone is 80%).
MASKABLE_INSET = 0.8

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public"

SIZES = (("icon-192.png", 192, 1.0), ("icon-512.png", 512, 1.0),
         ("icon-maskable-512.png", 512, MASKABLE_INSET))


def _blend(base: tuple[int, int, int], color: tuple[int, int, int],
           alpha: float) -> tuple[int, int, int]:
    """Composites `color` over `base` at `alpha` (0..1)."""
    return tuple(round(c * alpha + b * (1 - alpha)) for c, b in zip(color, base))


def _inside_polygon(px: float, py: float, pts: list[tuple[float, float]]) -> bool:
    """Even-odd ray-cast point-in-polygon test."""
    inside = False
    count = len(pts)
    for i in range(count):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % count]
        if (y1 > py) != (y2 > py):
            crossing_x = (x2 - x1) * (py - y1) / (y2 - y1) + x1
            if px < crossing_x:
                inside = not inside
    return inside


def _distance_to_segment(px: float, py: float,
                         x1: float, y1: float,
                         x2: float, y2: float) -> float:
    """Shortest distance from a point to a line segment."""
    dx, dy = x2 - x1, y2 - y1
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / length_sq))
    return ((px - (x1 + t * dx)) ** 2 + (py - (y1 + t * dy)) ** 2) ** 0.5


def _sample(px: float, py: float, diamond: list[tuple[float, float]],
            node: tuple[float, float, float]) -> tuple[int, int, int]:
    """Returns the composited color at a point, sampling with 2x2 supersampling."""
    color = BACKGROUND
    cx, cy, radius = node
    for y in (py - 0.25, py + 0.25):
        for x in (px - 0.25, px + 0.25):
            sample = BACKGROUND
            if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius:
                sample = SAFFRON
            elif _inside_polygon(x, y, diamond):
                sample = INK
                for x1, y1, x2, y2, opacity in SPOKES:
                    if _distance_to_segment(x, y, x1, y1, x2, y2) <= SPOKE_WIDTH / 2:
                        sample = _blend(sample, SAFFRON, opacity)
            color = _blend(color, sample, 0.25)
    return color


def render(size: int, inset_scale: float) -> bytes:
    """Rasterizes the mark at `size` x `size` as a PNG byte string."""
    scale = (size / VIEWBOX) * inset_scale
    offset = (size - VIEWBOX * scale) / 2.0
    diamond = [(x * scale + offset, y * scale + offset) for x, y in DIAMOND]
    node = (ACCENT_NODE[0] * scale + offset,
            ACCENT_NODE[1] * scale + offset,
            ACCENT_NODE[2] * scale)

    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            row += bytes(_sample(px + 0.5, py + 0.5, diamond, node)) + b"\xff"
        rows.append(row)

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return (struct.pack(">I", len(data)) + body
                + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF))

    raw = b"".join(b"\x00" + bytes(row) for row in rows)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def main() -> None:
    for filename, size, inset in SIZES:
        path = OUTPUT_DIR / filename
        path.write_bytes(render(size, inset))
        print(f"wrote {path.relative_to(OUTPUT_DIR.parent)} ({size}x{size})")


if __name__ == "__main__":
    main()
