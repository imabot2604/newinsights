"""Synthetic data generator for Nimble dashboard mock API.

Generates realistic hotel analytics data with:
- Seasonality patterns
- Weekday/weekend variations
- Deliberately weak periods for testing recommendations
- Comp set that sometimes leads/trails property performance
"""
import random
import math
from datetime import datetime, timedelta
from typing import Dict, List, Any


class NimbleSyntheticData:
    def __init__(self, seed: int = 42):
        random.seed(seed)
        self.property_name = "Bhavana Hotels"
        self.total_rooms = 178
        self.base_occupancy = 0.60
        self.base_adr = 102.0
        
    def _seasonality_factor(self, date: datetime) -> float:
        """Returns 0.8-1.2 based on month (high season Dec-Feb, low season Jun-Aug)."""
        month = date.month
        if month in [12, 1, 2]:  # Peak season
            return 1.15
        elif month in [6, 7, 8]:  # Low season
            return 0.85
        else:
            return 1.0
    
    def _weekday_factor(self, date: datetime) -> float:
        """Returns 0.9 for Mon-Thu, 1.1 for Fri-Sun."""
        weekday = date.weekday()
        if weekday in [4, 5, 6]:  # Fri, Sat, Sun
            return 1.1
        else:
            return 0.9
    
    def _add_noise(self, value: float, variance: float = 0.05) -> float:
        """Add random noise to value."""
        return value * (1 + random.uniform(-variance, variance))
    
    def generate_daily_review(self, date_range: tuple) -> Dict[str, Any]:
        """Generate My Daily Review tab data."""
        start_date, end_date = date_range
        current = datetime.strptime(start_date, "%Y-%m-%d")
        
        # Base metrics with deliberate issues for testing
        season_f = self._seasonality_factor(current)
        weekday_f = self._weekday_factor(current)
        
        occupancy_pct = self._add_noise(self.base_occupancy * season_f * weekday_f)
        occupancy_pct = max(0.3, min(0.95, occupancy_pct))  # Clamp
        
        occupied_rooms = int(self.total_rooms * occupancy_pct)
        vacant_rooms = self.total_rooms - occupied_rooms - 3  # 3 OOO deliberately
        out_of_order = 3  # Deliberately > 3% for recommendation trigger
        
        adr = self._add_noise(self.base_adr * season_f)
        revpar = adr * occupancy_pct
        
        # Revenue breakdown
        room_revenue = adr * occupied_rooms
        fb_revenue = room_revenue * 0.35
        other_revenue = room_revenue * 0.15
        total_income = room_revenue + fb_revenue + other_revenue
        
        # Expenses - deliberately high payroll for testing
        room_expenses = room_revenue * 0.25
        fb_expenses = fb_revenue * 0.28
        other_expenses_dept = other_revenue * 0.30
        gop = total_income - (room_expenses + fb_expenses + other_expenses_dept)
        
        # Non-departmental - deliberately high for negative EBITDA scenario
        undist_other_exp = total_income * 0.45  # Deliberately high
        ebitda = gop - undist_other_exp
        ebitda_pct = (ebitda / total_income * 100) if total_income > 0 else 0
        
        other_expenses_nondept = total_income * 0.12
        net_income = ebitda - other_expenses_nondept
        
        # Guest reviews
        guest_reviews = {
            "social_reviews": 4.2,
            "tripadvisor": 2.9,  # Deliberately low
            "expedia": 4.4,
            "booking_com": 3.4,
            "google": 4.2,
            "overall_exp_pct": 55.45,
            "room_cleanness_pct": 75.25,
            "likely_recommended_pct": 65.55,
            "hotel_condition_pct": 89.45
        }
        
        # STR data
        comp_set_occ = occupancy_pct * 1.20  # Comp set deliberately higher
        comp_set_adr = adr * 0.95
        comp_set_revpar = comp_set_occ * comp_set_adr
        
        mpi = (occupancy_pct / comp_set_occ * 100) if comp_set_occ > 0 else 100
        ari = (adr / comp_set_adr * 100) if comp_set_adr > 0 else 100
        rgi = (revpar / comp_set_revpar * 100) if comp_set_revpar > 0 else 100
        
        return {
            "occupancy": {
                "pct": round(occupancy_pct * 100, 2),
                "total_rooms": self.total_rooms,
                "occupied": occupied_rooms,
                "vacant": vacant_rooms,
                "out_of_order": out_of_order,
                "daily_trend": self._generate_weekly_trend(occupancy_pct)
            },
            "adr": {
                "value": round(adr, 2),
                "daily_trend": self._generate_weekly_trend(adr / 100)
            },
            "revpar": {
                "value": round(revpar, 2),
                "daily_trend": self._generate_weekly_trend(revpar / 100)
            },
            "revenue_summary": {
                "room_revenue": round(room_revenue, 2),
                "fb_revenue": round(fb_revenue, 2),
                "other_revenue": round(other_revenue, 2),
                "total_income": round(total_income, 2)
            },
            "dep_exp_summary": {
                "room_expenses": round(room_expenses, 2),
                "fb_expenses": round(fb_expenses, 2),
                "other_expenses": round(other_expenses_dept, 2),
                "gop": round(gop, 2)
            },
            "non_dep_exp_summary": {
                "undist_other_exp": round(undist_other_exp, 2),
                "ebitda": round(ebitda, 2),
                "ebitda_pct": round(ebitda_pct, 2),
                "other_expenses": round(other_expenses_nondept, 2),
                "net_income": round(net_income, 2)
            },
            "guest_reviews": guest_reviews,
            "str": {
                "occupancy": {
                    "my_property": round(occupancy_pct * 100, 2),
                    "comp_set": round(comp_set_occ * 100, 2),
                    "mpi": round(mpi, 2),
                    "rank": 1 if mpi > 100 else 4
                },
                "adr": {
                    "my_property": round(adr, 2),
                    "comp_set": round(comp_set_adr, 2),
                    "ari": round(ari, 2),
                    "rank": 2
                },
                "revpar": {
                    "my_property": round(revpar, 2),
                    "comp_set": round(comp_set_revpar, 2),
                    "rgi": round(rgi, 2),
                    "rank": 3
                }
            }
        }
    
    def _generate_weekly_trend(self, base_value: float) -> List[float]:
        """Generate Mon-Sun trend."""
        return [round(base_value * (1 + random.uniform(-0.1, 0.1)), 2) for _ in range(7)]
    
    def generate_financial_kpis(self, date_range: tuple) -> Dict[str, Any]:
        """Generate Financial KPIs tab data."""
        return {
            "balance_sheet": {
                "assets": 10469198.80,
                "liabilities": 13409528.92,
                "equity": -2934130.52,  # Negative deliberately
                "trend": self._generate_monthly_trend(10000000, 12)
            },
            "profit_loss": {
                "income": 1254600.00,
                "expense": 1000.00,
                "net_income": 1253600.00,
                "trend": self._generate_monthly_trend(1200000, 12)
            }
        }
    
    def _generate_monthly_trend(self, base: float, months: int) -> List[Dict]:
        """Generate monthly trend data."""
        result = []
        for i in range(months):
            result.append({
                "month": i + 1,
                "value": round(base * (1 + random.uniform(-0.15, 0.15)), 2)
            })
        return result
    
    def generate_labour(self, date_range: tuple) -> Dict[str, Any]:
        """Generate Labour tab data."""
        total_revenue = 50000.00
        payroll_expenses = 26125.00  # 52.25% deliberately high
        payroll_pct = (payroll_expenses / total_revenue * 100)
        
        # Monthly breakdown
        monthly_data = []
        for month in range(1, 13):
            rev = total_revenue * (1 + random.uniform(-0.2, 0.2))
            payroll = rev * 0.52  # Keep high ratio
            monthly_data.append({
                "month": month,
                "revenue": round(rev, 2),
                "payroll_exp": round(payroll, 2),
                "payroll_salary": round(payroll * 0.6, 2),
                "occupancy": round(random.uniform(50, 90), 1)
            })
        
        # Department breakdown - Room dept at 95% of budget (trigger)
        payroll_department = [
            {"dept": "Room", "budget": 45000, "current": 42750, "pct_of_budget": 95.0},
            {"dept": "F&B", "budget": 52000, "current": 47000, "pct_of_budget": 90.4},
            {"dept": "S&M", "budget": 35000, "current": 28000, "pct_of_budget": 80.0},
            {"dept": "IT", "budget": 28000, "current": 25000, "pct_of_budget": 89.3},
            {"dept": "Others", "budget": 32000, "current": 27000, "pct_of_budget": 84.4}
        ]
        
        # Labor analysis categories
        labor_categories = [
            {"department": "Salary & Wages - Regular", "hours": 10162.50, "payroll_expenses": 162247.16, "mpor": "2:30", "avg_hrs": "1:30", "pct_income": "10:58%"},
            {"department": "Salary & Wages - OT", "hours": 0.00, "payroll_expenses": 0.00, "mpor": "2:30", "avg_hrs": "1:30", "pct_income": "10:58%"},
            {"department": "Salary & Wages - Contract Labor", "hours": 0.00, "payroll_expenses": 0.00, "mpor": "2:30", "avg_hrs": "1:30", "pct_income": "10:58%"},
            {"department": "Payroll Taxes", "hours": 0, "payroll_expenses": 14878.26, "mpor": "2:30", "avg_hrs": "1:30", "pct_income": "10:58%"},
            {"department": "Supplemental Pay", "hours": 0, "payroll_expenses": 0.00, "mpor": "2:30", "avg_hrs": "1:30", "pct_income": "10:58%"}
        ]
        
        return {
            "total_revenue": total_revenue,
            "payroll_expenses": payroll_expenses,
            "payroll_pct": round(payroll_pct, 2),
            "monthly_data": monthly_data,
            "payroll_department": payroll_department,
            "labor_categories": labor_categories
        }
    
    def generate_predictive_analytics(self, date_range: tuple) -> Dict[str, Any]:
        """Generate Predictive Analytics (OTB) tab data."""
        start_date = datetime.strptime(date_range[0], "%Y-%m-%d")
        
        # Generate daily forecast for next 60 days
        daily_data = []
        for i in range(60):
            date = start_date + timedelta(days=i)
            season_f = self._seasonality_factor(date)
            weekday_f = self._weekday_factor(date)
            
            my_occ = self._add_noise(self.base_occupancy * season_f * weekday_f)
            my_occ = max(0.3, min(0.95, my_occ))
            
            comp_occ = my_occ * 1.18  # Comp set ahead
            my_adr = self._add_noise(self.base_adr * season_f)
            comp_adr = my_adr * 0.96
            
            mpi = (my_occ / comp_occ * 100) if comp_occ > 0 else 100
            ari = (my_adr / comp_adr * 100) if comp_adr > 0 else 100
            
            # Rank based on performance
            if my_occ > comp_occ:
                occ_rank = 2
            else:
                occ_rank = 5
            
            daily_data.append({
                "date": date.strftime("%Y-%m-%d"),
                "occupancy": {
                    "my_property": round(my_occ * 100, 2),
                    "comp_set": round(comp_occ * 100, 2),
                    "mpi": round(mpi, 2),
                    "rank": occ_rank
                },
                "adr": {
                    "my_property": round(my_adr, 2),
                    "comp_set": round(comp_adr, 2),
                    "ari": round(ari, 2),
                    "rank": 2
                },
                "revpar": {
                    "my_property": round(my_occ * my_adr, 2),
                    "comp_set": round(comp_occ * comp_adr, 2),
                    "rgi": round((my_occ * my_adr) / (comp_occ * comp_adr) * 100, 2) if (comp_occ * comp_adr) > 0 else 100,
                    "rank": 3
                }
            })
        
        # OTB Pickup overview
        otb_pickup = {
            "1_day": 1247,
            "3_days": 1247,
            "7_days": 128.57,
            "14_days": 128.57
        }
        
        return {
            "otb_overview": {
                "occupancy": 59.36,
                "adr": 102.13,
                "revpar": 128.57
            },
            "daily_forecast": daily_data,
            "otb_pickup": otb_pickup
        }
    
    def generate_str_guest_review(self, year: int, week: int) -> Dict[str, Any]:
        """Generate STR & Guest Review tab data (weekly granularity)."""
        weekly_data = []
        for day in range(7):  # Sun-Sat
            my_occ = self._add_noise(self.base_occupancy)
            comp_occ = my_occ * 1.15
            my_adr = self._add_noise(self.base_adr)
            comp_adr = my_adr * 0.97
            
            weekly_data.append({
                "day": ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day],
                "occupancy": {
                    "my_property": round(my_occ * 100, 2),
                    "comp_set": round(comp_occ * 100, 2),
                    "mpi": round((my_occ / comp_occ * 100), 2),
                    "rank": 4
                },
                "adr": {
                    "my_property": round(my_adr, 2),
                    "comp_set": round(comp_adr, 2),
                    "ari": round((my_adr / comp_adr * 100), 2),
                    "rank": 2
                },
                "revpar": {
                    "my_property": round(my_occ * my_adr, 2),
                    "comp_set": round(comp_occ * comp_adr, 2),
                    "rgi": round((my_occ * my_adr) / (comp_occ * comp_adr) * 100, 2),
                    "rank": 3
                }
            })
        
        return {
            "year": year,
            "week": week,
            "weekly_data": weekly_data
        }
    
    def generate_custom_widgets(self, date_range: tuple) -> Dict[str, Any]:
        """Generate Customize Widget tab data."""
        return {
            "trevpar": {"value": 59.36, "trend": self._generate_weekly_trend(0.60)},
            "goppar": {"value": 102.13, "trend": self._generate_weekly_trend(100)},
            "revenue_per_sqm": {"value": 128.57, "trend": self._generate_weekly_trend(130)},
            "revenue_trend": {
                "actual": self._generate_monthly_trend(170, 5),
                "budget": self._generate_monthly_trend(160, 5),
                "forecast": self._generate_monthly_trend(165, 5),
                "ly_actual": self._generate_monthly_trend(175, 5)
            },
            "labor_analysis_dept": [
                {"department": "Front Office", "stats_hours": 2500, "amount": 45000, "pct_income": 12.5, "mpor": "2:15", "avg_hrs": "1:20", "por": 0.85},
                {"department": "Housekeeping", "stats_hours": 3200, "amount": 52000, "pct_income": 14.2, "mpor": "2:45", "avg_hrs": "1:45", "por": 0.92},
                {"department": "F&B Service", "stats_hours": 2800, "amount": 48000, "pct_income": 13.1, "mpor": "2:30", "avg_hrs": "1:35", "por": 0.88}
            ]
        }
