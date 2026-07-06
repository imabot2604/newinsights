# 🌐 Run Nimble Insights in Your Web Browser - FREE!

## 🚀 **3 Easy Ways to Run This Project Online**

---

## **Option 1: Replit (Easiest - One Click!)**

### ✨ Best for: Beginners, Quick Testing
### ⏱️ Setup Time: 2 minutes
### 💰 Cost: FREE

**Steps:**

1. **Go to**: https://replit.com
2. **Click**: "Create Repl"
3. **Import from GitHub**: Paste `https://github.com/imabot2604/newinsights`
4. **Add your API key**: 
   - Click on "Secrets" (lock icon)
   - Add: `GEMINI_API_KEY` = `AIzaSyAb8RN6KyUtZO3L0bMcVjDEAJlU4G2gyjCbEvs1rxZMA4lpVC_Q`
5. **Click**: "Run" button

Your app will be live at: `https://newinsights-yourusername.replit.app`

---

## **Option 2: Render.com (Most Reliable)**

### ✨ Best for: Production, Sharing with others
### ⏱️ Setup Time: 5 minutes  
### 💰 Cost: FREE (with auto-sleep after inactivity)

**Steps:**

1. **Go to**: https://render.com
2. **Sign up** with GitHub
3. **Click**: "New" → "Web Service"
4. **Connect**: Your GitHub repo `imabot2604/newinsights`
5. **Configure**:
   - **Name**: `nimble-insights`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m uvicorn mock_nimble_api.main:app --host 0.0.0.0 --port $PORT`
6. **Add Environment Variable**:
   - Click "Environment"
   - Add: `GEMINI_API_KEY` = `AIzaSyAb8RN6KyUtZO3L0bMcVjDEAJlU4G2gyjCbEvs1rxZMA4lpVC_Q`
7. **Click**: "Create Web Service"

Your app will be live at: `https://nimble-insights.onrender.com`

---

## **Option 3: Google Colab (Interactive Testing)**

### ✨ Best for: Quick experiments, ML testing
### ⏱️ Setup Time: 3 minutes
### 💰 Cost: FREE

**Steps:**

1. **Go to**: https://colab.research.google.com
2. **Create new notebook**
3. **Copy-paste this code**:

```python
# Install dependencies
!pip install fastapi uvicorn requests pandas numpy scikit-learn joblib pyngrok -q

# Clone repository
!git clone https://github.com/imabot2604/newinsights.git
%cd newinsights

# Set API key
import os
os.environ["GEMINI_API_KEY"] = "AIzaSyAb8RN6KyUtZO3L0bMcVjDEAJlU4G2gyjCbEvs1rxZMA4lpVC_Q"

# Start ngrok tunnel
from pyngrok import ngrok
import threading

# Start FastAPI in background
def run_api():
    import uvicorn
    from mock_nimble_api.main import app
    uvicorn.run(app, host="0.0.0.0", port=8000)

thread = threading.Thread(target=run_api, daemon=True)
thread.start()

import time
time.sleep(5)  # Wait for API to start

# Create public URL
public_url = ngrok.connect(8000)
print(f"\n✅ Your API is live at: {public_url}")
print(f"\n📊 API Docs: {public_url}/docs")

# Test it
!python run_test.py
```

4. **Run the cell** (Shift+Enter)
5. **Access** your live API via the ngrok URL

---

## 📱 **Simplest Way - Just View the API Docs**

### After deploying with any method above, visit:

```
https://your-deployment-url.com/docs
```

You'll see **interactive API documentation** where you can:
- ✅ Test all endpoints
- ✅ See sample responses
- ✅ Get recommendations
- ✅ View ML forecasts

**No coding required!**

---

## 🎯 **What You Get**

Once deployed, your web app has:

### **6 API Endpoints:**
1. `/api/daily-review` - Hotel performance data
2. `/api/labour` - Payroll and department costs
3. `/api/financial` - Balance sheet & P&L
4. `/api/otb` - On-the-books forecast
5. `/api/str-guest-review` - STR comparison
6. `/api/widgets` - Custom KPIs

### **Auto-Generated Features:**
- 📊 Interactive API documentation
- 🔍 Real-time recommendations
- 🤖 AI explanations via Gemini
- 📈 ML forecasting
- 🎨 Beautiful API interface

---

## 🔧 **Troubleshooting**

### **Replit Issues:**
- **Port error?** → Change to port 5000 in code
- **Can't find modules?** → Click "Packages" and add them
- **Repl sleeps?** → Upgrade to Hacker plan ($7/month) or use Render

### **Render Issues:**
- **Build failed?** → Check `requirements.txt` exists
- **App crashes?** → View logs in Render dashboard
- **Slow to start?** → Free tier has cold starts (normal)

### **Colab Issues:**
- **ngrok expired?** → Re-run the cell to get new URL
- **Session timeout?** → Colab sessions last ~12 hours max
- **Import errors?** → Make sure all pip installs completed

---

## 💡 **Pro Tips**

### **For Replit:**
- Enable "Always On" to prevent sleeping ($7/month)
- Use Replit Database for persistence
- Share via public URL

### **For Render:**
- Free tier sleeps after 15 min inactivity
- Wake-up takes ~30 seconds
- Upgrade to $7/month for always-on

### **For Colab:**
- Perfect for demos and testing
- Session expires after inactivity
- Great for running ML experiments

---

## 🌟 **Recommended Approach**

**For Quick Testing**: Use **Replit**  
**For Production**: Use **Render.com**  
**For ML Experiments**: Use **Google Colab**

---

## 📸 **Expected Results**

### When you visit `/docs`, you'll see:

```
╔═══════════════════════════════════╗
║   Nimble Insights API             ║
║   Interactive Documentation       ║
╠═══════════════════════════════════╣
║                                   ║
║  📊 GET /api/daily-review        ║
║  👥 GET /api/labour              ║
║  💰 GET /api/financial           ║
║  📈 GET /api/otb                 ║
║  ⭐ GET /api/str-guest-review   ║
║  📱 GET /api/widgets             ║
║                                   ║
║  [Try it out] buttons for each    ║
╚═══════════════════════════════════╝
```

Click any "Try it out" button to test the API!

---

## 🚀 **Next Steps After Deployment**

1. ✅ Test all endpoints in `/docs`
2. 📝 Share the URL with your team
3. 🔗 Integrate with frontend apps
4. 📊 Connect to real hotel data
5. 🎨 Customize recommendations

---

## 🆘 **Need Help?**

- **Replit Docs**: https://docs.replit.com
- **Render Docs**: https://render.com/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com

---

**Your Nimble Insights system is ready to run in the cloud! 🌐✨**
