"""Adaptive TDEE Engine.

Calculates the user's true metabolic rate based on the energy balance equation:
actual_tdee ≈ avg_intake - (weight_change * 7700 / days)

Uses linear regression on recent weight data to find the trend, and averages
recent caloric intake to find the energy input.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass

from pydantic import BaseModel

KCAL_PER_KG_BODY = 7700


class WeightData(BaseModel):
    date: datetime.date
    weight_kg: float


class CalorieData(BaseModel):
    date: datetime.date
    kcal: float


@dataclass
class AdaptiveTDEEResult:
    available: bool
    tdee: float = 0.0
    data_days: int = 0
    confidence: str = "Low"
    reason: str | None = None


def _linear_regression_slope(x: list[float], y: list[float]) -> float:
    """Calculate the slope of the best-fit line (change in y per unit x)."""
    n = len(x)
    if n < 2:
        return 0.0
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    sum_xx = sum(xi * xi for xi in x)
    
    denominator = n * sum_xx - sum_x * sum_x
    if denominator == 0:
        return 0.0
        
    return (n * sum_xy - sum_x * sum_y) / denominator


def compute_adaptive_tdee(
    weight_series: list[WeightData],
    calorie_series: list[CalorieData],
    today: datetime.date,
    window_days: int = 21,
    min_days: int = 7,
) -> AdaptiveTDEEResult:
    """Compute adaptive TDEE from recent weight and intake data.
    
    Args:
        weight_series: User's weight history.
        calorie_series: User's daily calorie intake history.
        today: The reference date for the end of the window.
        window_days: How many days back to look.
        min_days: Minimum number of data points required to compute.
    """
    cutoff_date = today - datetime.timedelta(days=window_days)
    
    # Filter to window
    recent_weights = [w for w in weight_series if w.date > cutoff_date]
    recent_cals = [c for c in calorie_series if c.date > cutoff_date]
    
    if len(recent_weights) < min_days:
        return AdaptiveTDEEResult(
            available=False,
            reason=f"Need at least {min_days} weigh-ins in the last {window_days} days to compute adaptive TDEE. Keep logging!"
        )
        
    if len(recent_cals) < min_days:
        return AdaptiveTDEEResult(
            available=False,
            reason=f"Need at least {min_days} days of calorie logs in the last {window_days} days. Keep logging!"
        )

    # 1. Calculate Average Intake
    avg_intake = sum(c.kcal for c in recent_cals) / len(recent_cals)

    # 2. Calculate Weight Trend (kg / day) using Linear Regression
    # Convert dates to days offset from the start of the window
    start_date = recent_weights[0].date
    x_days = [(w.date - start_date).days for w in recent_weights]
    y_weights = [w.weight_kg for w in recent_weights]
    
    trend_kg_per_day = _linear_regression_slope(x_days, y_weights)

    # 3. Energy Balance Equation
    # If gaining weight (positive trend), intake is > TDEE.
    # TDEE = intake - (surplus)
    # surplus = trend_kg_per_day * KCAL_PER_KG_BODY
    tdee = avg_intake - (trend_kg_per_day * KCAL_PER_KG_BODY)
    
    # Cap the TDEE to realistic human bounds just in case of weird data
    # (e.g. 1000 to 5000 kcal)
    tdee = max(1000.0, min(5000.0, tdee))

    # Calculate confidence
    data_density = min(len(recent_weights), len(recent_cals)) / window_days
    if data_density > 0.8:
        confidence = "High"
    elif data_density > 0.5:
        confidence = "Medium"
    else:
        confidence = "Low"

    return AdaptiveTDEEResult(
        available=True,
        tdee=tdee,
        data_days=min(len(recent_weights), len(recent_cals)),
        confidence=confidence,
    )
