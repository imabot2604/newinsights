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
