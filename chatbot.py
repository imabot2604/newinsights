#!/usr/bin/env python3
"""
Interactive Nimble Insights Chatbot
Run: python chatbot.py
"""

import os
import sys
import json
import re
from typing import Optional

# ── Config ──────────────────────────────────────────────────────────────────
os.environ.setdefault("GEMINI_API_KEY", "")   # set your key here or via env

PROPERTY_ID = "prop_001"
DATE_RANGE   = ("2026-06-01", "2026-06-30")

HELP_TEXT = """
Available commands:
  status          - Overall hotel performance summary
  labour          - Labour / payroll analysis
  profitability   - EBITDA & net income check
  occupancy       - Room inventory & out-of-order rooms
  str             - STR comp-set positioning (rate vs share)
  recommendations - All active recommendations
  explain <area>  - Deep-dive on a specific area
                    e.g.  explain labour_cost
  data            - Raw numbers (JSON)
  refresh         - Re-fetch data from API
  help            - Show this menu
  quit / exit     - Exit chatbot
"""

AREA_ALIASES = {
    "labour": "labour_cost",
    "labor":  "labour_cost",
    "profit": "profitability",
    "occ":    "inventory",
    "rooms":  "inventory",
    "comp":   "rate_vs_share",
    "rate":   "rate_vs_share",
    "str":    "str_positioning",
}


# ── Bootstrap ────────────────────────────────────────────────────────────────
def bootstrap():
    try:
        from src.data.nimble_client import NimbleClient
        from src.recommendations.rules import generate_recommendations
        from src.recommendations.explain import explain_recommendation
        return NimbleClient, generate_recommendations, explain_recommendation
    except ImportError as e:
        print(f"❌  Import error: {e}")
        print("    Run: pip install -r requirements.txt")
        sys.exit(1)


def fetch(NimbleClient, generate_recommendations):
    """Connect to mock API and load data + recommendations."""
    try:
        client = NimbleClient()
    except Exception as e:
        print(f"❌  Cannot connect to mock API: {e}")
        print("    Run: python -m uvicorn mock_nimble_api.main:app --port 8000")
        sys.exit(1)

    daily  = client.get_daily_review(PROPERTY_ID, DATE_RANGE)
    labour = client.get_labour(PROPERTY_ID, DATE_RANGE)
    data   = {**daily, **labour}
    recs   = generate_recommendations(PROPERTY_ID, DATE_RANGE, client)
    return client, data, recs


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


def cmd_status(data, recs):
    rev  = data.get("revenue_summary", {})
    prof = data.get("non_dep_exp_summary", {})
    occ  = data.get("occupancy", {})

    total_income = rev.get("total_income", 0)
    ebitda       = prof.get("ebitda", 0)
    net_income   = prof.get("net_income", 0)
    occ_pct      = occ.get("pct") or occ.get("occupancy_pct", 0)
    payroll_pct  = data.get("payroll_pct", 0)

    health = "✅ Healthy" if not recs else (
        "🔴 Needs Attention" if any(r.severity.value == "severe" for r in recs)
        else "🟡 Some Issues"
    )

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  HOTEL STATUS  ({DATE_RANGE[0]} → {DATE_RANGE[1]})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Overall Health  : {health}
  Total Revenue   : ${total_income:,.2f}
  EBITDA          : ${ebitda:,.2f}
  Net Income      : ${net_income:,.2f}
  Occupancy       : {occ_pct}%
  Payroll %       : {payroll_pct}%
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
    print(f"  Numbers: {json.dumps(rec.numbers, indent=4)}\n")


def cmd_labour(data):
    payroll_pct = data.get("payroll_pct", 0)
    depts       = data.get("payroll_department", [])
    icon        = "🔴" if payroll_pct > 55 else ("🟡" if payroll_pct >= 45 else "✅")
    print(f"\n{icon}  Payroll = {payroll_pct}% of revenue  (threshold 45%)")
    if depts:
        print("\n  Department breakdown:")
        for d in depts:
            bar = "█" * int(d.get("pct_of_budget", 0) // 10)
            print(f"    {d['dept']:<20} {d.get('pct_of_budget',0):>5.1f}%  {bar}")
    print()


def cmd_profitability(data):
    prof = data.get("non_dep_exp_summary", {})
    ebitda     = prof.get("ebitda", 0)
    net_income = prof.get("net_income", 0)
    undist     = prof.get("undist_other_exp", 0)
    total_inc  = data.get("revenue_summary", {}).get("total_income", 1)

    e_icon = "✅" if ebitda >= 0 else "🔴"
    n_icon = "✅" if net_income >= 0 else "🔴"
    print(f"""
  {e_icon}  EBITDA       : ${ebitda:,.2f}
  {n_icon}  Net Income   : ${net_income:,.2f}
      Undist Exp   : ${undist:,.2f}
      Total Rev    : ${total_inc:,.2f}
""")


def cmd_occupancy(data):
    occ = data.get("occupancy", {})
    total  = occ.get("total_rooms", 0)
    ooo    = occ.get("out_of_order", 0)
    sold   = occ.get("rooms_sold", 0)
    pct    = occ.get("pct") or occ.get("occupancy_pct", 0)
    ooo_p  = round(ooo / total * 100, 1) if total else 0
    icon   = "🔴" if ooo_p > 3 else "✅"

    print(f"""
  Total Rooms     : {total}
  Rooms Sold      : {sold}
  Occupancy %     : {pct}%
  {icon}  Out-of-Order : {ooo} rooms ({ooo_p}%)  [threshold 3%]
""")


def cmd_str(data):
    s = data.get("str", {})
    my_occ   = s.get("occupancy", {}).get("my_property", 0)
    comp_occ = s.get("occupancy", {}).get("comp_set", 0)
    my_adr   = s.get("adr", {}).get("my_property", 0)
    comp_adr = s.get("adr", {}).get("comp_set", 0)
    my_rev   = s.get("revpar", {}).get("my_property", 0)
    comp_rev = s.get("revpar", {}).get("comp_set", 0)
    occ_rank = s.get("occupancy", {}).get("rank", "N/A")
    rev_rank = s.get("revpar", {}).get("rank", "N/A")

    def arrow(mine, comp):
        if mine > comp: return f"▲ +{mine-comp:.1f} vs comp"
        if mine < comp: return f"▼ -{comp-mine:.1f} vs comp"
        return "= tied"

    print(f"""
  ┌─────────────────────────────────┐
  │  STR Comp-Set Benchmarking      │
  ├──────────────┬─────────┬────────┤
  │ Metric       │ Mine    │ Comp   │
  ├──────────────┼─────────┼────────┤
  │ Occupancy %  │ {my_occ:<7.1f} │ {comp_occ:<6.1f} │
  │ ADR          │ ${my_adr:<6.2f} │ ${comp_adr:<5.2f} │
  │ RevPAR       │ ${my_rev:<6.2f} │ ${comp_rev:<5.2f} │
  ├──────────────┼─────────┼────────┤
  │ Occ Rank     │ {str(occ_rank):<16} │
  │ RevPAR Rank  │ {str(rev_rank):<16} │
  └──────────────┴─────────┴────────┘
""")


def cmd_data(data):
    import json
    print()
    print(json.dumps(data, indent=2, default=str))
    print()


# ── Main loop ────────────────────────────────────────────────────────────────
def main():
    NimbleClient, generate_recommendations, explain_recommendation = bootstrap()

    print("=" * 50)
    print("  🏨  NIMBLE INSIGHTS  —  Interactive Chatbot")
    print("=" * 50)
    print("  Connecting to mock API …", end=" ", flush=True)
    client, data, recs = fetch(NimbleClient, generate_recommendations)
    print("done ✅")
    print(f"  Loaded data · {len(recs)} recommendation(s) found")
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
        cmd   = parts[0]
        arg   = parts[1] if len(parts) > 1 else ""

        if cmd in ("quit", "exit", "bye", "q"):
            print("\nGoodbye! 👋\n")
            break

        elif cmd == "help":
            print(HELP_TEXT)

        elif cmd == "status":
            cmd_status(data, recs)

        elif cmd == "recommendations":
            cmd_recommendations(recs)

        elif cmd == "explain":
            if not arg:
                print("  Usage: explain <area>  (e.g.  explain labour_cost)")
            else:
                cmd_explain(arg.strip(), recs, explain_recommendation)

        elif cmd == "labour":
            cmd_labour(data)

        elif cmd == "profitability":
            cmd_profitability(data)

        elif cmd == "occupancy":
            cmd_occupancy(data)

        elif cmd == "str":
            cmd_str(data)

        elif cmd == "data":
            cmd_data(data)

        elif cmd == "refresh":
            print("  🔄  Refreshing data …", end=" ", flush=True)
            client, data, recs = fetch(NimbleClient, generate_recommendations)
            print(f"done ✅  ({len(recs)} recommendation(s))")

        else:
            # Fuzzy match help
            candidates = ["status", "labour", "profitability", "occupancy",
                          "str", "recommendations", "explain", "data", "refresh"]
            matches = [c for c in candidates if cmd in c or c in cmd]
            hint = f"  Did you mean: {', '.join(matches)}?" if matches else ""
            print(f"  ❓  Unknown command '{cmd}'.  Type  help  for options.{hint}")


if __name__ == "__main__":
    main()
