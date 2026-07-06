"""Compute specific numbers for recommendations."""

def compute_rate_adjustment(current_adr: float, occupancy_gap_pts: float, elasticity: float = -0.5) -> float:
    """Linear elasticity model for rate reduction.
    
    Args:
        current_adr: Current ADR
        occupancy_gap_pts: Occupancy points behind comp set
        elasticity: Price elasticity (default -0.5: 1% rate drop => 0.5% occ increase)
    
    Returns:
        Suggested ADR reduction in dollars
    """
    # How much rate change needed to close gap?
    # occ_gap = rate_change * elasticity
    # rate_change = occ_gap / elasticity
    rate_change_pct = (occupancy_gap_pts / abs(elasticity)) / 100  # Convert to decimal
    rate_reduction = current_adr * rate_change_pct
    return max(1.0, rate_reduction)  # At least $1
