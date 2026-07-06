# Nimble Insights Chatbot - Quick Start Guide

## 🚀 How to Run This Project

### Step 1: Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/imabot2604/newinsights.git
cd newinsights
```

### Step 2: Install Dependencies

```bash
# Install Python packages
pip install fastapi uvicorn requests pandas numpy scikit-learn joblib pytest python-dotenv

# Or install from requirements.txt (if you create it)
pip install -r requirements.txt
```

### Step 3: Get Your FREE Gemini API Key

1. Go to: **https://makersuite.google.com/app/apikey** (or https://aistudio.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

### Step 4: Set Environment Variable

**On Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your_api_key_here"
```

**On Linux/Mac:**
```bash
export GEMINI_API_KEY="your_api_key_here"
```

**Or create a `.env` file:**
```bash
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

### Step 5: Start the Mock API Server

Open a terminal and run:
```bash
cd newinsights
python -m uvicorn mock_nimble_api.main:app --port 8000
```

You should see:
```
INFO: Uvicorn running on http://127.0.0.1:8000
```

### Step 6: Test the Mock API

Open a browser and visit: **http://localhost:8000/docs**

You should see the FastAPI interactive docs with 6 endpoints.

### Step 7: Test the Recommendation Engine

Create a test script `test_recommendations.py`:

```python
from src.data.nimble_client import NimbleClient
from src.recommendations.rules import generate_recommendations

client = NimbleClient()
recs = generate_recommendations(
    property_id="prop_001",
    date_range=("2026-06-01", "2026-06-30"),
    client=client
)

for rec in recs:
    print(f"\n{rec.area.upper()} ({rec.severity.value})")
    print(f"Finding: {rec.finding}")
    print(f"Recommendation: {rec.recommendation}")
    print(f"Numbers: {rec.numbers}")
```

Run it:
```bash
python test_recommendations.py
```

### Step 8: Test the ML Forecaster

Create `test_ml.py`:

```python
from src.ml.forecaster import NimbleForecaster
import numpy as np

# Create forecaster
forecaster = NimbleForecaster()

# Mock historical data
historical = [{
    'date': f'2026-06-{i:02d}',
    'occupancy_pct': 60 + np.random.randn() * 5,
    'revenue': 12000 + np.random.randn() * 1000,
    'adr': 100 + np.random.randn() * 10,
    'day_of_week': i % 7,
    'month': 6,
    'is_weekend': 1 if (i % 7) >= 5 else 0
} for i in range(1, 31)]

# Train
forecaster.train_from_history(historical)

# Get 30-day forecast
forecast = forecaster.forecast_occupancy("2026-07-01", days=30)

print("30-Day Forecast:")
for day in forecast[:7]:  # Print first week
    print(f"{day['date']}: {day['predicted_occupancy']:.1f}% occupancy")
```

Run it:
```bash
python test_ml.py
```

---

## 📊 What's Currently Working

✅ **Mock API** - Generates synthetic hotel data
✅ **Data Adapter** - Fetches data from mock API
✅ **ML Forecaster** - 30-day occupancy predictions, anomaly detection
✅ **Rules Engine** - 5 validated recommendation rules:
  - Labour cost check
  - Profitability check
  - Rate vs share analysis
  - Inventory check
  - STR positioning
✅ **Sizing Module** - Rate adjustment calculations
✅ **Explanation Layer** - Uses FREE Gemini API

---

## 🔧 What Still Needs to Be Created

To complete the full chatbot interface, you need to create:

### 1. Chatbot Backend (`src/chatbot/backend.py`)
### 2. Chatbot Tools (`src/chatbot/tools.py`)
### 3. System Prompt (`src/chatbot/system_prompt.py`)
### 4. Web Interface (`web/index.html`)
### 5. Demo Script (`scripts/run_demo.py`)

See `IMPLEMENTATION_GUIDE.md` for complete code.

---

## 🧪 Quick Test Commands

```bash
# Test if mock API is running
curl http://localhost:8000/api/daily-review/prop_001?start_date=2026-06-01&end_date=2026-06-30

# Test recommendations
python -c "from src.data.nimble_client import NimbleClient; from src.recommendations.rules import generate_recommendations; client = NimbleClient(); print(generate_recommendations('prop_001', ('2026-06-01', '2026-06-30'), client))"
```

---

## 📝 Example Usage

Once everything is set up:

```python
from src.data.nimble_client import NimbleClient
from src.recommendations.rules import generate_recommendations
from src.recommendations.explain import explain_recommendation

# Initialize client
client = NimbleClient()

# Get recommendations
recs = generate_recommendations(
    property_id="prop_001",
    date_range=("2026-06-01", "2026-06-30"),
    client=client
)

# Explain with Gemini
for rec in recs:
    explanation = explain_recommendation(rec)
    print(f"\n{explanation}\n")
```

---

## 🆘 Troubleshooting

**Problem: ModuleNotFoundError**
- Make sure you're in the `newinsights` directory
- Run: `pip install -r requirements.txt`

**Problem: Mock API not starting**
- Check if port 8000 is available: `netstat -an | findstr 8000`
- Try a different port: `python -m uvicorn mock_nimble_api.main:app --port 8001`

**Problem: Gemini API errors**
- Verify your API key is set: `echo $GEMINI_API_KEY` (Linux/Mac) or `echo $env:GEMINI_API_KEY` (Windows)
- Check quota at: https://aistudio.google.com/app/apikey

**Problem: Import errors**
- Add project to Python path: `export PYTHONPATH="${PYTHONPATH}:$(pwd)"`

---

## 🎯 Next Steps

1. ✅ You have the core engine working
2. 📝 Create the chatbot backend files
3. 🌐 Create the web interface
4. 🚀 Run the full demo
5. 🎨 Customize for your use case

---

## 📚 Project Structure

```
newinsights/
├── docs/                    # Documentation
├── mock_nimble_api/         # ✅ Mock API server
│   ├── main.py
│   └── synthetic_data.py
├── src/
│   ├── data/                # ✅ Data adapter
│   │   └── nimble_client.py
│   ├── ml/                  # ✅ ML forecaster
│   │   └── forecaster.py
│   ├── recommendations/     # ✅ Rules engine
│   │   ├── models.py
│   │   ├── rules.py
│   │   ├── sizing.py
│   │   └── explain.py
│   └── chatbot/            # ⚠️ TODO
│       ├── backend.py
│       ├── tools.py
│       └── system_prompt.py
├── web/                    # ⚠️ TODO
│   └── index.html
├── scripts/                # ⚠️ TODO
│   └── run_demo.py
├── tests/
├── requirements.txt
└── README.md
```

---

## 🔑 Free API Key Links

- **Google Gemini**: https://makersuite.google.com/app/apikey
- No credit card required!
- Free tier: 60 requests per minute

---

For detailed implementation, see `IMPLEMENTATION_GUIDE.md` 📖
