import os
import sys
import json
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import requests

# Add root folder to sys.path so we can import src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from src.data.nimble_client import NimbleClient
from src.recommendations.rules import generate_recommendations
from src.recommendations.explain import explain_recommendation

app = FastAPI(title="Nimble Insights Web Chatbot")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

PROPERTY_ID = "prop_001"
DATE_RANGE = ("2026-06-01", "2026-06-30")

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Dict[str, Any]] = []

def get_hotel_data():
    client = NimbleClient()
    daily = client.get_daily_review(PROPERTY_ID, DATE_RANGE)
    labour = client.get_labour(PROPERTY_ID, DATE_RANGE)
    data = {**daily, **labour}
    recs = generate_recommendations(PROPERTY_ID, DATE_RANGE, client)
    return data, recs

def call_gemini_chat(prompt: str) -> str:
    # Get the key from the environment
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "I'm sorry, Gemini API key is not configured."
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 800
        }
    }
    try:
        response = requests.post(url, json=payload, timeout=15)
        response.raise_for_status()
        result = response.json()
        return result['candidates'][0]['content']['parts'][0]['text']
    except requests.exceptions.HTTPError as e:
        if e.response.status_code in (400, 404):
            return "⚠️ <b>AI Service Offline:</b> The provided Gemini API key is invalid or a placeholder. Please configure a valid API key to enable natural language processing."
        return f"Error contacting AI service: {e.response.status_code} - {e.response.text}"
    except Exception as e:
        return f"Error contacting AI service: {str(e)}"

@app.post("/api/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        return {
            "response": "Please type a message.",
            "conversation_history": request.conversation_history
        }
    
    # Try fetching data
    try:
        data, recs = get_hotel_data()
    except Exception as e:
        err_msg = f"Failed to connect to Mock API. Make sure it is running on port 8000. Error: {str(e)}"
        return {
            "response": err_msg,
            "conversation_history": request.conversation_history
        }
    
    cmd_lower = message.lower()
    response_text = ""
    
    # Simple keyword/command matches like CLI chatbot
    if cmd_lower in ("help", "/help", "menu"):
        response_text = """Here is what you can ask me:
• <b>status</b> - Overall hotel performance summary
• <b>labour</b> - Labour / payroll analysis
• <b>profitability</b> - EBITDA & net income check
• <b>occupancy</b> - Room inventory & out-of-order rooms
• <b>str</b> - STR comp-set positioning (rate vs share)
• <b>recommendations</b> - All active recommendations
• <b>explain &lt;area&gt;</b> - Deep-dive on a specific area (e.g. <i>explain labour_cost</i>)
• <b>data</b> - Raw JSON data

Or just ask me any natural language question!"""
        
    elif cmd_lower == "status":
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
        response_text = f"""<b>HOTEL STATUS ({DATE_RANGE[0]} → {DATE_RANGE[1]})</b>
────────────────────────────────
• <b>Overall Health</b>: {health}
• <b>Total Revenue</b>: ${total_income:,.2f}
• <b>EBITDA</b>: ${ebitda:,.2f}
• <b>Net Income</b>: ${net_income:,.2f}
• <b>Occupancy</b>: {occ_pct}%
• <b>Payroll %</b>: {payroll_pct}%
• <b>Open Issues</b>: {len(recs)}"""
        
    elif cmd_lower == "recommendations":
        if not recs:
            response_text = "✨ No issues found — hotel is performing well!"
        else:
            lines = [f"<b>📋 {len(recs)} active recommendation(s):</b><br>"]
            for i, rec in enumerate(recs, 1):
                icon = "🔴" if rec.severity.value == "severe" else ("🟡" if rec.severity.value == "moderate" else "🟢")
                lines.append(f"{icon} <b>#{i} {rec.area.upper()} ({rec.severity.value})</b>")
                lines.append(f"   <i>Finding</i> : {rec.finding}")
                lines.append(f"   <i>Action</i>  : {rec.recommendation}<br>")
            response_text = "<br>".join(lines)
        
    elif cmd_lower.startswith("explain"):
        area_raw = message[7:].strip()
        if not area_raw:
            response_text = "Usage: <b>explain &lt;area&gt;</b> (e.g. <i>explain labour_cost</i>)"
        else:
            from chatbot import AREA_ALIASES
            area = AREA_ALIASES.get(area_raw.lower(), area_raw.lower())
            matched = [r for r in recs if r.area == area]
            if not matched:
                all_areas = [r.area for r in recs]
                response_text = f"ℹ️ No active issue for '{area}'."
                if all_areas:
                    response_text += f"<br>Active areas: {', '.join(all_areas)}"
            else:
                rec = matched[0]
                explanation = explain_recommendation(rec)
                numbers_str = json.dumps(rec.numbers, indent=2)
                response_text = f"🤖 <b>AI Explanation for {rec.area}:</b><br><br>{explanation}<br><br><b>Numbers:</b><br><pre>{numbers_str}</pre>"
        
    elif cmd_lower == "labour" or cmd_lower == "labor":
        payroll_pct = data.get("payroll_pct", 0)
        depts       = data.get("payroll_department", [])
        icon        = "🔴" if payroll_pct > 55 else ("🟡" if payroll_pct >= 45 else "✅")
        resp = [f"<b>{icon} Payroll = {payroll_pct}% of revenue</b> (threshold 45%)"]
        if depts:
            resp.append("<br><b>Department breakdown:</b>")
            for d in depts:
                bar = "█" * int(d.get("pct_of_budget", 0) // 10)
                resp.append(f"  {d['dept']:<15} {d.get('pct_of_budget',0):>5.1f}%  {bar}")
        response_text = "<br>".join(resp)
        
    elif cmd_lower == "profitability" or cmd_lower == "profit":
        prof = data.get("non_dep_exp_summary", {})
        ebitda     = prof.get("ebitda", 0)
        net_income = prof.get("net_income", 0)
        undist     = prof.get("undist_other_exp", 0)
        total_inc  = data.get("revenue_summary", {}).get("total_income", 1)
        e_icon = "✅" if ebitda >= 0 else "🔴"
        n_icon = "✅" if net_income >= 0 else "🔴"
        resp = f"""
• {e_icon}  <b>EBITDA</b>       : ${ebitda:,.2f}
• {n_icon}  <b>Net Income</b>   : ${net_income:,.2f}
• Undist Exp   : ${undist:,.2f}
• Total Rev    : ${total_inc:,.2f}
"""
        response_text = resp.strip().replace("\n", "<br>")
        
    elif cmd_lower == "occupancy" or cmd_lower == "rooms":
        occ = data.get("occupancy", {})
        total  = occ.get("total_rooms", 0)
        ooo    = occ.get("out_of_order", 0)
        sold   = occ.get("rooms_sold", 0)
        pct    = occ.get("pct") or occ.get("occupancy_pct", 0)
        ooo_p  = round(ooo / total * 100, 1) if total else 0
        icon   = "🔴" if ooo_p > 3 else "✅"
        resp = f"""
• Total Rooms     : {total}
• Rooms Sold      : {sold}
• Occupancy %     : {pct}%
• {icon} <b>Out-of-Order</b> : {ooo} rooms ({ooo_p}%)  [threshold 3%]
"""
        response_text = resp.strip().replace("\n", "<br>")
        
    elif cmd_lower == "str" or cmd_lower == "comp":
        s = data.get("str", {})
        my_occ   = s.get("occupancy", {}).get("my_property", 0)
        comp_occ = s.get("occupancy", {}).get("comp_set", 0)
        my_adr   = s.get("adr", {}).get("my_property", 0)
        comp_adr = s.get("adr", {}).get("comp_set", 0)
        my_rev   = s.get("revpar", {}).get("my_property", 0)
        comp_rev = s.get("revpar", {}).get("comp_set", 0)
        occ_rank = s.get("occupancy", {}).get("rank", "N/A")
        rev_rank = s.get("revpar", {}).get("rank", "N/A")
        resp = f"""
<b>STR Comp-Set Benchmarking:</b>
• <b>Occupancy %</b>  | Mine: {my_occ:.1f}% vs Comp: {comp_occ:.1f}%
• <b>ADR</b>          | Mine: ${my_adr:.2f} vs Comp: ${comp_adr:.2f}
• <b>RevPAR</b>       | Mine: ${my_rev:.2f} vs Comp: ${comp_rev:.2f}
• <b>Occ Rank</b>     | {occ_rank}
• <b>RevPAR Rank</b>  | {rev_rank}
"""
        response_text = resp.strip().replace("\n", "<br>")
        
    elif cmd_lower == "data":
        response_text = f"<pre>{json.dumps(data, indent=2, default=str)}</pre>"
        
    # If not a command, do full LLM question answering based on the hotel data!
    else:
        # Build context
        context_recs = []
        for r in recs:
            context_recs.append({
                "area": r.area,
                "severity": r.severity.value,
                "finding": r.finding,
                "recommendation": r.recommendation,
                "numbers": r.numbers
            })
        
        clean_data = {
            "property_id": PROPERTY_ID,
            "date_range": DATE_RANGE,
            "overall_occupancy_pct": data.get("occupancy", {}).get("pct") or data.get("occupancy", {}).get("occupancy_pct"),
            "revenue": data.get("revenue_summary"),
            "payroll_pct": data.get("payroll_pct"),
            "payroll_departments": data.get("payroll_department"),
            "str_benchmarking": data.get("str"),
            "out_of_order_rooms": data.get("occupancy", {}).get("out_of_order"),
            "active_recommendations": context_recs
        }
        
        system_instructions = """You are an AI hotel dashboard assistant for the "Nimble" dashboard.
Your goal is to answer the user's question accurately using ONLY the hotel dashboard data provided below.
Rules:
- Be concise and focus on actionable insights.
- Format numbers nicely (e.g. currency, percentages).
- Never estimate or fabricate numbers. If a metric is not present in the data, state clearly that it is not available.
- Mention active recommendations if they relate to the user's question. Use HTML tags like <b>, <i>, <br> for styling your response."""

        prompt = f"""{system_instructions}

DASHBOARD DATA:
{json.dumps(clean_data, indent=2)}

USER QUESTION:
{message}

CONCISE AI RESPONSE:"""
        
        ai_response = call_gemini_chat(prompt)
        response_text = ai_response.replace("\n", "<br>").replace("`", "")

    # Always return both response and conversation_history
    return {
        "response": response_text,
        "conversation_history": request.conversation_history + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": response_text}
        ]
    }

# Mount the static files
app.mount("/", StaticFiles(directory="web", html=True), name="web")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
