"""Rules engine - 5 validated rules from spec."""
from typing import List, Dict, Any, Optional
from .models import Recommendation, Severity

def check_labour_cost(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 1: Payroll % of revenue > 45%."""
    payroll_pct = data.get("payroll_pct", 0)
    if payroll_pct < 45:
        return None
    
    severity = Severity.SEVERE if payroll_pct > 55 else Severity.MODERATE
    
    # Find departments at/above 90% budget
    problem_depts = [d["dept"] for d in data.get("payroll_department", [])
                    if d.get("pct_of_budget", 0) >= 90]
    
    return Recommendation(
        area="labour_cost",
        severity=severity,
        finding=f"Payroll at {payroll_pct}% of revenue (threshold: 45%)",
        recommendation=f"Review staffing levels in: {', '.join(problem_depts) if problem_depts else 'all departments'}",
        numbers={"payroll_pct": payroll_pct, "problem_depts": problem_depts}
    )

def check_profitability(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 2: Negative EBITDA or net income."""
    ebitda = data.get("non_dep_exp_summary", {}).get("ebitda", 0)
    net_income = data.get("non_dep_exp_summary", {}).get("net_income", 0)
    total_income = data.get("revenue_summary", {}).get("total_income", 1)
    undist_exp = data.get("non_dep_exp_summary", {}).get("undist_other_exp", 0)
    
    if ebitda >= 0 and net_income >= 0:
        return None
    
    driver = "undistributed/other expenses" if undist_exp > total_income else "departmental performance"
    
    return Recommendation(
        area="profitability",
        severity=Severity.SEVERE,
        finding=f"EBITDA: ${ebitda:,.2f}, Net Income: ${net_income:,.2f}",
        recommendation=f"Primary driver: {driver}. Review non-departmental cost structure.",
        numbers={"ebitda": ebitda, "net_income": net_income, 
                "undist_exp": undist_exp, "total_income": total_income}
    )

def check_rate_vs_share(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 3: Occupancy < comp set AND ADR > comp set."""
    str_data = data.get("str", {})
    my_occ = str_data.get("occupancy", {}).get("my_property", 0)
    comp_occ = str_data.get("occupancy", {}).get("comp_set", 0)
    my_adr = str_data.get("adr", {}).get("my_property", 0)
    comp_adr = str_data.get("adr", {}).get("comp_set", 0)
    
    if my_occ >= comp_occ or my_adr <= comp_adr:
        return None
    
    occ_gap = comp_occ - my_occ
    
    # Import sizing function
    from .sizing import compute_rate_adjustment
    rate_reduction = compute_rate_adjustment(my_adr, occ_gap)
    
    return Recommendation(
        area="rate_vs_share",
        severity=Severity.MODERATE,
        finding=f"Occupancy {my_occ}% vs comp {comp_occ}%, ADR ${my_adr} vs comp ${comp_adr}",
        recommendation=f"Consider reducing ADR by ~${rate_reduction:.2f} or targeted promotion to close {occ_gap:.1f}pt occupancy gap",
        numbers={"my_occ": my_occ, "comp_occ": comp_occ, 
                "my_adr": my_adr, "comp_adr": comp_adr, "suggested_reduction": rate_reduction}
    )

def check_inventory(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 4: Out-of-order rooms > 3% of inventory."""
    total_rooms = data.get("occupancy", {}).get("total_rooms", 178)
    ooo_rooms = data.get("occupancy", {}).get("out_of_order", 0)
    ooo_pct = (ooo_rooms / total_rooms * 100) if total_rooms > 0 else 0
    
    if ooo_pct <= 3:
        return None
    
    return Recommendation(
        area="inventory",
        severity=Severity.MODERATE,
        finding=f"{ooo_rooms} out-of-order rooms ({ooo_pct:.1f}% of inventory)",
        recommendation="Escalate to housekeeping/maintenance to return rooms to sellable status",
        numbers={"ooo_rooms": ooo_rooms, "total_rooms": total_rooms, "ooo_pct": ooo_pct}
    )

def check_str_positioning(data: Dict[str, Any]) -> Optional[Recommendation]:
    """Rule 5: RevPAR rank better than occupancy rank = pricing wins."""
    str_data = data.get("str", {})
    occ_rank = str_data.get("occupancy", {}).get("rank", 99)
    revpar_rank = str_data.get("revpar", {}).get("rank", 99)
    
    if revpar_rank >= occ_rank:
        return None
    
    return Recommendation(
        area="str_positioning",
        severity=Severity.INFO,
        finding=f"RevPAR rank {revpar_rank} outperforms occupancy rank {occ_rank}",
        recommendation="No action needed - pricing strategy is effectively driving revenue despite volume position",
        numbers={"occ_rank": occ_rank, "revpar_rank": revpar_rank}
    )

def generate_recommendations(property_id: str, date_range: tuple, client) -> List[Recommendation]:
    """Run all rules and return recommendations."""
    # Fetch data
    daily_review = client.get_daily_review(property_id, date_range)
    labour = client.get_labour(property_id, date_range)
    
    # Combine data
    combined = {**daily_review, **labour}
    
    # Run all rules
    rules = [check_labour_cost, check_profitability, check_rate_vs_share, 
            check_inventory, check_str_positioning]
    
    recommendations = []
    for rule in rules:
        rec = rule(combined)
        if rec:
            recommendations.append(rec)
    
    return recommendations
