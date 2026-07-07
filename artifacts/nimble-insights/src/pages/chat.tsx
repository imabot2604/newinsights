import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";

const YEARS = [2023, 2024, 2025];
const MONTHS = [
  { label: "All Year", value: null },
  { label: "Jan", value: 1 }, { label: "Feb", value: 2 }, { label: "Mar", value: 3 },
  { label: "Apr", value: 4 }, { label: "May", value: 5 }, { label: "Jun", value: 6 },
  { label: "Jul", value: 7 }, { label: "Aug", value: 8 }, { label: "Sep", value: 9 },
  { label: "Oct", value: 10 }, { label: "Nov", value: 11 }, { label: "Dec", value: 12 },
];

export default function ChatPage() {
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,8%)] flex flex-col">
      {/* Header */}
      <header className="border-b border-[hsl(216,28%,14%)] px-6 py-3 flex items-center justify-between bg-[hsl(222,44%,9%)]">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-[hsl(215,20%,55%)] hover:text-white text-xs transition-colors" data-testid="link-back-dashboard">
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </button>
          </Link>
          <span className="text-[hsl(216,28%,28%)]">/</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">N</div>
            <span className="text-sm font-semibold text-white">Nimble AI Analyst</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[hsl(216,28%,14%)] rounded-lg p-0.5 border border-[hsl(216,28%,18%)]">
            {YEARS.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${year === y ? "bg-indigo-600 text-white" : "text-[hsl(215,20%,55%)] hover:text-white"}`}
                data-testid={`button-chat-year-${y}`}
              >
                {y}
              </button>
            ))}
          </div>
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value === "" ? null : parseInt(e.target.value))}
            className="bg-[hsl(216,28%,14%)] border border-[hsl(216,28%,18%)] text-xs text-[hsl(213,31%,86%)] rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500/50"
            data-testid="select-chat-month"
          >
            {MONTHS.map((m) => (
              <option key={m.label} value={m.value ?? ""}>{m.label}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Full chat */}
      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto h-full" style={{ height: "calc(100vh - 120px)" }}>
          <ChatPanel year={year} month={month} />
        </div>
      </div>
    </div>
  );
}
