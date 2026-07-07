import { useState } from "react";
import {
  useGetDashboard,
  useGetAlerts,
  getGetDashboardQueryKey,
  getGetAlertsQueryKey,
} from "@workspace/api-client-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight, AlertTriangle, Info, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ChatPanel from "@/components/ChatPanel";

const YEARS = [2023, 2024, 2025];
const MONTHS = [
  { label: "All", value: null },
  { label: "Jan", value: 1 }, { label: "Feb", value: 2 }, { label: "Mar", value: 3 },
  { label: "Apr", value: 4 }, { label: "May", value: 5 }, { label: "Jun", value: 6 },
  { label: "Jul", value: 7 }, { label: "Aug", value: 8 }, { label: "Sep", value: 9 },
  { label: "Oct", value: 10 }, { label: "Nov", value: 11 }, { label: "Dec", value: 12 },
];

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

function VarianceBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.5) return <span className="text-[hsl(215,20%,55%)] text-[10px]">On target</span>;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
      {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {positive ? "+" : ""}{fmtPct(value)} vs forecast
    </span>
  );
}

function KpiCard({
  label, value, sub, variance, color = "amber",
}: {
  label: string;
  value: string;
  sub?: string;
  variance?: number;
  color?: "amber" | "indigo" | "emerald" | "rose";
}) {
  const colorMap = {
    amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20",
    indigo: "from-indigo-500/10 to-indigo-600/5 border-indigo-500/20",
    emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-500/20",
    rose: "from-rose-500/10 to-rose-600/5 border-rose-500/20",
  };
  const dotMap = {
    amber: "bg-amber-400",
    indigo: "bg-indigo-400",
    emerald: "bg-emerald-400",
    rose: "bg-rose-400",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colorMap[color]}`} data-testid={`kpi-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-1.5 h-1.5 rounded-full ${dotMap[color]}`} />
        <span className="text-[10px] font-medium text-[hsl(215,20%,55%)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white leading-none mb-1">{value}</div>
      {sub && <div className="text-[11px] text-[hsl(215,20%,55%)] mb-1.5">{sub}</div>}
      {variance !== undefined && <VarianceBadge value={variance} />}
    </div>
  );
}

function AlertCard({ alert, index }: { alert: { severity: string; category: string; finding: string; recommendation: string; variance: number | null }; index: number }) {
  const [open, setOpen] = useState(false);
  const colors = {
    high: { bg: "bg-red-500/10 border-red-500/25", dot: "bg-red-400", badge: "text-red-400 bg-red-400/10", icon: AlertTriangle },
    medium: { bg: "bg-amber-500/10 border-amber-500/25", dot: "bg-amber-400", badge: "text-amber-400 bg-amber-400/10", icon: Zap },
    low: { bg: "bg-blue-500/10 border-blue-500/25", dot: "bg-blue-400", badge: "text-blue-400 bg-blue-400/10", icon: Info },
  };
  const c = colors[alert.severity as keyof typeof colors] ?? colors.low;
  const Icon = c.icon;

  return (
    <div className={`rounded-lg border p-3 ${c.bg}`} data-testid={`alert-${index}`}>
      <button
        className="w-full text-left"
        onClick={() => setOpen(!open)}
        data-testid={`button-alert-toggle-${index}`}
      >
        <div className="flex items-start gap-2.5">
          <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${c.badge.split(" ")[0]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${c.badge}`}>
                {alert.severity}
              </span>
              <span className="text-[10px] text-[hsl(215,20%,55%)]">{alert.category}</span>
              {alert.variance != null && (
                <span className="text-[10px] text-[hsl(215,20%,45%)] ml-auto">
                  {alert.variance > 0 ? "+" : ""}{alert.variance.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-[hsl(213,31%,86%)] leading-snug">{alert.finding}</p>
          </div>
          <div className="shrink-0 text-[hsl(215,20%,45%)] mt-0.5">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="mt-2.5 pl-6 pt-2.5 border-t border-white/5">
          <p className="text-[11px] text-[hsl(215,20%,60%)] leading-relaxed">{alert.recommendation}</p>
        </div>
      )}
    </div>
  );
}

const chartTooltipStyle = {
  backgroundColor: "hsl(222,44%,11%)",
  border: "1px solid hsl(216,28%,20%)",
  borderRadius: "8px",
  fontSize: "11px",
  color: "hsl(213,31%,86%)",
};

function RevenueChart({ data }: { data: Array<{ month: string; actual: number; forecast: number | null }> }) {
  const formatted = data.map((d) => ({
    ...d,
    actualM: +(d.actual / 1_000_000).toFixed(3),
    forecastM: d.forecast != null ? +(d.forecast / 1_000_000).toFixed(3) : null,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formatted} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,28%,16%)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "hsl(215,20%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(215,20%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}M`} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}M`]} />
        <Legend iconType="line" iconSize={10} wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
        <Area type="monotone" dataKey="actualM" name="Actual" stroke="#f59e0b" strokeWidth={2} fill="url(#actualGrad)" dot={false} />
        <Area type="monotone" dataKey="forecastM" name="Forecast" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#forecastGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function GopChart({ data }: { data: Array<{ month: string; actual: number; forecast: number | null }> }) {
  const formatted = data.map((d) => ({
    ...d,
    actualK: +(d.actual / 1_000).toFixed(1),
    forecastK: d.forecast != null ? +(d.forecast / 1_000).toFixed(1) : null,
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={formatted} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="gopGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,28%,16%)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "hsl(215,20%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(215,20%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`$${v.toFixed(0)}K`]} />
        <Legend iconType="line" iconSize={10} wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
        <Area type="monotone" dataKey="actualK" name="GOP Actual" stroke="#10b981" strokeWidth={2} fill="url(#gopGrad)" dot={false} />
        <Area type="monotone" dataKey="forecastK" name="GOP Forecast" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" fill="none" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function OccupancyChart({ data }: { data: Array<{ month: string; actual: number; forecast: number | null }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,28%,16%)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "hsl(215,20%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(215,20%,45%)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
        <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
        <Area type="monotone" dataKey="actual" name="Occupancy" stroke="#8b5cf6" strokeWidth={2} fill="url(#occGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState<number | null>(null);

  const dashParams = { year, ...(month != null ? { month } : {}) };

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard(
    dashParams,
    { query: { queryKey: getGetDashboardQueryKey(dashParams) } }
  );
  const { data: alerts, isLoading: alertsLoading } = useGetAlerts(
    dashParams,
    { query: { queryKey: getGetAlertsQueryKey(dashParams) } }
  );

  const highAlerts = alerts?.filter((a) => a.severity === "high") ?? [];
  const otherAlerts = alerts?.filter((a) => a.severity !== "high") ?? [];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,8%)] text-white">
      {/* Top bar */}
      <header className="border-b border-[hsl(216,28%,14%)] px-6 py-3 flex items-center justify-between bg-[hsl(222,44%,9%)] sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-sm font-bold text-white shadow-lg">N</div>
          <div>
            <span className="text-sm font-semibold text-white">Nimble Insights</span>
            <span className="text-[hsl(215,20%,45%)] text-xs ml-2">Test Hospitality</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex bg-[hsl(216,28%,14%)] rounded-lg p-0.5 border border-[hsl(216,28%,18%)]">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${year === y ? "bg-indigo-600 text-white shadow-sm" : "text-[hsl(215,20%,55%)] hover:text-white"}`}
                data-testid={`button-year-${y}`}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Month selector */}
          <div className="flex bg-[hsl(216,28%,14%)] rounded-lg p-0.5 border border-[hsl(216,28%,18%)] overflow-x-auto max-w-xs scrollbar-thin">
            {MONTHS.map((m) => (
              <button
                key={m.label}
                onClick={() => setMonth(m.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${month === m.value ? "bg-indigo-600 text-white shadow-sm" : "text-[hsl(215,20%,55%)] hover:text-white"}`}
                data-testid={`button-month-${m.label}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {dashLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl bg-white/5" />
            ))
          ) : dashboard ? (
            <>
              <KpiCard
                label="Total Revenue"
                value={fmt(dashboard.totalRevenue)}
                sub={`ADR: $${dashboard.adr.toFixed(0)} · RevPAR: $${dashboard.revpar.toFixed(0)}`}
                variance={dashboard.revenueVsForecast}
                color="amber"
              />
              <KpiCard
                label="EBITDA"
                value={fmt(dashboard.ebitda)}
                sub={`${fmtPct(dashboard.totalRevenue > 0 ? (dashboard.ebitda / dashboard.totalRevenue) * 100 : 0)} margin`}
                variance={dashboard.noiVsForecast}
                color="indigo"
              />
              <KpiCard
                label="Occupancy"
                value={fmtPct(dashboard.occupancyPct)}
                sub={`${dashboard.roomsSold.toLocaleString()} / ${dashboard.roomsAvailable.toLocaleString()} rooms`}
                color="emerald"
              />
              <KpiCard
                label="GOP Margin"
                value={fmtPct(dashboard.gopMargin)}
                sub={fmt(dashboard.gop) + " gross profit"}
                variance={dashboard.gopVsForecast}
                color="rose"
              />
            </>
          ) : null}
        </div>

        {/* Main content: charts + right panels */}
        <div className="grid grid-cols-[1fr_360px] gap-6">
          {/* Left: Charts */}
          <div className="space-y-5">
            {/* Revenue chart */}
            <div className="bg-[hsl(222,44%,11%)] rounded-xl border border-[hsl(216,28%,16%)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Monthly Revenue</h3>
                  <p className="text-[10px] text-[hsl(215,20%,45%)] mt-0.5">Actual vs RMS Forecast (Jul-Dec)</p>
                </div>
              </div>
              {dashLoading ? (
                <Skeleton className="h-44 bg-white/5 rounded-lg" />
              ) : (
                <div className="h-44">
                  <RevenueChart data={dashboard?.monthlyRevenue ?? []} />
                </div>
              )}
            </div>

            {/* GOP chart */}
            <div className="bg-[hsl(222,44%,11%)] rounded-xl border border-[hsl(216,28%,16%)] p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Gross Operating Profit</h3>
                <p className="text-[10px] text-[hsl(215,20%,45%)] mt-0.5">Monthly GOP vs Forecast</p>
              </div>
              {dashLoading ? (
                <Skeleton className="h-40 bg-white/5 rounded-lg" />
              ) : (
                <div className="h-40">
                  <GopChart data={dashboard?.monthlyGop ?? []} />
                </div>
              )}
            </div>

            {/* Occupancy chart */}
            <div className="bg-[hsl(222,44%,11%)] rounded-xl border border-[hsl(216,28%,16%)] p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-white">Occupancy %</h3>
                <p className="text-[10px] text-[hsl(215,20%,45%)] mt-0.5">Monthly occupancy rate</p>
              </div>
              {dashLoading ? (
                <Skeleton className="h-40 bg-white/5 rounded-lg" />
              ) : (
                <div className="h-40">
                  <OccupancyChart data={dashboard?.monthlyOccupancy ?? []} />
                </div>
              )}
            </div>
          </div>

          {/* Right: Alerts + Chat */}
          <div className="flex flex-col gap-5 min-h-0">
            {/* Alerts */}
            <div className="bg-[hsl(222,44%,11%)] rounded-xl border border-[hsl(216,28%,16%)] flex flex-col max-h-[420px]">
              <div className="px-4 py-3 border-b border-[hsl(216,28%,16%)] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">AI Alerts</h3>
                  {!alertsLoading && alerts && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">
                      {highAlerts.length} high
                    </span>
                  )}
                </div>
                {!alertsLoading && alerts && (
                  <span className="text-[10px] text-[hsl(215,20%,45%)]">{alerts.length} total</span>
                )}
              </div>
              <div className="overflow-y-auto scrollbar-thin p-3 space-y-2 flex-1">
                {alertsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 bg-white/5 rounded-lg" />
                  ))
                ) : alerts?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-xs text-[hsl(215,20%,55%)]">No alerts — all targets met</p>
                  </div>
                ) : (
                  <>
                    {[...highAlerts, ...otherAlerts].map((alert, i) => (
                      <AlertCard key={i} alert={alert} index={i} />
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Chat panel */}
            <div className="flex-1 min-h-0" style={{ height: "460px" }}>
              <ChatPanel year={year} month={month} compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
