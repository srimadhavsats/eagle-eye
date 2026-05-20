import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Eye,
  TrendingUp,
  ShieldAlert,
  BarChart3,
  Loader2,
  Folder,
  Star,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronize state and pull quantitative metrics on active tab changes
  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`http://127.0.0.1:8000/api/${activeTab}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            "Network response failed. Target API endpoint unreachable.",
          );
        return res.json();
      })
      .then((payload) => {
        if (payload.status === "error") throw new Error(payload.message);
        setChartData(payload.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeTab]);

  // Format raw numeric inputs into standard USD localized string structures
  const formatCurrency = (val) => {
    if (!val) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Generate localized, contextual titles based on the active dataset matrix
  const getChartTitle = () => {
    if (activeTab === "support-band")
      return "Market Analysis: Structural Support Bands";
    if (activeTab === "log-regression")
      return "Macro Modeling: Lifetime Logarithmic Regression Channels";
    return "Risk Assessment: Normalized Quantitative Risk Distribution";
  };

  return (
    <div className="h-screen bg-[#070a13] text-slate-100 flex flex-col overflow-hidden">
      {/* Primary Application Controls Header */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0c101f] px-6 flex items-center justify-between shadow-md z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-emerald-400">
            <Eye size={20} strokeWidth={2.5} />
          </div>
          <h1 className="text-sm font-black tracking-widest text-white font-mono">
            EAGLE EYE
          </h1>
        </div>
        <div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 bg-slate-950 border border-slate-800 rounded-full text-emerald-400 font-bold tracking-wider">
            ● SYSTEM ACTIVE
          </span>
        </div>
      </header>

      {/* Main Split-Screen Layout Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar Panel */}
        <aside className="w-64 bg-[#0a0d1a] border-r border-slate-800/80 p-4 flex flex-col gap-6 overflow-y-auto flex-shrink-0 hidden md:flex">
          {/* Data Domain Selectors */}
          <div className="flex border-b border-slate-800 pb-2 gap-4 text-xs font-bold text-slate-400">
            <span className="text-emerald-400 border-b border-emerald-400 pb-2 cursor-pointer">
              Crypto
            </span>
            <span className="hover:text-slate-200 cursor-pointer">Macro</span>
            <span className="hover:text-slate-200 cursor-pointer">TradFi</span>
          </div>

          {/* Navigation Category: Core Moving Averages */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Star size={10} className="text-amber-400 fill-amber-400" />{" "}
              FAVORITED INDICES
            </p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab("support-band")}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "support-band"
                    ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                }`}
              >
                Market Support Bands
              </button>
            </div>
          </div>

          {/* Navigation Category: Predictive Analytics */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Folder size={10} /> QUANTITATIVE MODELS
            </p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab("log-regression")}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "log-regression"
                    ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                }`}
              >
                Logarithmic Regression
              </button>
              <button
                onClick={() => setActiveTab("risk-metric")}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "risk-metric"
                    ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
                }`}
              >
                Macro Risk Profile (0-1)
              </button>
            </div>
          </div>
        </aside>

        {/* Dynamic Workspace Container */}
        <main className="flex-1 bg-[#060912] p-6 flex flex-col gap-4 overflow-y-auto min-w-0">
          {/* Active Metric Description Block */}
          <div className="bg-[#0b0e1a] border border-slate-800/60 rounded-xl px-5 py-3 shadow-sm flex flex-col gap-1">
            <h2 className="text-base font-bold text-white tracking-wide">
              {getChartTitle()}
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Identifier:{" "}
              <span className="text-amber-400 font-bold">BTC-USD</span> •
              Timeframe: <span className="text-slate-300">Weekly Interval</span>
            </p>
          </div>

          {/* Primary Visualization Canvas Panel */}
          <div className="flex-1 bg-[#0b0e1a] border border-slate-800/90 rounded-2xl p-4 md:p-5 min-h-[450px] flex flex-col justify-between shadow-xl relative">
            {/* Asynchronous Network Activity Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-[#0b0e1a]/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-50">
                <Loader2 className="animate-spin text-emerald-400" size={32} />
                <p className="text-[10px] font-mono tracking-widest text-emerald-400/80">
                  RECALIBRATING MATHEMATICAL FRAMEWORKS...
                </p>
              </div>
            )}

            {/* Runtime Exception UI Fallback */}
            {error && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-red-900/40 bg-red-950/5 rounded-xl m-4">
                <ShieldAlert className="text-red-500 mb-2" size={36} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-200">
                  Data Synchronization Error
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
              </div>
            )}

            {/* Active Chart Engine Interface */}
            {!loading && !error && (
              <div className="w-full h-full min-h-0 min-w-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1e293b"
                      opacity={0.25}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#475569"
                      tickMargin={10}
                      fontSize={10}
                      minTickGap={60}
                    />

                    {/* Logarithmic scale engine overrides active dynamically based on data requirement */}
                    <YAxis
                      stroke="#475569"
                      fontSize={10}
                      scale={activeTab === "log-regression" ? "log" : "linear"}
                      domain={["auto", "auto"]}
                      tickFormatter={
                        activeTab === "risk-metric"
                          ? (v) => v.toFixed(2)
                          : formatCurrency
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#090d16",
                        borderColor: "#1e293b",
                        borderRadius: "12px",
                      }}
                      labelStyle={{
                        color: "#64748b",
                        fontWeight: "bold",
                        fontSize: "11px",
                        fontFamily: "monospace",
                      }}
                      itemStyle={{ fontSize: "12px", padding: "2px 0" }}
                      formatter={(value) => [
                        activeTab === "risk-metric"
                          ? value
                          : formatCurrency(value),
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="circle"
                      wrapperStyle={{ fontSize: "11px", paddingBottom: "10px" }}
                    />

                    {/* Technical Indicator Line Rendering Pipelines */}
                    {activeTab === "support-band" && (
                      <Line
                        type="monotone"
                        dataKey="price"
                        name="Spot Price"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    )}
                    {activeTab === "support-band" && (
                      <Line
                        type="monotone"
                        dataKey="sma20"
                        name="20-Week SMA"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="4 4"
                      />
                    )}
                    {activeTab === "support-band" && (
                      <Line
                        type="monotone"
                        dataKey="ema21"
                        name="21-Week EMA"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    )}

                    {activeTab === "log-regression" && (
                      <Line
                        type="monotone"
                        dataKey="price"
                        name="Spot Price"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    )}
                    {activeTab === "log-regression" && (
                      <Line
                        type="monotone"
                        dataKey="upper_band"
                        name="Channel Resistance Upper Boundary"
                        stroke="#ef4444"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    )}
                    {activeTab === "log-regression" && (
                      <Line
                        type="monotone"
                        dataKey="fair_value"
                        name="Regression Midpoint Value"
                        stroke="#475569"
                        strokeWidth={1.5}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    )}
                    {activeTab === "log-regression" && (
                      <Line
                        type="monotone"
                        dataKey="lower_band"
                        name="Channel Support Lower Boundary"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    )}

                    {activeTab === "risk-metric" && (
                      <Line
                        type="monotone"
                        dataKey="risk"
                        name="Normalized Risk Factor Coefficient"
                        stroke="#ec4899"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
