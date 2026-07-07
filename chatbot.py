#!/usr/bin/env python3
"""
Interactive Nimble Insights Chatbot — powered by real Excel data.
Run: python chatbot.py
"""

import os
import sys
import json
from typing import Optional

# ── Config ──────────────────────────────────────────────────────────────────
os.environ.setdefault("GEMINI_API_KEY", "")   # set your key here or via env

DEFAULT_YEAR = 2025

HELP_TEXT = """
Available commands:
  status          - Overall hotel performance summary
  revenue         - Revenue breakdown by department
  expenses        - Expense analysis (departmental + undistributed)
  profitability   - EBITDA & net income check
  occupancy       - Room inventory analysis
  trends          - Monthly trend data
  yoy             - Year-over-year comparison
  recommendations - All active recommendations
  explain <area>  - Deep-dive on a specific area
                    e.g.  explain profitability
  data            - Raw numbers (JSON)
  year <YYYY>     - Switch to a different year (e.g. year 2024)
  help            - Show this menu
  quit / exit     - Exit chatbot
"""

AREA_ALIASES = {
    "profit": "profitability",
    "gop": "gop_margin",
    "expenses": "undist_expenses",
    "undist": "undist_expenses",
    "occ": "occupancy",
    "revenue": "revenue_trend",
    "dept": "dept_expenses",
}


# ── Bootstrap ────────────────────────────────────────────────────────────────
def bootstrap():
    try:
        from src.data.excel_loader import ExcelDataLoader
        from src.recommendations.rules import generate_recommendations
        from src.recommendations.explain import explain_recommendation
        return ExcelDataLoader, generate_recommendations, explain_recommendation
    except ImportError as e:
        print(f"❌  Import error: {e}")
        print("    Run: pip install -r requirements.txt")
        sys.exit(1)


def fetch(loader, generate_recommendations, year, month=None):
    """Load data from Excel and generate recommendations."""
    data = loader.get_summary(year, month)
    yoy = loader.get_year_over_year()
    recs = generate_recommendations(data, yoy)
    return data, recs, yoy


# ── Formatters ───────────────────────────────────────────────────────────────
SEV_ICON = {"severe": "🔴", "moderate": "🟡", "info": "🟢"}

def fmt_rec(rec, idx=None):
    icon = SEV_ICON.get(rec.severity.value, "⚪")
    prefix = f"#{idx} " if idx else ""
    lines = [
        f"{icon} {prefix}{rec.area.upper()} ({rec.severity.value})",
        f"   Finding : {rec.finding}",
        f"   Action  : {rec.recommendation}",
    ]
    return "\n".join(lines)


def cmd_status(data, recs, year):
    rev = data.get("revenue_summary", {})
    non_dep = data.get("non_dep_exp_summary", {})
    occ = data.get("occupancy", {})
    total_income = rev.get("total_income", 0)
    ebitda = non_dep.get("ebitda", 0)
    net_income = non_dep.get("net_income", 0)
    occ_pct = occ.get("pct", 0)
    gop_pct_raw = data.get("gop_pct", 0)
    gop_pct = round(gop_pct_raw * 100, 1) if gop_pct_raw < 1 else round(gop_pct_raw, 1)

    health = "✅ Healthy" if not recs else (
        "🔴 Needs Attention" if any(r.severity.value == "severe" for r in recs)
        else "🟡 Some Issues"
    )

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HOTEL STATUS  ({data.get('period', year)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overall Health  : {health}
  Total Revenue   : ${total_income:,.2f}
  EBITDA          : ${ebitda:,.2f}
  Net Income      : ${net_income:,.2f}
  Occupancy       : {occ_pct}%
  ADR             : ${data.get('adr', {}).get('value', 0):,.2f}
  RevPAR          : ${data.get('revpar', {}).get('value', 0):,.2f}
  GOP %           : {gop_pct}%
  Open Issues     : {len(recs)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━""")


def cmd_recommendations(recs):
    if not recs:
        print("\n✨  No issues found — hotel is performing well!\n")
        return
    print(f"\n📋  {len(recs)} active recommendation(s):\n")
    for i, rec in enumerate(recs, 1):
        print(fmt_rec(rec, idx=i))
        print()


def cmd_explain(area_raw, recs, explain_recommendation):
    area = AREA_ALIASES.get(area_raw, area_raw)
    matched = [r for r in recs if r.area == area]
    if not matched:
        all_areas = [r.area for r in recs]
        print(f"  ℹ️  No active issue for '{area}'.")
        if all_areas:
            print(f"     Active areas: {', '.join(all_areas)}")
        return
    rec = matched[0]
    print(f"\n🤖  Generating AI explanation for {rec.area} …\n")
    explanation = explain_recommendation(rec)
    print(f"  {explanation}\n")
    print(f"  Numbers: {json.dumps(rec.numbers, indent=4, default=str)}\n")


def cmd_revenue(data):
    rev = data.get("revenue_summary", {})
    total = rev.get("total_income", 0)
    
    def pct(v):
        return round(v / total * 100, 1) if total > 0 else 0
    
    room = rev.get("room_revenue", 0)
    fb = rev.get("fb_revenue", 0)
    other = rev.get("other_revenue", 0)
    misc = rev.get("misc_income", 0)
    
    print(f"""
  📊 Revenue Breakdown — {data.get('period', '')}
  ────────────────────────────────
  Room Revenue    : ${room:>12,.2f}  ({pct(room)}%)
  F&B Revenue     : ${fb:>12,.2f}  ({pct(fb)}%)
  Other Operating : ${other:>12,.2f}  ({pct(other)}%)
  Miscellaneous   : ${misc:>12,.2f}  ({pct(misc)}%)
  ────────────────────────────────
  TOTAL           : ${total:>12,.2f}
""")


def cmd_expenses(data):
    dept = data.get("dep_exp_summary", {})
    undist = data.get("undist_expenses", {})
    total_rev = data.get("revenue_summary", {}).get("total_income", 1)
    
    dept_total = dept.get("total_dept_expenses", 0)
    undist_total = undist.get("total", 0)
    
    print(f"""
  💰 Expense Analysis — {data.get('period', '')}
  ═══════════════════════════════════════
  DEPARTMENTAL EXPENSES (${dept_total:,.0f}, {dept_total/total_rev*100:.1f}%)
    Room       : ${dept.get('room_expenses', 0):>10,.0f}
    F&B        : ${dept.get('fb_expenses', 0):>10,.0f}
    Other      : ${dept.get('other_expenses', 0):>10,.0f}
  
  UNDISTRIBUTED EXPENSES (${undist_total:,.0f}, {undist_total/total_rev*100:.1f}%)
    Admin & General           : ${undist.get('admin_general', 0):>10,.0f}
    IT & Telecom              : ${undist.get('it_telecom', 0):>10,.0f}
    Sales & Marketing         : ${undist.get('sales_marketing', 0):>10,.0f}
    Franchise & Affiliation   : ${undist.get('franchise', 0):>10,.0f}
    Property Ops & Maintenance: ${undist.get('property_ops_maint', 0):>10,.0f}
    Utilities                 : ${undist.get('utilities', 0):>10,.0f}
  
  Management Fees    : ${data.get('mgmt_fees', {}).get('total', 0):>10,.0f}
  Non-Operating Exp  : ${data.get('non_dep_exp_summary', {}).get('total_non_op_expenses', 0):>10,.0f}
""")


def cmd_profitability(data):
    non_dep = data.get("non_dep_exp_summary", {})
    gop = data.get("gop", 0)
    gop_pct_raw = data.get("gop_pct", 0)
    gop_pct = round(gop_pct_raw * 100, 1) if gop_pct_raw < 1 else round(gop_pct_raw, 1)
    ebitda = non_dep.get("ebitda", 0)
    net_income = non_dep.get("net_income", 0)
    interest = non_dep.get("interest_expense", 0)
    depreciation = non_dep.get("depreciation", 0)
    
    e_icon = "✅" if ebitda >= 0 else "🔴"
    n_icon = "✅" if net_income >= 0 else "🔴"
    
    print(f"""
  📈 Profitability — {data.get('period', '')}
  ────────────────────────────────
  GOP              : ${gop:>12,.2f}  ({gop_pct}%)
  {e_icon}  EBITDA          : ${ebitda:>12,.2f}
  Interest Expense : ${interest:>12,.2f}
  Depreciation     : ${depreciation:>12,.2f}
  {n_icon}  Net Income      : ${net_income:>12,.2f}
""")


def cmd_occupancy(data):
    occ = data.get("occupancy", {})
    print(f"""
  🏨 Occupancy — {data.get('period', '')}
  ────────────────────────────────
  Rooms Available  : {int(occ.get('rooms_available', 0)):,}
  Rooms Sold       : {int(occ.get('rooms_sold', 0)):,}
  Occupancy %      : {occ.get('pct', 0)}%
  ADR              : ${data.get('adr', {}).get('value', 0):,.2f}
  RevPAR           : ${data.get('revpar', {}).get('value', 0):,.2f}
""")


def cmd_trends(data, year):
    trends = data.get("monthly_trend", [])
    if not trends:
        print("  Monthly trend data only available for full-year view.")
        return
    
    print(f"\n  📉 Monthly Trends — {year}")
    print(f"  {'Month':<6} {'Revenue':>12} {'EBITDA':>12} {'Occ%':>6} {'ADR':>8}")
    print(f"  {'─'*6} {'─'*12} {'─'*12} {'─'*6} {'─'*8}")
    for t in trends:
        print(f"  {t['month']:<6} ${t['revenue']:>10,.0f} ${t['ebitda']:>10,.0f} {t['occupancy_pct']:>5.1f}% ${t['adr']:>6.0f}")
    print()


def cmd_yoy(yoy):
    print("\n  📊 Year-over-Year Comparison")
    print(f"  {'Year':<6} {'Revenue':>14} {'EBITDA':>14} {'Net Income':>14} {'Occ%':>6} {'GOP%':>6}")
    print(f"  {'─'*6} {'─'*14} {'─'*14} {'─'*14} {'─'*6} {'─'*6}")
    for y_str, d in sorted(yoy.items()):
        gop_val = d.get("gop_pct", 0)
        gop_display = round(gop_val * 100, 1) if gop_val < 1 else round(gop_val, 1)
        print(f"  {y_str:<6} ${d['revenue']:>12,.0f} ${d['ebitda']:>12,.0f} ${d['net_income']:>12,.0f} {d['occupancy_pct']:>5.1f}% {gop_display:>5.1f}%")
    print()


def cmd_data(data):
    print()
    print(json.dumps(data, indent=2, default=str))
    print()


# ── Main loop ────────────────────────────────────────────────────────────────
def main():
    ExcelDataLoader, generate_recommendations, explain_recommendation = bootstrap()

    loader = ExcelDataLoader()
    current_year = DEFAULT_YEAR

    print("=" * 50)
    print("  🏨  NIMBLE INSIGHTS  —  Interactive Chatbot")
    print("=" * 50)
    print("  Loading Excel data …", end=" ", flush=True)
    data, recs, yoy = fetch(loader, generate_recommendations, current_year)
    print("done ✅")
    print(f"  Loaded {data.get('property_name', 'Hotel')} · {len(recs)} recommendation(s)")
    print(f"  Available years: {loader.get_available_years()}")
    print("  Type  help  to see commands, or  quit  to exit")
    print("=" * 50)

    while True:
        try:
            raw = input("\n💬  You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nGoodbye! 👋\n")
            break

        if not raw:
            continue

        parts = raw.lower().split(maxsplit=1)
        cmd = parts[0]
        arg = parts[1] if len(parts) > 1 else ""

        if cmd in ("quit", "exit", "bye", "q"):
            print("\nGoodbye! 👋\n")
            break

        elif cmd == "help":
            print(HELP_TEXT)

        elif cmd == "status":
            cmd_status(data, recs, current_year)

        elif cmd == "recommendations":
            cmd_recommendations(recs)

        elif cmd == "explain":
            if not arg:
                print("  Usage: explain <area>  (e.g.  explain profitability)")
            else:
                cmd_explain(arg.strip(), recs, explain_recommendation)

        elif cmd == "revenue":
            cmd_revenue(data)

        elif cmd == "expenses":
            cmd_expenses(data)

        elif cmd == "profitability":
            cmd_profitability(data)

        elif cmd == "occupancy":
            cmd_occupancy(data)

        elif cmd == "trends":
            cmd_trends(data, current_year)

        elif cmd == "yoy":
            cmd_yoy(yoy)

        elif cmd == "data":
            cmd_data(data)

        elif cmd == "year":
            if not arg:
                print(f"  Current year: {current_year}")
                print(f"  Available: {loader.get_available_years()}")
            else:
                try:
                    new_year = int(arg.strip())
                    if new_year in loader.get_available_years():
                        current_year = new_year
                        data, recs, yoy = fetch(loader, generate_recommendations, current_year)
                        print(f"  ✅ Switched to {current_year} · {len(recs)} recommendation(s)")
                    else:
                        print(f"  ❌ Year {new_year} not available. Available: {loader.get_available_years()}")
                except ValueError:
                    print(f"  ❌ Invalid year: '{arg}'")

        else:
            # Fuzzy match help
            candidates = ["status", "revenue", "expenses", "profitability", "occupancy",
                          "trends", "yoy", "recommendations", "explain", "data", "year"]
            matches = [c for c in candidates if cmd in c or c in cmd]
            hint = f"  Did you mean: {', '.join(matches)}?" if matches else ""
            print(f"  ❓  Unknown command '{cmd}'.  Type  help  for options.{hint}")


if __name__ == "__main__":
    main()
