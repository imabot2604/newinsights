"""LLM-based explanation layer using Google Gemini (free API)."""
import os
import requests
from .models import Recommendation

def explain_recommendation(rec: Recommendation) -> str:
    """Generate natural language explanation using Google Gemini.
    
    Get free API key from: https://makersuite.google.com/app/apikey
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return f"{rec.finding}. {rec.recommendation}"
    
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
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{"text": prompt}]
        }],
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 200
        }
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        result = response.json()
        text = result['candidates'][0]['content']['parts'][0]['text']
        return text.strip()
    except Exception as e:
        # Fallback to basic template if API fails
        return f"{rec.finding}. {rec.recommendation}"
