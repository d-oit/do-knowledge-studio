#!/usr/bin/env python3
"""
generate_diagram.py — Project architecture SVG generator
Scans the live project structure and writes an architecture diagram.

Usage:
    python generate_diagram.py [--root .] [--out docs/architecture.svg]
"""
import argparse
import json
import re
from pathlib import Path


# ── Default config ─────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "title": "Project Architecture",
    "project_name": "My Project",
    "author": "maintainer",
    "pipeline_stages": [
        {"name": "build", "color": "teal"},
        {"name": "test", "color": "blue"},
        {"name": "deploy", "color": "green"},
    ],
}

# ── Color palette (light 50, border 600, text 800) ─────────────────────────

COLORS = {
    "teal":   {"fill": "#E1F5EE", "stroke": "#0F6E56", "text": "#085041"},
    "blue":   {"fill": "#E6F1FB", "stroke": "#185FA5", "text": "#0C447C"},
    "purple": {"fill": "#EEEDFE", "stroke": "#534AB7", "text": "#3C3489"},
    "green":  {"fill": "#EAF3DE", "stroke": "#3B6D11", "text": "#27500A"},
    "gray":   {"fill": "#F1EFE8", "stroke": "#5F5E5A", "text": "#444441"},
}


# ── Discovery helpers ──────────────────────────────────────────────────────

def _read_frontmatter_name(path: Path) -> str:
    """Extract `name:` from YAML frontmatter, or fall back to stem."""
    try:
        content = path.read_text(encoding="utf-8")
        if content.startswith("---"):
            block = content.split("---", 2)[1]
            m = re.search(r"^name:\s*(.+)$", block, re.MULTILINE)
            if m:
                return m.group(1).strip().strip('"').strip("'")
    except Exception:
        pass
    return path.stem


def discover_skills(root: Path) -> list[str]:
    skills_dir = root / ".agents" / "skills"
    if not skills_dir.is_dir():
        return []
    names = []
    for skill_dir in sorted(skills_dir.iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if skill_dir.is_dir() and skill_md.exists():
            names.append(_read_frontmatter_name(skill_md))
    return names


def discover_agents(root: Path) -> list[str]:
    agents_dir = root / ".opencode" / "agents"
    if not agents_dir.is_dir():
        return []
    return sorted(p.stem for p in agents_dir.glob("*.md"))


def discover_commands(root: Path) -> list[str]:
    commands_dir = root / ".opencode" / "commands"
    if not commands_dir.is_dir():
        return []
    names = []
    for p in sorted(commands_dir.glob("*.md")):
        stem = p.stem
        names.append(stem if stem.startswith("/") else "/" + stem)
    return names


# ── SVG helpers ───────────────────────────────────────────────────────────

def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _rect(x, y, w, h, rx=4, fill="#F1EFE8", stroke="#5F5E5A", sw=0.5,
          dash=False) -> str:
    dash_attr = ' stroke-dasharray="4 3"' if dash else ""
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash_attr}/>')


def _text(x, y, content, anchor="middle", cls="ts", dy=None) -> str:
    dy_attr = f' dy="{dy}"' if dy else ""
    return (f'<text class="{cls}" x="{x}" y="{y}" '
            f'text-anchor="{anchor}" dominant-baseline="central"{dy_attr}>'
            f'{_esc(content)}</text>')


def _line(x1, y1, x2, y2, cls="arr", arrow=True) -> str:
    marker = ' marker-end="url(#arrow)"' if arrow else ""
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" class="{cls}"{marker}/>'


def _section_line(y) -> str:
    return (f'<line x1="20" y1="{y}" x2="660" y2="{y}" '
            f'stroke="#ccc" stroke-width="0.5" opacity="0.18"/>')


def _container(x, y, w, h, label, sublabel=None) -> str:
    c = COLORS["gray"]
    parts = [
        _rect(x, y, w, h, rx=6, fill="none", stroke=c["stroke"],
              sw=0.5, dash=True),
        _text(x + w // 2, y + 14, label, cls="th"),
    ]
    if sublabel:
        parts.append(_text(x + w // 2, y + 28, sublabel, cls="ts"))
    return "\n".join(parts)


def _pill(x, y, w, h, label) -> str:
    c = COLORS["gray"]
    return "\n".join([
        _rect(x, y, w, h, rx=h // 2, fill=c["fill"], stroke=c["stroke"]),
        _text(x + w // 2, y + h // 2, label, cls="ts"),
    ])


# ── Main SVG builder ──────────────────────────────────────────────────────

DEFS = """<defs>
<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5"
  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
  <path d="M2 1L8 5L2 9" fill="none" stroke="#888"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</marker>
<style>
  .th{font-family:system-ui,sans-serif;font-size:14px;font-weight:500;fill:#1a1a1a}
  .ts{font-family:system-ui,sans-serif;font-size:12px;font-weight:400;fill:#555}
  .arr{fill:none;stroke:#888;stroke-width:1.2}
  .leader{fill:none;stroke:#aaa;stroke-width:0.5;stroke-dasharray:3 3}
</style>
</defs>"""


def build_svg(cfg: dict, skills: list[str], agents: list[str],
              commands: list[str]) -> str:
    parts: list[str] = []
    y = 0

    def push(s: str):
        parts.append(s)

    def vskip(n: int):
        nonlocal y
        y += n

    # ── Title ───────────────────────────────────────────────────────────
    y = 28
    push(_text(340, y, cfg["title"], cls="th"))
    y += 10
    push(f'<line x1="60" y1="{y}" x2="620" y2="{y}" '
         f'stroke="#ccc" stroke-width="0.5" opacity="0.4"/>')

    # ── Pipeline stages ───────────────────────────────────────────────────
    y += 16
    push(f'<text class="ts" x="21" y="{y}" opacity="0.55">'
         f'Workflow pipeline</text>')

    stages = cfg.get("pipeline_stages", [])
    if stages:
        row_h = 36
        gap = 12
        bw = min(140, (640 - (len(stages) - 1) * gap) // len(stages))
        x = 21
        prev_right = None
        for s in stages:
            c = COLORS.get(s.get("color", "teal"), COLORS["teal"])
            push(_rect(x, y, bw, row_h, fill=c["fill"], stroke=c["stroke"]))
            push(_text(x + bw // 2, y + row_h // 2, s["name"], cls="ts"))
            if prev_right is not None:
                push(_line(prev_right, y + row_h // 2,
                           prev_right + gap, y + row_h // 2))
            prev_right = x + bw
            x += bw + gap
        y += row_h

    # ── Section divider ──────────────────────────────────────────────────
    y += 10
    push(_section_line(y))
    section_top = y + 6

    # ── Skills | Agents ───────────────────────────────────────────────────
    col_w = 310
    skills_x = 20
    agents_x = skills_x + col_w + 20

    row_h = 17
    max_rows = max(len(skills), len(agents), 5)
    col_h = 32 + max_rows * row_h + 10

    # Skills container
    push(_container(skills_x, section_top, col_w, col_h,
                    f"{len(skills)} skills", ".agents/skills/"))
    for i, sk in enumerate(skills):
        push(f'<text class="ts" x="{skills_x+12}" '
             f'y="{section_top+44+i*row_h}">{_esc(sk)}</text>')

    # Agents container
    push(_container(agents_x, section_top, col_w, col_h,
                    f"{len(agents)} agents", ".opencode/agents/"))
    for i, ag in enumerate(agents):
        push(f'<text class="ts" x="{agents_x+12}" '
             f'y="{section_top+44+i*row_h}">{_esc(ag)}</text>')

    y = section_top + col_h + 10

    # ── Section divider ──────────────────────────────────────────────────
    push(_section_line(y))
    y += 8

    # ── Commands ─────────────────────────────────────────────────────────
    push(_text(340, y + 12, f"{len(commands)} slash commands", cls="th"))
    push(_text(340, y + 26, ".opencode/commands/", cls="ts"))
    y += 36

    # Pills in 2 columns
    show_cmds = commands[:10]
    extra = len(commands) - len(show_cmds)
    pill_w = 300
    pill_h = 20
    pill_gap = 4
    col2_x = 350

    for i, cmd in enumerate(show_cmds):
        col = i % 2
        row = i // 2
        cx = 20 if col == 0 else col2_x
        cy = y + row * (pill_h + pill_gap)
        push(_pill(cx, cy, pill_w, pill_h, cmd))

    y += (len(show_cmds) // 2 + (len(show_cmds) % 2)) * (pill_h + pill_gap) + 4
    if extra > 0:
        push(_text(340, y + 6, f"+ {extra} more commands", cls="ts"))
        y += 16

    # ── Footer ───────────────────────────────────────────────────────────
    y += 16
    footer = f'{cfg.get("project_name", "Project")} · {cfg.get("author", "maintainer")}'
    push(f'<text class="ts" x="{340}" y="{y}" '
         f'text-anchor="middle" opacity="0.32">{_esc(footer)}</text>')
    y += 20

    # assemble
    viewbox_h = y
    svg = (f'<svg width="100%" viewBox="0 0 680 {viewbox_h}" '
           f'xmlns="http://www.w3.org/2000/svg">\n'
           f'{DEFS}\n' +
           "\n".join(parts) +
           "\n</svg>")
    return svg


# ── Entry point ───────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate architecture SVG")
    parser.add_argument("--root", default=".", help="Project root directory")
    parser.add_argument("--out", default="docs/architecture.svg",
                        help="Output SVG path")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    out_path = Path(args.out) if Path(args.out).is_absolute() \
        else root / args.out

    # Load config
    cfg_path = root / "docs" / "diagram-config.json"
    cfg = dict(DEFAULT_CONFIG)
    if cfg_path.exists():
        with open(cfg_path, encoding="utf-8") as f:
            cfg.update(json.load(f))

    # Discover
    skills = discover_skills(root)
    agents = discover_agents(root)
    commands = discover_commands(root)

    print(f"Found: {len(skills)} skills, {len(agents)} agents, "
          f"{len(commands)} commands")

    # Fallback to defaults if dirs missing
    if not skills:
        print("  [warn] no skills found — using placeholder list")
        skills = ["(no skills found)"]
    if not agents:
        print("  [warn] no agents found — using placeholder list")
        agents = ["(no agents found)"]
    if not commands:
        print("  [warn] no commands found — using placeholder list")
        commands = ["/no-commands"]

    svg = build_svg(cfg, skills, agents, commands)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(svg, encoding="utf-8")
    print(f"Written: {out_path}")

    return 0


if __name__ == "__main__":
    exit(main())