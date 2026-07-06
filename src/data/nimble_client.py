"""Nimble Data Adapter - HTTP client for Nimble dashboard backend.

This is the ONLY module that knows about HTTP/the mock API's structure.
All other modules consume this adapter's interface, never HTTP directly.

When swapping mock for prod, change BASE_URL config only.
"""
import requests
from typing import Dict, Any, Optional
import os


class NimbleClient:
    """HTTP client adapter for Nimble dashboard data."""
    
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url or os.getenv("NIMBLE_API_BASE_URL", "http://localhost:8000")
    
    def get_daily_review(self, property_id: str, date_range: tuple) -> Dict[str, Any]:
        """Fetch My Daily Review tab data."""
        start_date, end_date = date_range
        response = requests.get(
            f"{self.base_url}/api/daily-review",
            params={"property_id": property_id, "start_date": start_date, "end_date": end_date}
        )
        response.raise_for_status()
        return response.json()
    
    def get_financial_kpis(self, property_id: str, date_range: tuple) -> Dict[str, Any]:
        """Fetch Financial KPIs tab data."""
        start_date, end_date = date_range
        response = requests.get(
            f"{self.base_url}/api/financial-kpis",
            params={"property_id": property_id, "start_date": start_date, "end_date": end_date}
        )
        response.raise_for_status()
        return response.json()
    
    def get_labour(self, property_id: str, date_range: tuple) -> Dict[str, Any]:
        """Fetch Labour tab data."""
        start_date, end_date = date_range
        response = requests.get(
            f"{self.base_url}/api/labour",
            params={"property_id": property_id, "start_date": start_date, "end_date": end_date}
        )
        response.raise_for_status()
        return response.json()
    
    def get_predictive_analytics(self, property_id: str, date_range: tuple) -> Dict[str, Any]:
        """Fetch Predictive Analytics (OTB) tab data."""
        start_date, end_date = date_range
        response = requests.get(
            f"{self.base_url}/api/predictive-analytics",
            params={"property_id": property_id, "start_date": start_date, "end_date": end_date}
        )
        response.raise_for_status()
        return response.json()
    
    def get_str_guest_review(self, property_id: str, year: int, week: int) -> Dict[str, Any]:
        """Fetch STR & Guest Review tab data."""
        response = requests.get(
            f"{self.base_url}/api/str-guest-review",
            params={"property_id": property_id, "year": year, "week": week}
        )
        response.raise_for_status()
        return response.json()
    
    def get_custom_widgets(self, property_id: str, date_range: tuple) -> Dict[str, Any]:
        """Fetch Customize Widget tab data."""
        start_date, end_date = date_range
        response = requests.get(
            f"{self.base_url}/api/custom-widgets",
            params={"property_id": property_id, "start_date": start_date, "end_date": end_date}
        )
        response.raise_for_status()
        return response.json()
