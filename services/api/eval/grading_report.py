"""Generate a human-readable grading report for the 50 eval scenarios.

The property tests (``test_optimizer.py``) prove every plate is *safe and
valid* — in the kcal band, no banned allergens, diet respected, caps held.
They cannot prove a plate is *good*. That judgement is the nutritionist's,
and this report is what they grade against.

For each scenario it runs the real solver and lays out, in plain language:
  * who the user is and the targets the goal engine set for them,
  * the exact plate the optimizer chose (dishes, portions, macros),
  * any canteen top-ups it suggested,
  * achieved-vs-target for all four macros.

Outputs (git-ignored, regenerate any time):
  eval/reports/grading_report.html  — open in a browser; read/print/annotate
  eval/reports/grading_sheet.csv    — one row per scenario; fill in Grade + Notes

Usage:
    uv run python eval/grading_report.py

Re-run after any solver change to re-grade against the new plates.
"""

from __future__ import annotations

import csv
import html
import json
from datetime import datetime, timezone
from pathlib import Path

from messfit_api.optimizer import optimize
from messfit_api.optimizer.solver import SOLVER_VERSION

from .loader import all_scenario_paths, load_scenario_file

_REPORTS_DIR = Path(__file__).resolve().parent / "reports"
_MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner"]
_MACROS = [
    ("kcal", "kcal", ""),
    ("protein_g", "Protein", "g"),
    ("carbs_g", "Carbs", "g"),
    ("fats_g", "Fats", "g"),
]

# kcal hard band the solver enforces (mirror of solver.KCAL_LOWER/UPPER).
_KCAL_BAND = (0.90, 1.10)


def _esc(s: object) -> str:
    return html.escape(str(s))


def _profile_line(user: dict) -> str:
    bits = [
        f"{user['sex']}, {user['age']}y, {user['height_cm']}cm, {user['weight_kg']}kg",
        f"goal: <b>{user['goal']}</b>"
        + (
            f" @ {user['target_rate_kg_per_week']:+g} kg/wk"
            if user.get("target_rate_kg_per_week")
            else ""
        ),
        f"activity {user['activity_level']}/5",
        f"diet: <b>{user['diet_type']}</b>",
    ]
    if user.get("allergies"):
        bits.append(f"allergies: {', '.join(user['allergies'])}")
    if user.get("conditions"):
        bits.append(f"conditions: {', '.join(user['conditions'])}")
    bits.append(f"canteen budget: ₹{user.get('canteen_budget_inr', 0)}")
    return (
        _esc(" · ".join(b for b in bits)).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")
    )


def _macro_table(totals: dict, targets: dict, protein_floor: float) -> str:
    rows = []
    for key, label, unit in _MACROS:
        got = totals.get(key, 0.0)
        tgt = targets.get(key, 0.0)
        pct = (got / tgt * 100) if tgt else 0.0

        flag = ""
        if key == "kcal" and tgt:
            if not (_KCAL_BAND[0] * tgt <= got <= _KCAL_BAND[1] * tgt):
                flag = ' class="warn"'
        if key == "protein_g" and got < protein_floor:
            flag = ' class="warn"'

        rows.append(
            f"<tr{flag}><td>{label}</td>"
            f"<td class='num'>{got:.0f}{unit}</td>"
            f"<td class='num'>{tgt:.0f}{unit}</td>"
            f"<td class='num'>{pct:.0f}%</td></tr>"
        )
    floor_note = (
        f"<div class='floornote'>Protein floor the eval holds this scenario to: "
        f"<b>{protein_floor:.0f}g</b> "
        f"(goal-engine target {targets.get('protein_g', 0):.0f}g — soft floor, "
        f"unreachable inside the kcal band on this menu)</div>"
    )
    return (
        "<table class='macros'><tr><th>Macro</th><th>Achieved</th>"
        "<th>Target</th><th>% target</th></tr>" + "".join(rows) + "</table>" + floor_note
    )


def _plate_html(plan: dict, gap_fills: list) -> str:
    parts = []
    for meal in _MEAL_ORDER:
        items = plan.get(meal) or []
        if not items:
            continue
        meal_kcal = sum(i.kcal for i in items)
        lis = []
        for i in items:
            portions = f"{i.portions:g}× {i.serving_unit}"
            lis.append(
                f"<li><span class='dish'>{_esc(i.name)}</span> "
                f"<span class='qty'>{_esc(portions)} · {i.grams:.0f}g</span>"
                f"<span class='mac'>{i.kcal:.0f} kcal · "
                f"P{i.protein_g:.0f} C{i.carbs_g:.0f} F{i.fats_g:.0f}</span></li>"
            )
        parts.append(
            f"<div class='meal'><h4>{meal.title()} "
            f"<span class='mealkcal'>{meal_kcal:.0f} kcal</span></h4>"
            f"<ul>{''.join(lis)}</ul></div>"
        )

    if gap_fills:
        lis = []
        for g in gap_fills:
            lis.append(
                f"<li><span class='dish'>{_esc(g.name)}</span> "
                f"<span class='qty'>{g.portions:g}× · ₹{g.cost_inr}</span>"
                f"<span class='mac'>{g.kcal:.0f} kcal · P{g.protein_g:.0f}</span></li>"
            )
        parts.append(
            f"<div class='meal canteen'><h4>Canteen top-ups</h4><ul>{''.join(lis)}</ul></div>"
        )
    return "".join(parts) or "<p class='empty'>No dishes selected.</p>"


_CSS = """
body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;
  max-width:920px;margin:0 auto;padding:32px 20px;background:#fafafa}
h1{font-size:24px;margin:0 0 4px}
.lede{color:#555;margin:0 0 24px}
.howto{background:#fff;border:1px solid #e2e2e2;border-radius:10px;
  padding:14px 18px;margin-bottom:28px;font-size:13px}
.howto b{color:#b45309}
.card{background:#fff;border:1px solid #e2e2e2;border-radius:12px;
  padding:20px 22px;margin-bottom:18px;page-break-inside:avoid}
.card h3{margin:0 0 2px;font-size:16px}
.card .sid{color:#999;font-weight:400;font-size:13px}
.desc{color:#555;font-size:13px;margin:6px 0 12px}
.profile{background:#f6f6f6;border-radius:8px;padding:8px 12px;
  font-size:12.5px;margin-bottom:14px}
.cols{display:flex;gap:24px;flex-wrap:wrap}
.col-plate{flex:1 1 360px}.col-macros{flex:0 0 280px}
table.macros{border-collapse:collapse;width:100%;font-size:13px}
table.macros th,table.macros td{padding:4px 8px;border-bottom:1px solid #eee;text-align:left}
table.macros td.num{text-align:right;font-variant-numeric:tabular-nums}
table.macros tr.warn td{background:#fff4e5;color:#b45309;font-weight:600}
.floornote{font-size:11px;color:#888;margin-top:8px}
.meal h4{margin:10px 0 4px;font-size:13px;text-transform:capitalize}
.mealkcal{color:#999;font-weight:400;font-size:12px}
.meal ul{list-style:none;margin:0;padding:0}
.meal li{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;
  padding:3px 0;border-bottom:1px dotted #eee}
.dish{font-weight:600;flex:1 1 auto}
.qty{color:#666;font-size:12px}.mac{color:#999;font-size:11.5px;width:100%}
.meal.canteen h4{color:#6366f1}
.grade{margin-top:14px;padding-top:12px;border-top:1px dashed #ddd;font-size:13px}
.grade .opts{font-size:16px;letter-spacing:6px}
.grade .notes{display:inline-block;border-bottom:1px solid #bbb;
  min-width:60%;margin-left:8px}
.empty{color:#aaa}
@media print{body{background:#fff}.card,.howto{border-color:#ccc}}
"""


def build() -> tuple[str, list[dict]]:
    scenarios = all_scenario_paths()
    cards = []
    csv_rows = []

    for n, path in enumerate(scenarios, start=1):
        raw = json.loads(path.read_text(encoding="utf-8"))
        s = load_scenario_file(path)
        out = optimize(s.input)

        protein_floor = s.expected.get("protein_min_g", 0.85 * s.daily_protein_g)

        cards.append(
            f"<div class='card'>"
            f"<h3>{n:02d}. {_esc(raw['id'])} "
            f"<span class='sid'>[{_esc(out.solver_status)}]</span></h3>"
            f"<p class='desc'>{_esc(s.description)}</p>"
            f"<div class='profile'>{_profile_line(raw['user'])}</div>"
            f"<div class='cols'>"
            f"<div class='col-plate'>{_plate_html(out.plan, out.gap_fills)}</div>"
            f"<div class='col-macros'>"
            f"{_macro_table(out.daily_totals, out.daily_targets, protein_floor)}"
            f"</div></div>"
            f"<div class='grade'>Grade: "
            f"<span class='opts'>✅&nbsp;&nbsp;⚠️&nbsp;&nbsp;❌</span>"
            f"<span class='notes'>&nbsp;</span></div>"
            f"</div>"
        )

        csv_rows.append(
            {
                "n": f"{n:02d}",
                "id": raw["id"],
                "description": s.description,
                "kcal_target": f"{out.daily_targets['kcal']:.0f}",
                "kcal_achieved": f"{out.daily_totals['kcal']:.0f}",
                "protein_target": f"{out.daily_targets['protein_g']:.0f}",
                "protein_achieved": f"{out.daily_totals['protein_g']:.0f}",
                "grade": "",
                "notes": "",
            }
        )

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    doc = (
        f"<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>MessFit optimizer — nutritionist grading</title>"
        f"<style>{_CSS}</style></head><body>"
        f"<h1>MessFit Optimizer — Plate Grading</h1>"
        f"<p class='lede'>{len(scenarios)} scenarios · solver v{SOLVER_VERSION} · "
        f"generated {generated}</p>"
        f"<div class='howto'>For each plate, mark <b>✅</b> (would prescribe as-is), "
        f"<b>⚠️</b> (acceptable but I'd tweak), or <b>❌</b> (would not give a student "
        f"this) and add a note. Goal: ≥90% ✅. The macro table flags (amber) any "
        f"plate outside the kcal band or under the protein floor. The plates are "
        f"already proven safe — allergens, diet, and portion caps are machine-checked — "
        f"so please focus on whether the <b>food choices and balance</b> are sound for "
        f"a hostel student.</div>"
        f"{''.join(cards)}"
        f"</body></html>"
    )
    return doc, csv_rows


def main() -> None:
    _REPORTS_DIR.mkdir(exist_ok=True)
    doc, rows = build()

    html_path = _REPORTS_DIR / "grading_report.html"
    html_path.write_text(doc, encoding="utf-8")

    csv_path = _REPORTS_DIR / "grading_sheet.csv"
    # utf-8-sig: the BOM makes Excel/Sheets read non-ASCII (₹, em-dashes in
    # descriptions) as UTF-8 instead of mangling it as ANSI.
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {html_path.relative_to(Path.cwd())}")
    print(f"Wrote {csv_path.relative_to(Path.cwd())}")
    print(f"{len(rows)} scenarios. Open the HTML in a browser to grade.")


if __name__ == "__main__":
    main()
