# ML-Enhanced Nimble Insights Chatbot

## ✅ What Changed: REMOVED the "No ML" Constraint

You asked me to remove the constraint about not training ML models. The system now includes **full ML-powered intelligence** for predictive analytics and trend explanation.

## 🤖 NEW ML Capabilities

### 1. **30-Day Occupancy Forecasting** (Random Forest)

**What it does:**
- Predicts occupancy for next 30 days with confidence intervals
- Uses historical patterns (weekday/weekend, monthly seasonality)
- Auto-trains on 90 days of history

**Example conversation:**
```
You: "What will our occupancy be next week?"

Bot: "Based on ML forecast, next week's predicted occupancy:
      - Mon-Thu: 58-62% (weekday pattern)
      - Fri-Sun: 68-72% (weekend boost)
      - Average: 63% with ±5% confidence interval
      The model shows continued moderate demand consistent with July patterns."
```

**How to use:**
```python
from src.ml.forecaster import NimbleForecaster

forecaster = NimbleForecaster()
forecaster.train_from_history(historical_data)
forecast = forecaster.forecast_occupancy("2026-07-15", days=30)
# Returns: [{date, predicted_occupancy, confidence_lower, confidence_upper}, ...]
```

### 2. **Anomaly Detection** (Isolation Forest)

**What it does:**
- Automatically flags unusual performance patterns
- Detects outliers in occupancy/revenue/ADR combinations
- Scores severity (high/medium)

**Example conversation:**
```
You: "Were there any unusual patterns this week?"

Bot: "Yes, anomaly detected on July 3rd (severity: high):
      - Occupancy 42% vs typical 58-65% range
      - Revenue $8,200 vs typical $12,000-15,000
      This represents a significant deviation from normal performance.
      Investigate local events, comp set activity, or pricing issues."
```

**How to use:**
```python
anomalies = forecaster.detect_anomalies(recent_7_days_data)
# Returns: [{date, metric, value, severity, explanation}, ...]
```

### 3. **Causal Trend Explanation** (Feature Importance)

**What it does:**
- Explains WHY revenue/occupancy changed
- Identifies primary drivers (occupancy shift, pricing change, weekday mix)
- Quantifies each factor's contribution

**Example conversation:**
```
You: "Why did revenue drop this week vs last week?"

Bot: "Revenue decreased by $3,200 (-18.2%). Primary drivers:
      1. Occupancy: decreased 12.5 percentage points (primary factor)
      2. Pricing: ADR decreased $4.50 per room (secondary factor)
      3. Weekday mix: shifted from weekend-heavy to weekday-heavy
      
      The occupancy drop is the main driver, accounting for ~75% of the revenue change."
```

**How to use:**
```python
explanation = forecaster.explain_trend_change(current_week, previous_week)
# Returns: {metric, change, change_pct, drivers: [{factor, contribution, direction, impact}]}
```

### 4. **Performance Clustering** (K-Means)

**What it does:**
- Groups similar performance periods into 3 clusters (high/moderate/low demand)
- Identifies which cluster the current period belongs to
- Helps understand seasonal patterns

**Example conversation:**
```
You: "What kind of demand period are we in?"

Bot: "Current performance matches Cluster 1 (Moderate-demand period):
      - Typical occupancy: 55-65%
      - Typical revenue: $12K-15K
      - Similar periods: March 15-30, June 1-15, Sept 10-25
      
      This is consistent with shoulder season patterns. Consider strategies
      from previous moderate-demand periods that performed well."
```

**How to use:**
```python
clusters = forecaster.cluster_performance_periods(historical_data, n_clusters=3)
# Returns: {clusters: [{id, characteristics, size, sample_dates}], current_cluster_id, interpretation}
```

## 🔧 Integration with Chatbot

The ML forecaster integrates seamlessly with the existing chatbot via a new tool:

**Chatbot Tool: `get_ml_insights`**
```python
{
    "name": "get_ml_insights",
    "description": "Get ML-powered forecasts, anomaly detection, trend explanation, and performance clustering",
    "input_schema": {
        "type": "object",
        "properties": {
            "property_id": {"type": "string"},
            "start_date": {"type": "string"},
            "end_date": {"type": "string"}
        },
        "required": ["property_id", "start_date", "end_date"]
    }
}
```

Add this to `src/chatbot/tools.py` TOOLS list and implement in `execute_tool()`:

```python
elif tool_name == "get_ml_insights":
    from ..ml.forecaster import generate_ml_insights
    return generate_ml_insights(
        tool_input["property_id"],
        (tool_input["start_date"], tool_input["end_date"]),
        client
    )
```

## 📊 What the System CAN Now Do (Updated)

### ✅ All Original Capabilities PLUS:

1. ✅ **Predict future occupancy** (30-day ML forecast)
2. ✅ **Explain trend causes** ("WHY did revenue drop?")
3. ✅ **Detect anomalies automatically** (flag unusual patterns)
4. ✅ **Cluster performance periods** (identify similar demand periods)
5. ✅ **Provide confidence intervals** (quantify uncertainty)
6. ✅ **Auto-train on history** (learns from your property's patterns)
7. ✅ **Feature importance analysis** (rank drivers of change)

### ❌ What It Still WON'T Do:

- ❌ Invent or estimate numbers (all predictions are ML model outputs)
- ❌ Access production data directly (needs adapter swap)
- ❌ Modify dashboard data (read-only)
- ❌ Make vague recommendations (all recommendations still specific + computed)

## 🚀 Example Enhanced Conversations

### Predictive Questions
```
You: "Should I worry about next month?"

Bot: [Calls get_ml_insights]
     "ML forecast for next 30 days shows:
     - Average occupancy: 61% (±5%)
     - Peak demand: July 25-28 weekend (72-75%)
     - Soft period: July 15-18 midweek (52-56%)
     
     No major concerns, but consider dynamic pricing for the soft midweek period."
```

### Analytical Questions
```
You: "Why is performance different this month?"

Bot: [Calls get_ml_insights]
     "Trend analysis shows revenue is up 15% vs last month. Primary drivers:
     1. Occupancy increased 8 percentage points (main driver)
     2. ADR increased $3.50 (secondary driver)
     3. More weekend days this month (calendar effect)
     
     Performance cluster analysis shows you've moved from Cluster 2 (low-demand)
     to Cluster 1 (moderate-demand), consistent with seasonal patterns."
```

### Anomaly Detection
```
You: "Anything unusual lately?"

Bot: [Calls get_ml_insights]
     "Yes, high-severity anomaly detected on July 3rd:
     - Occupancy 42% (typical range: 58-65%)
     - Revenue $8,200 (typical range: $12K-15K)
     
     This is 2.5 standard deviations below normal. Investigate potential causes:
     - Local events/holidays affecting demand
     - Comp set aggressive pricing
     - System/booking issues"
```

## 🧪 Testing ML Features

**Test file: `tests/test_ml_forecaster.py`** (add this)
```python
import pytest
from src.ml.forecaster import NimbleForecaster
import numpy as np

def test_forecaster_trains_successfully():
    forecaster = NimbleForecaster()
    
    # Mock historical data
    historical = [{
        'date': f'2026-06-{i:02d}',
        'occupancy_pct': 60 + np.random.randn() * 5,
        'revenue': 12000 + np.random.randn() * 1000,
        'adr': 100 + np.random.randn() * 10,
        'day_of_week': i % 7,
        'month': 6,
        'is_weekend': 1 if (i % 7) >= 4 else 0
    } for i in range(1, 31)]
    
    forecaster.train_from_history(historical)
    assert forecaster.is_trained

def test_forecast_produces_30_predictions():
    forecaster = NimbleForecaster()
    # ... train ...
    forecast = forecaster.forecast_occupancy("2026-07-01", days=30)
    assert len(forecast) == 30
    assert all('predicted_occupancy' in p for p in forecast)

def test_anomaly_detection():
    forecaster = NimbleForecaster()
    # ... train ...
    
    # Create anomalous data point
    recent = [{'occupancy_pct': 20, 'revenue': 3000, 'adr': 50}]  # Way off
    anomalies = forecaster.detect_anomalies(recent)
    assert len(anomalies) > 0
```

## 📦 Updated Dependencies

Added to `requirements.txt`:
```
scikit-learn>=1.3.0
joblib>=1.3.0
```

## 🎯 Use Cases Unlocked

1. **Revenue Manager**: "What's my forecast for next month?" → Get ML predictions
2. **GM**: "Why did we underperform last week?" → Get causal explanation
3. **Analyst**: "Are there any unusual patterns?" → Auto anomaly detection
4. **Strategy**: "What demand period are we in?" → Clustering insights
5. **Operations**: "Should I hire temp staff next week?" → Occupancy forecast

## 🔄 Migration Path

If you already have the rules-only system:
1. ✅ ML module added: `src/ml/forecaster.py`
2. ✅ Requirements updated with sklearn
3. ⚠️ Add `get_ml_insights` tool to `src/chatbot/tools.py`
4. ⚠️ Update system prompt to mention ML capabilities

The rules engine and ML forecaster work **in parallel** - rules handle operational recommendations, ML handles predictive/analytical questions.

---

**Status**: ML module implemented and committed. Add the chatbot tool integration from IMPLEMENTATION_GUIDE.md to enable ML queries.

**Schema**: Verified from Figma (all 6 tabs)
**Repository**: https://github.com/imabot2604/newinsights
