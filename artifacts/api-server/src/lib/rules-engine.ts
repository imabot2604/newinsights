import type { AnnualPnL, MonthlyPnL } from "./excel-parser.js";
import type { ForecastTargets } from "./docx-parser.js";

export interface Recommendation {
  severity: "high" | "medium" | "low";
  category: string;
  finding: string;
  recommendation: string;
  variance: number | null;
}

const MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_INDEX: Record<string, number> = { Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

function pct(a: number, b: number): number {
  if (b === 0) return 0;
  return ((a - b) / b) * 100;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function runRulesEngine(
  data: AnnualPnL[],
  forecast: ForecastTargets,
  targetYear: number,
  targetMonth?: number
): Recommendation[] {
  const alerts: Recommendation[] = [];
  const yearData = data.find(d => d.year === targetYear);
  if (!yearData) return alerts;

  // If a specific month is selected and it's in the forecast period (Jul-Dec)
  if (targetMonth && targetMonth >= 7) {
    const forecastIdx = targetMonth - 7;
    const monthData = yearData.monthly.find(m => m.month === targetMonth);
    if (!monthData) return checkAnnualRules(yearData, alerts);

    checkProfitability(monthData, forecast, forecastIdx, alerts);
    checkGopPct(monthData, forecast, forecastIdx, alerts);
    checkOccupancy(monthData, forecast, forecastIdx, alerts);
    checkRevenueTrend(monthData, forecast, forecastIdx, alerts);
    checkADR(monthData, alerts);
  } else {
    // Annual rules — check across all months with forecast overlap
    for (let i = 0; i < forecast.months.length; i++) {
      const monthNum = MONTH_INDEX[forecast.months[i]];
      const monthData = yearData.monthly.find(m => m.month === monthNum);
      if (!monthData) continue;
      checkProfitability(monthData, forecast, i, alerts);
      checkGopPct(monthData, forecast, i, alerts);
      checkOccupancy(monthData, forecast, i, alerts);
      checkRevenueTrend(monthData, forecast, i, alerts);
    }
    checkAnnualRules(yearData, alerts);
  }

  // Deduplicate and sort by severity
  const seen = new Set<string>();
  const unique = alerts.filter(a => {
    const key = `${a.category}:${a.finding.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const order = { high: 0, medium: 1, low: 2 };
  return unique.sort((a, b) => order[a.severity] - order[b.severity]);
}

function checkProfitability(
  month: MonthlyPnL,
  forecast: ForecastTargets,
  idx: number,
  alerts: Recommendation[]
): void {
  const targetNOI = forecast.noiForecast[idx] ?? 0;
  if (targetNOI === 0) return;
  const variance = pct(month.ebitda, targetNOI);

  if (month.ebitda < targetNOI * 0.9) {
    alerts.push({
      severity: "high",
      category: "Profitability",
      finding: `EBITDA of ${fmt(month.ebitda)} is ${fmtPct(Math.abs(variance))} below the NOI forecast of ${fmt(targetNOI)} for ${MONTHS[idx]}`,
      recommendation: "Review fixed-cost commitments and identify discretionary spending that can be reduced. Explore upselling opportunities to improve revenue per occupied room. Consider renegotiating supplier contracts to reduce variable costs.",
      variance,
    });
  } else if (month.ebitda < targetNOI) {
    alerts.push({
      severity: "medium",
      category: "Profitability",
      finding: `EBITDA of ${fmt(month.ebitda)} is slightly below the NOI forecast of ${fmt(targetNOI)} for ${MONTHS[idx]} (${fmtPct(Math.abs(variance))} gap)`,
      recommendation: "Monitor closely. Identify any one-off cost overruns contributing to the shortfall. Review energy consumption and labor scheduling for quick-win savings.",
      variance,
    });
  }
}

function checkGopPct(
  month: MonthlyPnL,
  forecast: ForecastTargets,
  idx: number,
  alerts: Recommendation[]
): void {
  const revForecast = forecast.revenueForecast[idx] ?? 0;
  const gopForecast = forecast.gopForecast[idx] ?? 0;
  if (revForecast === 0 || gopForecast === 0) return;

  const targetGopPct = gopForecast / revForecast;
  const actualGopPct = month.totalRevenue > 0 ? month.gop / month.totalRevenue : 0;
  const variance = (actualGopPct - targetGopPct) * 100;

  if (actualGopPct < targetGopPct - 0.05) {
    alerts.push({
      severity: "high",
      category: "GOP Margin",
      finding: `GOP margin of ${fmtPct(actualGopPct * 100)} is ${fmtPct(Math.abs(variance))}pts below target of ${fmtPct(targetGopPct * 100)} for ${MONTHS[idx]}`,
      recommendation: "Conduct a line-by-line departmental expense review. Food & Beverage and Rooms departments typically offer the quickest cost improvement opportunities. Revisit labor hours against occupancy levels — over-staffing at low occupancy is a common driver of GOP erosion.",
      variance,
    });
  } else if (actualGopPct < targetGopPct - 0.02) {
    alerts.push({
      severity: "medium",
      category: "GOP Margin",
      finding: `GOP margin of ${fmtPct(actualGopPct * 100)} is ${fmtPct(Math.abs(variance))}pts below target for ${MONTHS[idx]}`,
      recommendation: "Review undistributed expenses and administrative overhead for cost reduction opportunities. Ensure revenue-generating departments are meeting their individual margin targets.",
      variance,
    });
  }
}

function checkOccupancy(
  month: MonthlyPnL,
  forecast: ForecastTargets,
  idx: number,
  alerts: Recommendation[]
): void {
  const roomsSoldForecast = forecast.roomsSoldForecast[idx] ?? 0;
  if (roomsSoldForecast === 0 || month.roomsAvailable === 0) return;

  const targetOccupancy = roomsSoldForecast / month.roomsAvailable;
  const actualOccupancy = month.occupancyPct;
  const variance = (actualOccupancy - targetOccupancy) * 100;

  if (actualOccupancy < targetOccupancy - 0.05) {
    alerts.push({
      severity: "high",
      category: "Occupancy",
      finding: `Occupancy of ${fmtPct(actualOccupancy * 100)} is ${fmtPct(Math.abs(variance))}pts below forecast target of ${fmtPct(targetOccupancy * 100)} for ${MONTHS[idx]}`,
      recommendation: "Implement targeted promotions for the underperforming period — consider OTA flash deals, corporate package extensions, and loyalty member offers. Review distribution channel mix and rate competitiveness against comp set. Consider revenue management interventions on minimum-stay restrictions.",
      variance,
    });
  } else if (actualOccupancy < targetOccupancy - 0.02) {
    alerts.push({
      severity: "medium",
      category: "Occupancy",
      finding: `Occupancy of ${fmtPct(actualOccupancy * 100)} is slightly below forecast for ${MONTHS[idx]} (${fmtPct(Math.abs(variance))}pts gap)`,
      recommendation: "Review booking pace and pickup relative to same time last year. Activate last-minute booking channels if lead time is shrinking. Ensure group and corporate segments are tracking to budget.",
      variance,
    });
  }
}

function checkRevenueTrend(
  month: MonthlyPnL,
  forecast: ForecastTargets,
  idx: number,
  alerts: Recommendation[]
): void {
  const revForecast = forecast.revenueForecast[idx] ?? 0;
  if (revForecast === 0) return;

  const variance = pct(month.totalRevenue, revForecast);

  if (variance < -10) {
    alerts.push({
      severity: "high",
      category: "Revenue",
      finding: `Revenue of ${fmt(month.totalRevenue)} misses forecast of ${fmt(revForecast)} by ${fmtPct(Math.abs(variance))} in ${MONTHS[idx]}`,
      recommendation: "Urgent revenue recovery needed. Activate dynamic pricing across all segments. Review F&B capture rates and ancillary revenue opportunities. Assess whether market conditions warrant a formal forecast revision with revised action plans.",
      variance,
    });
  } else if (variance < -3) {
    alerts.push({
      severity: "medium",
      category: "Revenue",
      finding: `Revenue of ${fmt(month.totalRevenue)} misses the forecast target by ${fmtPct(Math.abs(variance))} for ${MONTHS[idx]}`,
      recommendation: "Investigate which revenue streams are underperforming — rooms, F&B, or ancillary. Tighten rate discipline and consider targeted promotions for specific market segments with availability.",
      variance,
    });
  }
}

function checkADR(month: MonthlyPnL, alerts: Recommendation[]): void {
  // Flag if ADR looks extremely low relative to RevPAR
  if (month.adr > 0 && month.occupancyPct > 0 && month.occupancyPct < 0.5) {
    alerts.push({
      severity: "low",
      category: "Rate Strategy",
      finding: `Occupancy of ${fmtPct(month.occupancyPct * 100)} is below 50% — ADR strategy may need review`,
      recommendation: "Low occupancy combined with any ADR pressure can compound revenue shortfalls. Consider a rate-vs-occupancy trade-off analysis. In low-demand periods, rate integrity is critical to protect future perceived value.",
      variance: null,
    });
  }
}

function checkAnnualRules(data: AnnualPnL, alerts: Recommendation[]): Recommendation[] {
  const gopPct = data.totalRevenue > 0 ? data.gop / data.totalRevenue : 0;
  const ebitdaPct = data.totalRevenue > 0 ? data.ebitda / data.totalRevenue : 0;

  if (gopPct < 0.25 && data.gop > 0) {
    alerts.push({
      severity: "medium",
      category: "GOP Margin",
      finding: `Annual GOP margin of ${(gopPct * 100).toFixed(1)}% is below the 25% industry benchmark`,
      recommendation: "A GOP margin below 25% signals structural cost issues. Commission a full operational review targeting labor productivity, energy management, and procurement savings. Consider a revenue management audit to identify rate optimization opportunities.",
      variance: null,
    });
  }

  if (data.occupancyPct < 0.6 && data.roomsAvailable > 0) {
    alerts.push({
      severity: "medium",
      category: "Occupancy",
      finding: `Annual occupancy of ${(data.occupancyPct * 100).toFixed(1)}% is below the 60% target`,
      recommendation: "Below 60% annual occupancy indicates a structural demand or distribution challenge. Review segmentation strategy, channel mix, and corporate/group account portfolio. Consider investing in a revenue management system upgrade if not already in place.",
      variance: null,
    });
  }

  return alerts;
}

export function buildFinancialContext(
  data: AnnualPnL[],
  forecast: ForecastTargets,
  alerts: Recommendation[],
  targetYear: number,
  targetMonth?: number
): string {
  const yearData = data.find(d => d.year === targetYear);
  
  const contextLines = [
    `=== NIMBLE INSIGHTS FINANCIAL CONTEXT ===`,
    `Hotel: Test Hospitality`,
    `Period: ${targetMonth ? `Month ${targetMonth}` : "Full Year"} ${targetYear}`,
    `Report Date: ${new Date().toLocaleDateString()}`,
    ``,
  ];

  if (yearData) {
    if (targetMonth) {
      const m = yearData.monthly.find(mo => mo.month === targetMonth);
      if (m) {
        contextLines.push(`=== MONTHLY KPIs (Month ${targetMonth}) ===`);
        contextLines.push(`Total Revenue: $${m.totalRevenue.toLocaleString()}`);
        contextLines.push(`EBITDA: $${m.ebitda.toLocaleString()}`);
        contextLines.push(`Gross Operating Profit: $${m.gop.toLocaleString()}`);
        contextLines.push(`GOP Margin: ${(m.totalRevenue > 0 ? (m.gop / m.totalRevenue * 100) : 0).toFixed(1)}%`);
        contextLines.push(`Occupancy: ${(m.occupancyPct * 100).toFixed(1)}%`);
        contextLines.push(`ADR: $${m.adr.toFixed(2)}`);
        contextLines.push(`RevPAR: $${m.revpar.toFixed(2)}`);
        contextLines.push(`Rooms Available: ${m.roomsAvailable}`);
        contextLines.push(`Rooms Sold: ${m.roomsSold}`);
      }
    } else {
      contextLines.push(`=== ANNUAL KPIs (${targetYear}) ===`);
      contextLines.push(`Total Revenue: $${yearData.totalRevenue.toLocaleString()}`);
      contextLines.push(`EBITDA: $${yearData.ebitda.toLocaleString()}`);
      contextLines.push(`GOP: $${yearData.gop.toLocaleString()}`);
      contextLines.push(`GOP Margin: ${(yearData.totalRevenue > 0 ? (yearData.gop / yearData.totalRevenue * 100) : 0).toFixed(1)}%`);
      contextLines.push(`Occupancy: ${(yearData.occupancyPct * 100).toFixed(1)}%`);
      contextLines.push(`ADR: $${yearData.adr.toFixed(2)}`);
      contextLines.push(`RevPAR: $${yearData.revpar.toFixed(2)}`);
      contextLines.push(`Rooms Available: ${yearData.roomsAvailable.toLocaleString()}`);
      contextLines.push(`Rooms Sold: ${yearData.roomsSold.toLocaleString()}`);

      contextLines.push(``, `=== MONTHLY BREAKDOWN ===`);
      for (const m of yearData.monthly) {
        contextLines.push(`Month ${m.month}: Rev=$${m.totalRevenue.toLocaleString()}, GOP=$${m.gop.toLocaleString()}, Occ=${(m.occupancyPct * 100).toFixed(1)}%, ADR=$${m.adr.toFixed(0)}`);
      }
    }
  }

  contextLines.push(``, `=== FORECAST TARGETS (H2 2025 from RMS Report) ===`);
  for (let i = 0; i < forecast.months.length; i++) {
    contextLines.push(`${forecast.months[i]}: Rev Forecast=$${(forecast.revenueForecast[i] ?? 0).toLocaleString()}, GOP Forecast=$${(forecast.gopForecast[i] ?? 0).toLocaleString()}, NOI Forecast=$${(forecast.noiForecast[i] ?? 0).toLocaleString()}, Rooms Sold Forecast=${forecast.roomsSoldForecast[i] ?? 0}`);
  }

  if (alerts.length > 0) {
    contextLines.push(``, `=== RULES ENGINE ALERTS (${alerts.length} total) ===`);
    for (const a of alerts) {
      contextLines.push(`[${a.severity.toUpperCase()}] ${a.category}: ${a.finding}`);
      contextLines.push(`  -> Recommendation: ${a.recommendation}`);
    }
  }

  contextLines.push(``, `=== FORECASTING MODEL PERFORMANCE (from RMS Report) ===`);
  contextLines.push(`Scenario A (3yr, Jul-Dec 2025): Prophet Revenue MAPE=16.8%, Ensemble GOP MAPE=107.6%`);
  contextLines.push(`Scenario B (2yr, Jul-Dec 2024): Ensemble Revenue MAPE=15.1%, Ensemble GOP MAPE=30.6%`);
  contextLines.push(`Key finding: 2-year training window outperforms 3-year for revenue and profit forecasting`);
  contextLines.push(`Key finding: GOP/NOI 2x more volatile than Revenue (COV 38% vs 18%)`);
  contextLines.push(`Key finding: December causes 36-55% drops in forecast accuracy`);
  contextLines.push(`Reconciliation accuracy: 0.00% error (production-ready)`);

  return contextLines.join("\n");
}
