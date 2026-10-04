"""Builds the README artwork in this folder from icons/ and screens/.

    python docs/assets/readme/generate.py

Outputs banner.svg, architecture-{dark,light}.svg and stack-{dark,light}.svg.
Icons and screenshots are embedded as data URIs because GitHub renders SVGs
through <img>, which never loads external files. Screenshots come from
apps/web/scripts/readme-shots (pnpm exec playwright test -c playwright.readme.config.ts).
Icon sources: techicons.dev (Devicon, MIT) and Simple Icons (CC0) for brands
techicons doesn't carry.
"""

from __future__ import annotations

import base64
from pathlib import Path
from xml.sax.saxutils import escape

HERE = Path(__file__).parent
ICONS = HERE / "icons"
SCREENS = HERE / "screens"
FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"

THEMES = {
    "dark": {
        "bg": "#0B0B0D",
        "panel": "#141417",
        "panel2": "#1B1B1F",
        "border": "#2A2A30",
        "text": "#F4F4F5",
        "muted": "#A1A1AA",
        "accent": "#CCFF00",
        "accent_text": "#CCFF00",
        "bar": "#CCFF00",
        "accent_soft": "rgba(204,255,0,0.10)",
        "accent_line": "rgba(204,255,0,0.55)",
        "tile": "#FFFFFF",
        "tile_border": "#FFFFFF",
    },
    "light": {
        "bg": "#FFFFFF",
        "panel": "#F7F7F8",
        "panel2": "#EFEFF1",
        "border": "#E2E2E6",
        "text": "#0B0B0D",
        "muted": "#55555E",
        "accent": "#CCFF00",
        "accent_text": "#4D7C0F",
        "bar": "#65A30D",
        "accent_soft": "rgba(101,163,13,0.10)",
        "accent_line": "rgba(77,124,15,0.55)",
        "tile": "#FFFFFF",
        "tile_border": "#E2E2E6",
    },
}


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def icon(name: str) -> str:
    return data_uri(ICONS / f"{name}.svg", "image/svg+xml")


def t(x, y, s, size=14, weight=400, fill="#000", anchor="start", spacing=None) -> str:
    ls = f' letter-spacing="{spacing}"' if spacing is not None else ""
    return (
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" '
        f'fill="{fill}" text-anchor="{anchor}"{ls}>{escape(s)}</text>'
    )


def tile(x, y, name, th, size=34) -> str:
    pad = size * 0.2
    return (
        f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{size * 0.26}" fill="{th["tile"]}" '
        f'stroke="{th["tile_border"]}"/>'
        f'<image x="{x + pad}" y="{y + pad}" width="{size - 2 * pad}" height="{size - 2 * pad}" href="{icon(name)}"/>'
    )


def tiles(x, y, names, th, size=34, gap=8) -> str:
    return "".join(tile(x + i * (size + gap), y, n, th, size) for i, n in enumerate(names))


def card(x, y, w, h, th, fill=None, stroke=None, rx=16, dash=False) -> str:
    d = ' stroke-dasharray="6 6"' if dash else ""
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill or th["panel"]}" '
        f'stroke="{stroke or th["border"]}"{d}/>'
    )


def chip(x, y, s, th, size=12, h=26, accent=False) -> tuple[str, float]:
    w = len(s) * size * 0.56 + 22
    fill = th["accent_soft"] if accent else th["panel2"]
    stroke = th["accent_line"] if accent else th["border"]
    color = th["accent_text"] if accent else th["text"]
    svg = (
        f'<rect x="{x}" y="{y}" width="{w:.0f}" height="{h}" rx="{h / 2}" fill="{fill}" stroke="{stroke}"/>'
        + t(x + w / 2, y + h / 2 + size * 0.36, s, size, 600, color, "middle")
    )
    return svg, w


def chips(x, y, labels, th, gap=8, **kw) -> str:
    out = []
    for s in labels:
        svg, w = chip(x, y, s, th, **kw)
        out.append(svg)
        x += w + gap
    return "".join(out)


def arrow(x1, y1, x2, y2, th, label=None, both=False) -> str:
    start = ' marker-start="url(#arrow-start)"' if both else ""
    svg = (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{th["accent_line"]}" stroke-width="1.6"'
        f'{start} marker-end="url(#arrow)"/>'
    )
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        w = len(label) * 11 * 0.56 + 18
        svg += (
            f'<rect x="{mx + 10}" y="{my - 11}" width="{w:.0f}" height="22" rx="11" fill="{th["bg"]}" '
            f'stroke="{th["border"]}"/>' + t(mx + 10 + w / 2, my + 4, label, 11, 600, th["muted"], "middle")
        )
    return svg


def defs(th) -> str:
    return (
        "<defs>"
        f'<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
        f'<path d="M0,0 L10,5 L0,10 z" fill="{th["accent_line"]}"/></marker>'
        f'<marker id="arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
        f'<path d="M10,0 L0,5 L10,10 z" fill="{th["accent_line"]}"/></marker>'
        "</defs>"
    )


def heading(x, y, title, sub, th, title_size=17) -> str:
    return t(x, y, title, title_size, 700, th["text"]) + t(x, y + 21, sub, 12.5, 400, th["muted"])


# ── architecture ────────────────────────────────────────────────────────────

def architecture(theme: str) -> str:
    th = THEMES[theme]
    W, H = 1200, 1010
    s = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
        f'role="img" aria-label="MessFit system architecture">',
        "<title>MessFit system architecture</title>",
        defs(th),
        f'<rect width="{W}" height="{H}" rx="24" fill="{th["bg"]}" stroke="{th["border"]}"/>',
        t(40, 52, "SYSTEM ARCHITECTURE", 12, 700, th["accent_text"], spacing=2),
        t(1160, 52, "solid arrows: requests and data flow", 12, 400, th["muted"], "end"),
    ]

    # Row 1: clients + auth
    y1, h1 = 84, 120
    s += [card(40, y1, 440, h1, th), tiles(64, y1 + 22, ["nextjs", "react", "typescript", "tailwindcss", "framer"], th),
          heading(64, y1 + 84, "Student PWA", "Next.js 16 · React 19 · installable, offline-aware", th)]
    s += [card(500, y1, 280, h1, th), tiles(524, y1 + 22, ["nextjs", "react"], th),
          heading(524, y1 + 84, "Admin console", "Menus · dishes · OCR review", th)]
    s += [card(820, y1, 340, h1, th), tiles(844, y1 + 22, ["supabase"], th),
          heading(844, y1 + 84, "Supabase Auth", "Sign-in · ES256 JWTs, verified via JWKS", th)]
    s.append(arrow(780, y1 + h1 / 2, 818, y1 + h1 / 2, th))

    # Row 2: API
    ya, ha = 270, 316
    s.append(arrow(260, y1 + h1, 260, ya - 2, th, "HTTPS · Bearer JWT · SSE"))
    s.append(arrow(640, y1 + h1, 640, ya - 2, th))
    s.append(arrow(990, y1 + h1, 990, ya - 2, th, "public keys (JWKS)"))
    s += [card(40, ya, 1120, ha, th, stroke=th["accent_line"], rx=20),
          tiles(64, ya + 22, ["fastapi", "python", "pydantic", "sqlalchemy"], th, size=38),
          t(64 + 4 * 46 + 12, ya + 40, "MessFit API", 20, 800, th["text"]),
          t(64 + 4 * 46 + 12, ya + 60, "FastAPI modular monolith · async SQLAlchemy 2 · Pydantic v2", 12.5, 400, th["muted"])]
    s.append(chips(64, ya + 78, ["JWT verify (JWKS)", "RLS identity per request", "Per-route rate limits",
                                 "Upload validation", "OpenTelemetry spans"], th, accent=True))
    modules = [
        ("Plate optimizer", "PuLP / CBC MILP over today's menu"),
        ("Goal engine", "Mifflin-St Jeor → TDEE → macros"),
        ("Mess & menus", "Per-hostel menus · photo OCR"),
        ("Tracking & progress", "Meals, weight, streaks, adaptive TDEE"),
        ("Workouts", "Hostel templates · progression"),
        ("AI coach", "RAG over /learn · SSE · guardrails"),
        ("Notifications", "Web Push · weekly check-in"),
        ("Analytics", "Opt-out events · 180-day retention"),
        ("Account", "DPDP deletion with grace period"),
    ]
    mw, mh, gx, gy = 349, 50, 12, 10
    for i, (title, sub) in enumerate(modules):
        mx = 64 + (i % 3) * (mw + gx)
        my = ya + 122 + (i // 3) * (mh + gy)
        s += [card(mx, my, mw, mh, th, fill=th["panel2"], rx=12),
              f'<rect x="{mx + 14}" y="{my + 17}" width="4" height="16" rx="2" fill="{th["bar"]}"/>',
              t(mx + 28, my + 22, title, 13.5, 700, th["text"]), t(mx + 28, my + 39, sub, 11.5, 400, th["muted"])]

    # Row 3: data + services
    yd, hd = 652, 132
    cw, cg = 265, 20
    cols = [40 + i * (cw + cg) for i in range(4)]
    data = [
        (["postgresql", "supabase"], "Postgres on Supabase", ["RLS on every user table", "pgvector · pg_trgm · Alembic"]),
        (["redis"], "Redis", ["Celery broker · optimizer cache", "Rate-limit counters"]),
        (["gemini", "google"], "Gemini · Groq", ["Embeddings, answers, menu OCR", "Groq Llama as fallback"]),
        (["supabase", "pwa"], "Storage · Web Push", ["Private menu-photo bucket", "VAPID push to browsers"]),
    ]
    labels = ["messfit_app (RLS)", None, None, None]
    for x, (ics, title, lines), label in zip(cols, data, labels):
        s.append(arrow(x + cw / 2, ya + ha, x + cw / 2, yd - 2, th, label))
        s += [card(x, yd, cw, hd, th), tiles(x + 20, yd + 18, ics, th, size=32),
              t(x + 20, yd + 78, title, 15, 700, th["text"]),
              t(x + 20, yd + 99, lines[0], 12, 400, th["muted"]), t(x + 20, yd + 116, lines[1], 12, 400, th["muted"])]

    # Row 4: workers + observability
    yw, hw = 850, 124
    s.append(arrow(cols[1] + cw / 2, yd + hd, cols[1] + cw / 2, yw - 2, th, "jobs"))
    s.append(arrow(cols[0] + cw / 2, yd + hd + 2, cols[0] + cw / 2, yw - 2, th, "messfit_worker", both=True))
    s += [card(40, yw, 740, hw, th), tiles(64, yw + 20, ["celery", "python"], th, size=32),
          t(64 + 2 * 40 + 10, yw + 36, "Celery worker + beat", 15, 700, th["text"]),
          t(64 + 2 * 40 + 10, yw + 54, "Async jobs and the daily / weekly schedule", 12, 400, th["muted"]),
          chips(64, yw + 74, ["Menu OCR", "DPDP purge · daily", "Analytics prune · daily",
                              "Check-in push · Sun"], th)]
    s += [card(800, yw, 360, hw, th), tiles(824, yw + 20, ["opentelemetry", "grafana", "sentry"], th, size=32),
          t(824, yw + 82, "Observability", 15, 700, th["text"]),
          t(824, yw + 102, "OTel traces → Grafana · Sentry (PII-scrubbed)", 12, 400, th["muted"])]

    s.append("</svg>")
    return "".join(s)


# ── stack board ─────────────────────────────────────────────────────────────

STACK = [
    ("Frontend", [("nextjs", "Next.js 16"), ("react", "React 19"), ("typescript", "TypeScript"),
                  ("tailwindcss", "Tailwind 4"), ("framer", "Framer Motion"), ("pwa", "PWA")]),
    ("Backend", [("python", "Python 3.12"), ("fastapi", "FastAPI"), ("pydantic", "Pydantic"),
                 ("sqlalchemy", "SQLAlchemy 2"), ("celery", "Celery"), ("uv", "uv")]),
    ("Data & AI", [("postgresql", "Postgres"), ("supabase", "Supabase"), ("redis", "Redis"),
                   ("gemini", "Gemini"), ("google", "Vision OCR"), ("swagger", "OpenAPI")]),
    ("Quality & ops", [("pytest", "pytest"), ("playwright", "Playwright"), ("eslint", "ESLint"),
                       ("githubactions", "Actions"), ("docker", "Docker"), ("k6", "k6")]),
    ("Observability", [("opentelemetry", "OpenTelemetry"), ("grafana", "Grafana"), ("prometheus", "Prometheus"),
                       ("sentry", "Sentry"), ("pnpm", "pnpm"), ("nodejs", "Node 24")]),
]


def stack(theme: str) -> str:
    th = THEMES[theme]
    W, row_h, top = 1200, 92, 70
    H = top + len(STACK) * row_h + 24
    s = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
        f'role="img" aria-label="MessFit technology stack">',
        "<title>MessFit technology stack</title>",
        f'<rect width="{W}" height="{H}" rx="24" fill="{th["bg"]}" stroke="{th["border"]}"/>',
        t(40, 46, "TECH STACK", 12, 700, th["accent_text"], spacing=2),
    ]
    for r, (layer, items) in enumerate(STACK):
        y = top + r * row_h
        s += [card(40, y, 1120, row_h - 14, th, rx=14),
              f'<rect x="56" y="{y + 26}" width="4" height="26" rx="2" fill="{th["bar"]}"/>',
              t(72, y + 45, layer, 15, 700, th["text"])]
        for i, (name, label) in enumerate(items):
            x = 214 + i * 154
            s += [tile(x, y + 19, name, th, size=40), t(x + 50, y + 44, label, 12.5, 600, th["text"])]
    s.append("</svg>")
    return "".join(s)


# ── banner ──────────────────────────────────────────────────────────────────

def phone(x, y, w, screen: str, clip_id: str, tilt: float = 0) -> str:
    h = w * 1688 / 780
    r = w * 0.13
    bez = w * 0.035
    href = data_uri(SCREENS / screen, "image/png")
    return (
        f'<g transform="rotate({tilt} {x + w / 2} {y + h / 2})">'
        f'<rect x="{x - bez}" y="{y - bez}" width="{w + 2 * bez}" height="{h + 2 * bez}" rx="{r + bez}" '
        f'fill="#050506" stroke="#3A3A40" stroke-width="1.5"/>'
        f'<clipPath id="{clip_id}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/></clipPath>'
        f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{href}" clip-path="url(#{clip_id})"/>'
        f"</g>"
    )


def banner() -> str:
    W, H = 1280, 440
    accent = "#CCFF00"
    s = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
        f'role="img" aria-label="MessFit: eat smart from what your hostel mess actually serves">',
        "<title>MessFit</title>",
        "<defs>",
        '<radialGradient id="glow" cx="78%" cy="35%" r="55%">'
        '<stop offset="0" stop-color="#CCFF00" stop-opacity="0.22"/><stop offset="1" stop-color="#CCFF00" stop-opacity="0"/>'
        "</radialGradient>",
        '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#0B0B0D"/><stop offset="1" stop-color="#121214"/></linearGradient>',
        '<pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">'
        '<path d="M32 0H0V32" fill="none" stroke="#FFFFFF" stroke-opacity="0.04"/></pattern>',
        f'<clipPath id="frame"><rect width="{W}" height="{H}" rx="28"/></clipPath>',
        "</defs>",
        '<g clip-path="url(#frame)">',
        f'<rect width="{W}" height="{H}" fill="url(#bg)"/>',
        f'<rect width="{W}" height="{H}" fill="url(#grid)"/>',
        f'<rect width="{W}" height="{H}" fill="url(#glow)"/>',
        # logo mark: a plate seen from above
        f'<circle cx="92" cy="108" r="30" fill="none" stroke="{accent}" stroke-width="6"/>',
        f'<circle cx="92" cy="108" r="12" fill="{accent}"/>',
        f'<text x="140" y="126" font-family="{FONT}" font-size="54" font-weight="900" letter-spacing="-2">'
        f'<tspan fill="#FFFFFF">MESS</tspan><tspan fill="{accent}">FIT</tspan></text>',
        t(64, 206, "Eat smart from what your", 40, 800, "#FFFFFF", spacing=-1),
        t(64, 254, "hostel mess actually serves.", 40, 800, "#FFFFFF", spacing=-1),
        t(64, 300, "A constraint-based plate optimizer, AI coach, workouts and progress", 17, 400, "#A1A1AA"),
        t(64, 324, "tracking, built for Indian hostel students.", 17, 400, "#A1A1AA"),
    ]
    x = 64
    for label in ["MILP plate optimizer", "Grounded AI coach", "Installable PWA"]:
        w = len(label) * 13 * 0.58 + 28
        s += [f'<rect x="{x}" y="356" width="{w:.0f}" height="34" rx="17" fill="rgba(204,255,0,0.10)" '
              f'stroke="rgba(204,255,0,0.45)"/>', t(x + w / 2, 378, label, 13, 700, accent, "middle")]
        x += w + 10
    s += [
        phone(1040, 96, 190, "phone-plate.png", "p2", tilt=6),
        phone(830, 60, 200, "phone-today.png", "p1", tilt=-4),
        "</g>",
        f'<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="28" fill="none" stroke="#2A2A30"/>',
        "</svg>",
    ]
    return "".join(s)


# ── metrics strip ───────────────────────────────────────────────────────────
# Keep these in step with the codebase; each is checked when the README changes.

METRICS = [
    ("591", "backend tests", "run under RLS"),
    ("103", "end-to-end tests", "Playwright"),
    ("47", "API endpoints", "11 routers"),
    ("23 / 23", "tables with RLS", "row-level security"),
    ("19", "migrations", "up / down verified"),
    ("50", "optimizer scenarios", "evaluated in CI"),
]


def metrics(theme: str) -> str:
    th = THEMES[theme]
    W, H = 1200, 132
    cw = (W - 80 - 5 * 12) / 6
    s = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
        f'role="img" aria-label="MessFit by the numbers">',
        "<title>MessFit by the numbers</title>",
    ]
    for i, (value, label, sub) in enumerate(METRICS):
        x = 40 + i * (cw + 12)
        s += [card(x, 16, cw, 100, th, rx=14),
              f'<rect x="{x + 18}" y="34" width="22" height="3" rx="1.5" fill="{th["bar"]}"/>',
              t(x + 18, 72, value, 28, 800, th["text"], spacing=-0.5),
              t(x + 18, 92, label, 12.5, 600, th["text"]),
              t(x + 18, 107, sub, 11, 400, th["muted"])]
    s.append("</svg>")
    return "".join(s)


# ── heading / feature glyphs ────────────────────────────────────────────────
# Lucide (ISC) line icons on a dark tile with the app's lime stroke. One file
# per icon, readable on GitHub's light and dark themes alike.

GLYPHS = HERE / "glyphs"


def glyph_tile(name: str) -> str:
    raw = (GLYPHS / f"{name}.svg").read_text(encoding="utf-8")
    inner = raw[raw.index(">", raw.index("<svg")) + 1 : raw.rindex("</svg>")]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        '<stop offset="0" stop-color="#1F1F23"/><stop offset="1" stop-color="#111113"/></linearGradient></defs>'
        '<rect x="0.5" y="0.5" width="47" height="47" rx="12" fill="url(#g)" stroke="#34343B"/>'
        '<g transform="translate(12 12)" fill="none" stroke="#CCFF00" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">{inner}</g></svg>'
    )


def main() -> None:
    out = HERE / "glyph-tiles"
    out.mkdir(exist_ok=True)
    for src in sorted(GLYPHS.glob("*.svg")):
        (out / src.name).write_text(glyph_tile(src.stem), encoding="utf-8")
    (HERE / "banner.svg").write_text(banner(), encoding="utf-8")
    for theme in THEMES:
        (HERE / f"architecture-{theme}.svg").write_text(architecture(theme), encoding="utf-8")
        (HERE / f"stack-{theme}.svg").write_text(stack(theme), encoding="utf-8")
        (HERE / f"metrics-{theme}.svg").write_text(metrics(theme), encoding="utf-8")
    for p in sorted(HERE.glob("*.svg")):
        print(f"{p.name:28} {p.stat().st_size / 1024:7.1f} KB")


if __name__ == "__main__":
    main()
