"""Mock Nimble API - FastAPI service exposing all 6 dashboard tabs.

Endpoints:
- GET /api/daily-review?property_id=X&start_date=Y&end_date=Z
- GET /api/financial-kpis?property_id=X&start_date=Y&end_date=Z
- GET /api/labour?property_id=X&start_date=Y&end_date=Z
- GET /api/predictive-analytics?property_id=X&start_date=Y&end_date=Z
- GET /api/str-guest-review?property_id=X&year=Y&week=W
- GET /api/custom-widgets?property_id=X&start_date=Y&end_date=Z
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uvicorn
from synthetic_data import NimbleSyntheticData

app = FastAPI(title="Nimble Mock API", version="1.0.0")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize synthetic data generator
data_gen = NimbleSyntheticData(seed=42)


@app.get("/")
async def root():
    return {
        "service": "Nimble Mock API",
        "endpoints": [
            "/api/daily-review",
            "/api/financial-kpis",
            "/api/labour",
            "/api/predictive-analytics",
            "/api/str-guest-review",
            "/api/custom-widgets"
        ]
    }


@app.get("/api/daily-review")
async def get_daily_review(
    property_id: str = Query("bhavana-hotels"),
    start_date: str = Query("2026-07-01"),
    end_date: str = Query("2026-07-31")
):
    """Get My Daily Review tab data."""
    return data_gen.generate_daily_review((start_date, end_date))


@app.get("/api/financial-kpis")
async def get_financial_kpis(
    property_id: str = Query("bhavana-hotels"),
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-12-31")
):
    """Get Financial KPIs tab data."""
    return data_gen.generate_financial_kpis((start_date, end_date))


@app.get("/api/labour")
async def get_labour(
    property_id: str = Query("bhavana-hotels"),
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-12-31")
):
    """Get Labour tab data."""
    return data_gen.generate_labour((start_date, end_date))


@app.get("/api/predictive-analytics")
async def get_predictive_analytics(
    property_id: str = Query("bhavana-hotels"),
    start_date: str = Query("2026-07-01"),
    end_date: str = Query("2026-08-31")
):
    """Get Predictive Analytics (OTB) tab data."""
    return data_gen.generate_predictive_analytics((start_date, end_date))


@app.get("/api/str-guest-review")
async def get_str_guest_review(
    property_id: str = Query("bhavana-hotels"),
    year: int = Query(2026),
    week: int = Query(1)
):
    """Get STR & Guest Review tab data (weekly)."""
    return data_gen.generate_str_guest_review(year, week)


@app.get("/api/custom-widgets")
async def get_custom_widgets(
    property_id: str = Query("bhavana-hotels"),
    start_date: str = Query("2026-01-01"),
    end_date: str = Query("2026-05-31")
):
    """Get Customize Widget tab data."""
    return data_gen.generate_custom_widgets((start_date, end_date))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
