# Nimble Insights Chatbot

AI-powered recommendation engine and chatbot layer on top of the **Nimble** hotel analytics dashboard.

## What this is

This project does **not** include a forecasting model — your existing Nimble forecaster feeds the dashboard. What this adds:

1. **Mock Nimble API** (`mock_nimble_api/`) — a local FastAPI service that returns realistic synthetic data for all 6 dashboard tabs, so you can develop and test without the real backend.
2. **Data Adapter** (`src/data/nimble_client.py`) — the *only* file that knows the HTTP shape of the Nimble backend. Swap the base URL in config and the whole stack points at your real backend.
3. **Rules Engine** (`src/recommendations/`) — plain Python conditionals that turn dashboard numbers into structured, actionable findings with computed sizes (e.g. rate reduction in ₹, not vague direction).
4. **Explanation Layer** (`src/recommendations/explain.py`) — Claude narrates the structured finding; it is forbidden from inventing or altering any number.
5. **Chatbot** (`src/chatbot/`) — Claude with tool use. The model *never* computes a number; it only calls tools and narrates real output.
6. **Web Widget** (`web/index.html`) — single-page chat UI for demos.

## ⚠️ Figma source note

The Figma file (`https://www.figma.com/proto/FFcaCy4ov3mzZbfMa59YLN/Nimble`) was not accessible via API at build time (no personal access token provided). The schema in `docs/architecture.md` and used throughout the codebase was confirmed from live dashboard screenshots. Re-verify field names against the Figma dev-mode inspection once access is available.

## Quick start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set your Anthropic API key
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start the mock Nimble API
```bash
uvicorn mock_nimble_api.main:app --port 8001 --reload
# Verify: http://localhost:8001/docs
```

### 4. Run the full demo (mock API + chatbot backend + opens browser)
```bash
python scripts/run_demo.py
```

This starts:
- Mock API on port 8001
- Chatbot backend on port 8000
- Prints the URL to open the chat widget

### 5. Open the chat widget
```
http://localhost:8000/
```

### 6. CLI chat (quick testing)
```bash
python -m src.chatbot.backend --cli
```

Try: *"What should we improve this month?"*

## Run tests
```bash
pytest tests/ -v
```

## Project structure

```
nimble-insights-chatbot/
├── README.md
├── requirements.txt
├── docs/architecture.md
├── mock_nimble_api/
│   ├── main.py              # FastAPI, one route per tab
│   └── synthetic_data.py    # Deterministic synthetic data generator
├── src/
│   ├── data/
│   │   └── nimble_client.py # Adapter — ONLY file that knows HTTP shape
│   ├── recommendations/
│   │   ├── models.py        # Pydantic models for structured results
│   │   ├── rules.py         # 5 rules, plain Python conditionals
│   │   ├── sizing.py        # Elasticity-based rate sizing
│   │   └── explain.py       # Claude narration layer
│   └── chatbot/
│       ├── system_prompt.py
│       ├── tools.py         # Tool definitions for Claude
│       └── backend.py       # FastAPI chatbot + CLI loop
├── web/
│   └── index.html           # Chat widget
├── tests/
│   ├── test_rules.py
│   └── test_recommendation_sizing.py
└── scripts/
    └── run_demo.py
```

## Swapping the mock for your real Nimble backend

In `src/data/nimble_client.py`, change:
```python
NIMBLE_BASE_URL = os.getenv("NIMBLE_API_URL", "http://localhost:8001")
```
to point at your real API. No other file needs to change.

## Architecture

See `docs/architecture.md` for the full data-flow diagram and schema reference.
