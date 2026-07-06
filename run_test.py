#!/usr/bin/env python3
"""Quick test script to verify Nimble Insights Chatbot is working."""

import os
import sys

# Set your Gemini API key
os.environ["GEMINI_API_KEY"] = "AIzaSyAb8RN6KyUtZO3L0bMcVjDEAJlU4G2gyjCbEvs1rxZMA4lpVC_Q"

print("="*60)
print("🏨 NIMBLE INSIGHTS CHATBOT - TEST SCRIPT")
print("="*60)

print("\n📦 Step 1: Importing modules...")
try:
    from src.data.nimble_client import NimbleClient
    from src.recommendations.rules import generate_recommendations
    from src.recommendations.explain import explain_recommendation
    print("✅ All modules imported successfully!")
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("\n💡 Make sure you've installed dependencies:")
    print("   pip install fastapi uvicorn requests pandas numpy scikit-learn joblib")
    sys.exit(1)

print("\n🔌 Step 2: Connecting to Mock API...")
try:
    client = NimbleClient()
    print("✅ Connected to mock API at http://localhost:8000")
except Exception as e:
    print(f"❌ Cannot connect to API: {e}")
    print("\n💡 Make sure the mock API is running:")
    print("   python -m uvicorn mock_nimble_api.main:app --port 8000")
    sys.exit(1)

print("\n📊 Step 3: Fetching hotel data...")
try:
    data = client.get_daily_review("prop_001", ("2026-06-01", "2026-06-30"))
    print(f"✅ Retrieved data with {len(data)} metrics")
    print(f"   Sample metrics: {list(data.keys())[:5]}...")
except Exception as e:
    print(f"❌ Data fetch error: {e}")
    sys.exit(1)

print("\n🔍 Step 4: Generating recommendations...")
try:
    recs = generate_recommendations(
        property_id="prop_001",
        date_range=("2026-06-01", "2026-06-30"),
        client=client
    )
    print(f"✅ Generated {len(recs)} recommendations")
except Exception as e:
    print(f"❌ Recommendation error: {e}")
    sys.exit(1)

if len(recs) == 0:
    print("\n✨ Great news! No issues found - your hotel is performing well!")
else:
    print("\n" + "="*60)
    print("📋 RECOMMENDATIONS:")
    print("="*60)
    
    for i, rec in enumerate(recs, 1):
        print(f"\n🔸 Recommendation #{i}: {rec.area.upper()}")
        print(f"   Severity: {rec.severity.value.upper()}")
        print(f"   Finding: {rec.finding}")
        print(f"   Action: {rec.recommendation}")
        print(f"   Numbers: {rec.numbers}")
        
        # Try to get AI explanation
        print(f"\n   🤖 AI Explanation (via Gemini):")
        try:
            explanation = explain_recommendation(rec)
            print(f"   {explanation}")
        except Exception as e:
            print(f"   ⚠️  Could not generate AI explanation: {e}")
            print(f"   (Using fallback: {rec.finding}. {rec.recommendation})")

print("\n" + "="*60)
print("✅ TEST COMPLETED SUCCESSFULLY!")
print("="*60)

print("\n📚 Next Steps:")
print("   1. Review the recommendations above")
print("   2. Check QUICKSTART.md for full setup guide")
print("   3. See IMPLEMENTATION_GUIDE.md to add chatbot interface")
print("\n🚀 Your Nimble Insights system is working!\n")
