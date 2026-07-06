# Architecture

## Data flow

```
[Nimble Dashboard / Forecaster]
           |
           v
  [Mock Nimble API]          <-- swap for real API via env var
  mock_nimble_api/main.py
           |
           v
  [Data Adapter]             <-- ONLY layer that knows HTTP shape
  src/data/nimble_client.py
           |
           v
  [Rules Engine]             <-- plain Python conditionals
  src/recommendations/
    rules.py     -> 5 rules, structured {area, severity, finding, recommendation, numbers}
    sizing.py    -> elasticity-based rate sizing (scipy.optimize)
    explain.py   -> Claude narration (numbers locked, never altered)
           |
           v
  [Chatbot Backend]          <-- Claude with tool use
  src/chatbot/backend.py
    tools.py     -> one tool per adapter function + get_recommendations
    system_prompt.py
           |
        /     \
       v       v
  [CLI loop] [FastAPI /chat endpoint]
                   |
                   v
             [web/index.html]
             Chat widget (demo UI)
```

## Dashboard schema (confirmed from live screenshots)

### Tab 1: My Daily Review
| Field | Type | Notes |
|-------|------|-------|
| occupancy_pct | float | 0–100 |
| total_rooms | int | |
| occupied_rooms | int | |
| vacant_rooms | int | |
| out_of_order_rooms | int | |
| adr | float | Average Daily Rate |
| revpar | float | Revenue per Available Room |
| room_revenue | float | |
| daily_trend | list[DayValue] | Mon–Sun |
| revenue_summary | RevenueSummary | room, fb, other, total |
| dep_exp_summary | DepExpSummary | room_exp, fb_exp, other_exp, gop |
| non_dep_exp_summary | NonDepExpSummary | undist_other_exp, ebitda, ebitda_pct, other_exp, net_income |

### Tab 2: Financial KPIs
| Field | Type |
|-------|------|
| balance_sheet | BalanceSheet (assets, liabilities, equity, trend) |
| profit_loss | ProfitLoss (income, expense, net_income, trend) |

### Tab 3: Labour
| Field | Type |
|-------|------|
| total_revenue | float |
| payroll_expenses | float |
| payroll_pct | float | payroll / revenue |
| monthly_chart | list[MonthlyLabour] | revenue, payroll, occupancy per month |
| department_breakdown | dict[str, DeptPayroll] | rooms, fb, sm, it, others (budget vs current) |

### Tab 4: Predictive Analytics (OTB)
| Field | Type |
|-------|------|
| otb_overview | OTBOverview | occupancy, adr, revpar, room_revenue |
| Each metric | MetricComparison | my_property, comp_set, index_mpi, rank, daily_series |

### Tab 5: STR & Guest Review
| Field | Type |
|-------|------|
| year | int |
| week | int |
| occupancy | STRMetric | my_property, comp_set, index, rank |
| adr | STRMetric | |
| revpar | STRMetric | |

### Tab 6: Customize Widget
| Field | Type |
|-------|------|
| kpi_cards | list[KPICard] | name, value, trend |
| revenue_trend | list[RevenueSeries] | series_name, data |

## Key design decisions

1. **Adapter-only HTTP** — `nimble_client.py` is the single seam. Swap `NIMBLE_API_URL` env var to point at the real backend; zero other changes.
2. **Rules are readable conditionals** — no ML in the rules engine. Every threshold is explicit and auditable.
3. **Numbers locked in tool layer** — the chatbot's Claude instance never computes a number. All math lives in `rules.py` / `sizing.py`. The system prompt enforces this.
4. **Elasticity sizing** — Rule 3 (rate vs share) uses a simple linear demand model: `Δoccupancy = ε * (Δrate / current_rate)`. Default ε = −0.8 (typical hotel short-run). `scipy.optimize.brentq` solves for the rate delta that closes a target occupancy gap.
5. **Explanation via Claude** — `explain.py` passes the structured `Recommendation` dict to Claude with explicit instructions never to alter numbers, only narrate them.
