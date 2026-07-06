# Nimble Insights Chatbot - Implementation Guide

## ✅ COMPLETED (Already in Repository)

### 1. Mock API (DONE)
- `mock_nimble_api/synthetic_data.py` - Complete synthetic data generator with seasonality, weekday patterns
- `mock_nimble_api/main.py` - FastAPI service with 6 endpoints matching all Figma tabs

### 2. Data Adapter (DONE)
- `src/data/nimble_client.py` - HTTP client abstracting the mock API

## 🔧 REMAINING FILES TO CREATE

I've verified the complete schema from the live Figma prototype. Here are all remaining files with exact content:

### 3. Recommendation Engine Models

**File: `src/recommendations/models.py`**
```python
"""Data models for recommendations."""
from dataclasses import dataclass
from typing import Optional, Dict, Any
from enum import Enum

class Severity(Enum):
    INFO = "info"
    MODERATE = "moderate"
    SEVERE = "severe"

@dataclass
class Recommendation:
    area: str
    severity: Severity
    finding: str
    recommendation: str
    numbers: Dict[str, Any]
    explanation: Optional[str] = None
```

### 4. Rules Engine (THE CORE)

**File: `src/recommendations/rules.py`**
```python
"""Rules engine - 5 validated rules from spec."""
from typing import List, Dict, Any
from .models import Recommendation, Severity

def check_labour_cost(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 1: Payroll % of revenue > 45%."""
    payroll_pct = data.get("payroll_pct", 0)
    
    if payroll_pct < 45:
        return None
    
    severity = Severity.SEVERE if payroll_pct > 55 else Severity.MODERATE
    
    # Find departments at/above 90% budget
    problem_depts = [
        d["dept"] for d in data.get("payroll_department", [])
        if d.get("pct_of_budget", 0) >= 90
    ]
    
    return Recommendation(
        area="labour_cost",
        severity=severity,
        finding=f"Payroll at {payroll_pct}% of revenue (threshold: 45%)",
        recommendation=f"Review staffing levels in: {', '.join(problem_depts) if problem_depts else 'all departments'}",
        numbers={"payroll_pct": payroll_pct, "problem_depts": problem_depts}
    )

def check_profitability(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 2: Negative EBITDA or net income."""
    ebitda = data.get("non_dep_exp_summary", {}).get("ebitda", 0)
    net_income = data.get("non_dep_exp_summary", {}).get("net_income", 0)
    total_income = data.get("revenue_summary", {}).get("total_income", 1)
    undist_exp = data.get("non_dep_exp_summary", {}).get("undist_other_exp", 0)
    
    if ebitda >= 0 and net_income >= 0:
        return None
    
    driver = "undistributed/other expenses" if undist_exp > total_income else "departmental performance"
    
    return Recommendation(
        area="profitability",
        severity=Severity.SEVERE,
        finding=f"EBITDA: ${ebitda:,.2f}, Net Income: ${net_income:,.2f}",
        recommendation=f"Primary driver: {driver}. Review non-departmental cost structure.",
        numbers={"ebitda": ebitda, "net_income": net_income, "undist_exp": undist_exp, "total_income": total_income}
    )

def check_rate_vs_share(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 3: Occupancy < comp set AND ADR > comp set."""
    str_data = data.get("str", {})
    my_occ = str_data.get("occupancy", {}).get("my_property", 0)
    comp_occ = str_data.get("occupancy", {}).get("comp_set", 0)
    my_adr = str_data.get("adr", {}).get("my_property", 0)
    comp_adr = str_data.get("adr", {}).get("comp_set", 0)
    
    if my_occ >= comp_occ or my_adr <= comp_adr:
        return None
    
    occ_gap = comp_occ - my_occ
    
    # Import sizing function
    from .sizing import compute_rate_adjustment
    rate_reduction = compute_rate_adjustment(my_adr, occ_gap)
    
    return Recommendation(
        area="rate_vs_share",
        severity=Severity.MODERATE,
        finding=f"Occupancy {my_occ}% vs comp {comp_occ}%, ADR ${my_adr} vs comp ${comp_adr}",
        recommendation=f"Consider reducing ADR by ~${rate_reduction:.2f} or targeted promotion to close {occ_gap:.1f}pt occupancy gap",
        numbers={"my_occ": my_occ, "comp_occ": comp_occ, "my_adr": my_adr, "comp_adr": comp_adr, "suggested_reduction": rate_reduction}
    )

def check_inventory(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 4: Out-of-order rooms > 3% of inventory."""
    total_rooms = data.get("occupancy", {}).get("total_rooms", 178)
    ooo_rooms = data.get("occupancy", {}).get("out_of_order", 0)
    ooo_pct = (ooo_rooms / total_rooms * 100) if total_rooms > 0 else 0
    
    if ooo_pct <= 3:
        return None
    
    return Recommendation(
        area="inventory",
        severity=Severity.MODERATE,
        finding=f"{ooo_rooms} out-of-order rooms ({ooo_pct:.1f}% of inventory)",
        recommendation="Escalate to housekeeping/maintenance to return rooms to sellable status",
        numbers={"ooo_rooms": ooo_rooms, "total_rooms": total_rooms, "ooo_pct": ooo_pct}
    )

def check_str_positioning(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 5: RevPAR rank better than occupancy rank = pricing wins."""
    str_data = data.get("str", {})
    occ_rank = str_data.get("occupancy", {}).get("rank", 99)
    revpar_rank = str_data.get("revpar", {}).get("rank", 99)
    
    if revpar_rank >= occ_rank:
        return None
    
    return Recommendation(
        area="str_positioning",
        severity=Severity.INFO,
        finding=f"RevPAR rank {revpar_rank} outperforms occupancy rank {occ_rank}",
        recommendation="No action needed - pricing strategy is effectively driving revenue despite volume position",
        numbers={"occ_rank": occ_rank, "revpar_rank": revpar_rank}
    )

def generate_recommendations(property_id: str, date_range: tuple, client) -> List[Recommendation]:
    """Run all rules and return recommendations."""
    # Fetch data
    daily_review = client.get_daily_review(property_id, date_range)
    labour = client.get_labour(property_id, date_range)
    
    # Combine data
    combined = {**daily_review, **labour}
    
    # Run all rules
    rules = [
        check_labour_cost,
        check_profitability,
        check_rate_vs_share,
        check_inventory,
        check_str_positioning
    ]
    
    recommendations = []
    for rule in rules:
        rec = rule(combined)
        if rec:
            recommendations.append(rec)
    
    return recommendations
```

### 5. Sizing Module

**File: `src/recommendations/sizing.py`**
```python
"""Compute specific numbers for recommendations."""

def compute_rate_adjustment(current_adr: float, occupancy_gap_pts: float, elasticity: float = -0.5) -> float:
    """Linear elasticity model for rate reduction.
    
    Args:
        current_adr: Current ADR
        occupancy_gap_pts: Occupancy points behind comp set
        elasticity: Price elasticity (default -0.5: 1% rate drop => 0.5% occ increase)
    
    Returns:
        Suggested ADR reduction in dollars
    """
    # How much rate change needed to close gap?
    # occ_gap = rate_change * elasticity
    # rate_change = occ_gap / elasticity
    
    rate_change_pct = (occupancy_gap_pts / abs(elasticity)) / 100  # Convert to decimal
    rate_reduction = current_adr * rate_change_pct
    
    return max(1.0, rate_reduction)  # At least $1
```

### 6. Explanation Layer (Uses Claude)

**File: `src/recommendations/explain.py`**
```python
"""LLM-based explanation layer - narrates recommendations."""
import os
from anthropic import Anthropic
from .models import Recommendation

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def explain_recommendation(rec: Recommendation) -> str:
    """Generate natural language explanation.
    
    CRITICAL: Numbers come from rec.numbers, LLM only narrates.
    """
    prompt = f"""You are explaining a hotel revenue management recommendation to a revenue manager.

Area: {rec.area}
Severity: {rec.severity.value}
Finding: {rec.finding}
Recommendation: {rec.recommendation}
Numbers: {rec.numbers}

Write ONE paragraph (max 3 sentences) narrating this recommendation in plain business language.

CRITICAL RULES:
- Use ONLY the numbers provided in 'Numbers'
- Do NOT invent, estimate, or alter any number
- Do NOT add causes or explanations not present in 'Finding' or 'Recommendation'
- Keep it factual and actionable"""
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.content[0].text
```

### 7. Chatbot System Prompt

**File: `src/chatbot/system_prompt.py`**
```python
SYSTEM_PROMPT = """You are an AI assistant for the Nimble hotel analytics dashboard.

Your role:
- Answer questions about hotel performance using ONLY data from tool calls
- NEVER state a number unless it came from a tool call in this conversation
- NEVER invent causes for trends - only report what the data shows
- When recommendations exist, provide: finding + specific numbers + action
- Say plainly when there's no data for a requested range

Critical rules:
1. All numbers must come from tool outputs - never estimate or calculate yourself
2. If a metric is on track, say so - don't manufacture concerns
3. When asked "what should we improve", call get_recommendations and return findings
4. Be concise and action-oriented

Available tools give you access to:
- Daily review (occupancy, ADR, RevPAR, revenue, expenses, guest reviews, STR)
- Financial KPIs (balance sheet, P&L)
- Labour (payroll %, department breakdown)
- Predictive analytics (OTB forecast)
- STR & Guest Review (weekly comp set data)
- Custom widgets (TRevPAR, GOPPAR, etc.)
- Recommendations (actionable insights from rules engine)

Always trace your answers back to tool call data.
"""
```

**File: `src/chatbot/tools.py`**
```python
"""Claude tool definitions."""
from typing import List, Dict, Any

TOOLS = [
    {
        "name": "get_daily_review",
        "description": "Get My Daily Review tab data (occupancy, ADR, RevPAR, revenue, expenses, guest reviews, STR)",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "string", "description": "Property ID"},
                "start_date": {"type": "string", "description": "Start date YYYY-MM-DD"},
                "end_date": {"type": "string", "description": "End date YYYY-MM-DD"}
            },
            "required": ["property_id", "start_date", "end_date"]
        }
    },
    {
        "name": "get_labour",
        "description": "Get Labour tab data (payroll %, revenue, department breakdown)",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "string"},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"}
            },
            "required": ["property_id", "start_date", "end_date"]
        }
    },
    {
        "name": "get_recommendations",
        "description": "Get actionable recommendations from rules engine (labour cost, profitability, rate vs share, inventory, STR positioning)",
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {"type": "string"},
                "start_date": {"type": "string"},
                "end_date": {"type": "string"},
                "severity_min": {"type": "string", "enum": ["info", "moderate", "severe"], "description": "Minimum severity to return"}
            },
            "required": ["property_id", "start_date", "end_date"]
        }
    }
]

def execute_tool(tool_name: str, tool_input: Dict[str, Any], client) -> Any:
    """Execute a tool and return result."""
    if tool_name == "get_daily_review":
        return client.get_daily_review(
            tool_input["property_id"],
            (tool_input["start_date"], tool_input["end_date"])
        )
    elif tool_name == "get_labour":
        return client.get_labour(
            tool_input["property_id"],
            (tool_input["start_date"], tool_input["end_date"])
        )
    elif tool_name == "get_recommendations":
        from ..recommendations.rules import generate_recommendations
        recs = generate_recommendations(
            tool_input["property_id"],
            (tool_input["start_date"], tool_input["end_date"]),
            client
        )
        # Filter by severity if specified
        severity_order = {"info": 0, "moderate": 1, "severe": 2}
        min_sev = severity_order.get(tool_input.get("severity_min", "info"), 0)
        
        filtered = [r for r in recs if severity_order[r.severity.value] >= min_sev]
        
        return [{"area": r.area, "severity": r.severity.value, "finding": r.finding, "recommendation": r.recommendation, "numbers": r.numbers} for r in filtered]
    else:
        raise ValueError(f"Unknown tool: {tool_name}")
```

**File: `src/chatbot/backend.py`**
```python
"""FastAPI chatbot backend."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from anthropic import Anthropic
import os
from typing import List, Dict, Any

from ..data.nimble_client import NimbleClient
from .system_prompt import SYSTEM_PROMPT
from .tools import TOOLS, execute_tool

app = FastAPI(title="Nimble Insights Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

anthropic_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
nimble_client = NimbleClient()

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, Any]] = []

@app.post("/api/chat")
async def chat(request: ChatRequest):
    messages = request.conversation_history + [{"role": "user", "content": request.message}]
    
    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=messages
    )
    
    # Handle tool use
    while response.stop_reason == "tool_use":
        tool_use_block = next(block for block in response.content if block.type == "tool_use")
        
        # Execute tool
        tool_result = execute_tool(tool_use_block.name, tool_use_block.input, nimble_client)
        
        # Continue conversation
        messages.append({"role": "assistant", "content": response.content})
        messages.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_block.id,
                "content": str(tool_result)
            }]
        })
        
        response = anthropic_client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages
        )
    
    assistant_message = next((block.text for block in response.content if hasattr(block, "text")), "")
    
    return {
        "response": assistant_message,
        "conversation_history": messages + [{"role": "assistant", "content": assistant_message}]
    }

app.mount("/", StaticFiles(directory="web", html=True), name="web")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### 8. Web Chat Widget

**File: `web/index.html`**
```html
<!DOCTYPE html>
<html>
<head>
    <title>Nimble Insights Chatbot</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; height: 100vh; display: flex; flex-direction: column; }
        h1 { margin-bottom: 20px; color: #1a1a1a; }
        .chat-box { flex: 1; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; overflow-y: auto; background: #f9f9f9; margin-bottom: 20px; }
        .message { margin-bottom: 16px; padding: 12px 16px; border-radius: 8px; max-width: 80%; }
        .user { background: #007bff; color: white; margin-left: auto; text-align: right; }
        .assistant { background: white; border: 1px solid #e0e0e0; }
        .input-area { display: flex; gap: 10px; }
        input { flex: 1; padding: 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
        button { padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        button:hover { background: #0056b3; }
        button:disabled { background: #ccc; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Nimble Insights Chatbot</h1>
        <div class="chat-box" id="chatBox"></div>
        <div class="input-area">
            <input type="text" id="userInput" placeholder="Ask about your hotel performance..." />
            <button onclick="sendMessage()" id="sendBtn">Send</button>
        </div>
    </div>
    <script>
        let conversationHistory = [];
        
        async function sendMessage() {
            const input = document.getElementById('userInput');
            const message = input.value.trim();
            if (!message) return;
            
            addMessage(message, 'user');
            input.value = '';
            document.getElementById('sendBtn').disabled = true;
            
            try {
                const response = await fetch('http://localhost:8001/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, conversation_history: conversationHistory })
                });
                
                const data = await response.json();
                addMessage(data.response, 'assistant');
                conversationHistory = data.conversation_history;
            } catch (error) {
                addMessage('Error: Could not reach chatbot server', 'assistant');
            }
            
            document.getElementById('sendBtn').disabled = false;
        }
        
        function addMessage(text, role) {
            const chatBox = document.getElementById('chatBox');
            const msg = document.createElement('div');
            msg.className = `message ${role}`;
            msg.textContent = text;
            chatBox.appendChild(msg);
            chatBox.scrollTop = chatBox.scrollHeight;
        }
        
        document.getElementById('userInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    </script>
</body>
</html>
```

### 9. Tests

**File: `tests/test_rules.py`**
```python
import pytest
from src.recommendations.rules import check_labour_cost, check_profitability, check_rate_vs_share, check_inventory, check_str_positioning
from src.recommendations.models import Severity

def test_labour_cost_triggers():
    data = {"payroll_pct": 52, "payroll_department": [{"dept": "Room", "pct_of_budget": 95}]}
    rec = check_labour_cost(data)
    assert rec is not None
    assert rec.severity == Severity.MODERATE
    assert "Room" in rec.recommendation

def test_labour_cost_no_trigger():
    data = {"payroll_pct": 40, "payroll_department": []}
    rec = check_labour_cost(data)
    assert rec is None

def test_str_positioning_no_action():
    """Rule 5 should NOT fire when RevPAR rank is better."""
    data = {"str": {"occupancy": {"rank": 4}, "revpar": {"rank": 3}}}
    rec = check_str_positioning(data)
    assert rec is not None
    assert rec.severity == Severity.INFO
    assert "No action needed" in rec.recommendation
```

**File: `tests/test_recommendation_sizing.py`**
```python
from src.recommendations.sizing import compute_rate_adjustment

def test_rate_adjustment():
    # 10pt occ gap, $100 ADR, -0.5 elasticity
    # Need 10/0.5 = 20% rate change
    # $100 * 0.20 = $20 reduction
    result = compute_rate_adjustment(100.0, 10.0, -0.5)
    assert result == pytest.approx(20.0, rel=0.01)

def test_rate_adjustment_small_gap():
    result = compute_rate_adjustment(100.0, 2.0, -0.5)
    assert result == pytest.approx(4.0, rel=0.01)
```

### 10. Demo Script

**File: `scripts/run_demo.py`**
```python
#!/usr/bin/env python3
"""Start mock API and chatbot for demo."""
import subprocess
import time
import sys

print("Starting Nimble Mock API on port 8000...")
mock_api = subprocess.Popen([sys.executable, "-m", "uvicorn", "mock_nimble_api.main:app", "--port", "8000"])
time.sleep(3)

print("Starting Chatbot Backend on port 8001...")
chatbot = subprocess.Popen([sys.executable, "-m", "uvicorn", "src.chatbot.backend:app", "--port", "8001"])
time.sleep(3)

print("\n✅ Demo running!")
print("Mock API: http://localhost:8000")
print("Chatbot: http://localhost:8001")
print("\nPress Ctrl+C to stop...")

try:
    mock_api.wait()
except KeyboardInterrupt:
    print("\nShutting down...")
    mock_api.terminate()
    chatbot.terminate()
```

## 📦 Dependencies

**File: `requirements.txt` (ALREADY EXISTS - UPDATE IT)**
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
requests==2.32.0
anthropic==0.39.0
pandas==2.2.0
numpy==1.26.0
pytest==8.3.0
python-dotenv==1.0.0
```

## 🚀 SETUP COMMANDS

```bash
# Clone repo
git clone https://github.com/imabot2604/newinsights.git
cd newinsights

# Install dependencies
pip install -r requirements.txt

# Set API key
export ANTHROPIC_API_KEY=your_key_here

# Run demo
python scripts/run_demo.py

# Open browser
open http://localhost:8001

# Test chatbot
# Try: "What should we improve this month?"
# Try: "What's our payroll percentage?"
# Try: "How do we compare to the comp set?"
```

## ✅ VERIFICATION CHECKLIST

- [ ] Mock API returns data for all 6 tabs
- [ ] Rules engine produces 5 recommendation types
- [ ] Rate sizing computes real numbers
- [ ] Chatbot answers with tool-sourced data only
- [ ] Web widget loads and sends messages
- [ ] Tests pass

---

**Schema Source:** Verified from live Figma prototype at https://www.figma.com/proto/FFcaCy4ov3mzZbfMa59YLN/Nimble

**Status:** Mock API + Adapter complete in repo. Create remaining 9 files above to finish.
