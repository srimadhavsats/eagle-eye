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
import { Eye, TrendingUp, ShieldAlert, BarChart3, Loader2 } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Connect directly to local running FastAPI server channels
    fetch(`http://127.0.0.1:8000/api/${activeTab}`)
      .then((res) => {
        if (!res.ok)
          throw new Error(
            "Could not capture stream from Eagle Eye Radar Engine.",
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

  const formatCurrency = (val) => {
    if (!val) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col">
      {/* Structural Control Bar Header */}
      <header className="border-b border-slate-800 bg-[#0b0e1a] px-6 py-4 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl text-[#060913] shadow-lg shadow-emerald-500/20">
            <Eye size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white font-mono">
              EAGLE EYE
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Quantitative Crypto Macro Dashboard
            </p>
          </div>
        </div>
        <div className="hidden sm:block">
          <span className="text-xs font-mono px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-emerald-400 font-bold tracking-wider">
            ● RADAR ACTIVE
          </span>
        </div>
      </header>

      {/* Primary Dashboard Grid Context */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">
        {/* Metric Selection Tabs */}
        <div className="flex flex-wrap gap-2 bg-[#0b0e1a] p-1.5 rounded-xl border border-slate-800/80 self-start shadow-inner">
          <button
            onClick={() => setActiveTab("support-band")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "support-band"
                ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <TrendingUp size={14} />
            Support Band
          </button>
          <button
            onClick={() => setActiveTab("log-regression")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "log-regression"
                ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <BarChart3 size={14} />
            Log Regression
          </button>
          <button
            onClick={() => setActiveTab("risk-metric")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "risk-metric"
                ? "bg-emerald-500 text-slate-950 font-black shadow-md"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <ShieldAlert size={14} />
            Risk Metric
          </button>
        </div>

        {/* Core Rendering Terminal Box */}
        <div className="bg-[#0b0e1a] border border-slate-800/90 rounded-2xl p-4 md:p-6 min-h-[520px] flex flex-col justify-between shadow-2xl relative">
          {loading && (
            <div className="absolute inset-0 bg-[#0b0e1a]/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-50">
              <Loader2 className="animate-spin text-emerald-400" size={36} />
              <p className="text-xs font-mono tracking-widest text-emerald-400/80">
                COMPUTING QUANT DATA MODELS...
              </p>
            </div>
          )}

          {error && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-red-900/50 bg-red-950/5 rounded-xl m-4">
              <ShieldAlert className="text-red-500 mb-2" size={40} />
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-200">
                Local Data Link Broken
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="flex-1 w-full h-[460px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    tickMargin={10}
                    fontSize={11}
                    minTickGap={50}
                  />
                  <YAxis
                    stroke="#475569"
                    fontSize={11}
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
                    itemStyle={{ fontSize: "13px", paddingPadding: "2px 0" }}
                    formatter={(value) => [
                      activeTab === "risk-metric"
                        ? value
                        : formatCurrency(value),
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    height={40}
                    iconType="circle"
                    wrapperStyle={{ fontSize: "12px", paddingBottom: "10px" }}
                  />

                  {/* Bull Market Support Alignment Layer */}
                  {activeTab === "support-band" && [
                    <Line
                      key="price"
                      type="monotone"
                      dataKey="price"
                      name="BTC Price"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />,
                    <Line
                      key="sma20"
                      type="monotone"
                      dataKey="sma20"
                      name="20-Week SMA"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="4 4"
                    />,
                    <Line
                      key="ema21"
                      type="monotone"
                      dataKey="ema21"
                      name="21-Week EMA"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      dot={false}
                    />,
                  ]}

                  {/* Log Linear Regression Banding Enclosure */}
                  {activeTab === "log-regression" && [
                    <Line
                      key="price"
                      type="monotone"
                      dataKey="price"
                      name="BTC Price"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />,
                    <Line
                      key="upper"
                      type="monotone"
                      dataKey="upper_band"
                      name="Cycle Top Ceiling"
                      stroke="#ef4444"
                      strokeWidth={1.5}
                      dot={false}
                    />,
                    <Line
                      key="fair"
                      type="monotone"
                      dataKey="fair_value"
                      name="Fair Value Center"
                      stroke="#475569"
                      strokeWidth={1.5}
                      dot={false}
                      strokeDasharray="5 5"
                    />,
                    <Line
                      key="lower"
                      type="monotone"
                      dataKey="lower_band"
                      name="Accumulation Floor"
                      stroke="#10b981"
                      strokeWidth={1.5}
                      dot={false}
                    />,
                  ]}

                  {/* 0-1 Normalizing Scale Axis */}
                  {activeTab === "risk-metric" && [
                    <Line
                      key="risk"
                      type="monotone"
                      dataKey="risk"
                      name="Macro Risk Factor (0.0 - 1.0)"
                      stroke="#ec4899"
                      strokeWidth={2.5}
                      dot={false}
                    />,
                  ]}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
