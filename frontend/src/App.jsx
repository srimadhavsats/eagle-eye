import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  Calendar,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [chartData, setChartData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [timeframe, setTimeframe] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Sidebar toggle state

  // High-fidelity state management matrix for line visibility tracking
  const [visibility, setVisibility] = useState({
    price: true,
    bubbleUpper: true,
    bubbleLower: true,
    nonBubbleUpper: true,
    nonBubbleFit: true,
    nonBubbleLower: true,
  });

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
        setFilteredData(payload.data);
        setTimeframe("ALL");
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [activeTab]);

  // Handle analytical data partitioning based on selected timeframe boundaries
  useEffect(() => {
    if (!chartData || chartData.length === 0) return;

    if (timeframe === "ALL") {
      setFilteredData(chartData);
      return;
    }

    const targetedData = [...chartData];
    const historicalPoints = targetedData.filter((item) => item.price !== null);
    if (historicalPoints.length === 0) return;

    const latestHistoricalDate = new Date(
      historicalPoints[historicalPoints.length - 1].date,
    );

    const startDate = new Date(latestHistoricalDate);
    if (timeframe === "1Y") {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else if (timeframe === "3Y") {
      startDate.setFullYear(startDate.getFullYear() - 3);
    }

    const filtered = targetedData.filter((item) => {
      const itemDate = new Date(item.date);
      return itemDate >= startDate;
    });

    setFilteredData(filtered);
  }, [timeframe, chartData]);

  // Format raw numeric inputs into standard USD localized string structures
  const formatCurrency = (val) => {
    if (!val) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Master visibility switcher loop
  const handleToggleAll = () => {
    const anyVisible = Object.values(visibility).some((val) => val === true);
    setVisibility({
      price: !anyVisible,
      bubbleUpper: !anyVisible,
      bubbleLower: !anyVisible,
      nonBubbleUpper: !anyVisible,
      nonBubbleFit: !anyVisible,
      nonBubbleLower: !anyVisible,
    });
  };

  const toggleLine = (key) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
        <div className="flex items-center gap-4">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors border border-transparent hover:border-slate-700"
          >
            <Folder size={16} />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-emerald-400">
              <Eye size={20} strokeWidth={2.5} />
            </div>
            <h1 className="text-sm font-black tracking-widest text-white font-mono">
              EAGLE EYE
            </h1>
          </div>
        </div>

        {/* Branch Indicator */}
        <span className="text-[10px] font-mono px-2.5 py-0.5 bg-slate-950 border border-slate-800 rounded-full text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          MAIN
        </span>
      </header>

      {/* Main Split-Screen Layout Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar Panel */}
        {isSidebarOpen && (
          <aside className="w-64 bg-[#0a0d1a] border-r border-slate-800/80 p-4 flex flex-col gap-6 overflow-y-auto flex-shrink-0">
            <div className="flex border-b border-slate-800 pb-2 gap-4 text-xs font-bold text-slate-400">
              <span className="text-emerald-400 border-b border-emerald-400 pb-2 cursor-pointer">
                Crypto
              </span>
              <span className="hover:text-slate-200 cursor-pointer">Macro</span>
              <span className="hover:text-slate-200 cursor-pointer">
                TradFi
              </span>
            </div>

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
        )}

        {/* Dynamic Workspace Container */}
        <main className="flex-1 bg-[#060912] p-6 flex flex-col gap-4 overflow-y-auto min-w-0">
          <div className="bg-[#0b0e1a] border border-slate-800/60 rounded-xl px-5 py-3 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {getChartTitle()}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Identifier:{" "}
                <span className="text-amber-400 font-bold">BTC-USD</span> •
                Timeframe:{" "}
                <span className="text-slate-300">Weekly Interval</span>
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
              <div className="text-slate-500 px-2">
                <Calendar size={12} />
              </div>
              {["1Y", "3Y", "ALL"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-all ${
                    timeframe === t
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-[#0b0e1a] border border-slate-800/90 rounded-2xl p-4 md:p-5 min-h-[450px] flex flex-col justify-between shadow-xl relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 bg-[#0b0e1a]/95 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-50">
                <Loader2 className="animate-spin text-emerald-400" size={32} />
                <p className="text-[10px] font-mono tracking-widest text-emerald-400/80">
                  RECALIBRATING MATHEMATICAL FRAMEWORKS...
                </p>
              </div>
            )}

            {error && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-red-900/40 bg-red-950/5 rounded-xl m-4">
                <ShieldAlert className="text-red-500 mb-2" size={36} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-200">
                  Data Synchronization Error
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="w-full h-full min-h-0 min-w-0 flex-1 flex flex-col justify-between">
                <div className="flex-1 min-h-0 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={filteredData}
                      margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                        opacity={0.25}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#475569"
                        tickMargin={10}
                        fontSize={10}
                        minTickGap={60}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#475569"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                        scale={
                          activeTab === "log-regression" ? "log" : "linear"
                        }
                        domain={
                          activeTab === "log-regression"
                            ? [0.01, 1500000]
                            : ["auto", "auto"]
                        }
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
                        formatter={(value, name) => [
                          activeTab === "risk-metric"
                            ? value
                            : formatCurrency(value),
                          name,
                        ]}
                      />
                      {activeTab === "support-band" && (
                        <Line
                          type="monotone"
                          dataKey="price"
                          name="Spot Price"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                        />
                      )}
                      {activeTab === "log-regression" &&
                        visibility.bubbleUpper && (
                          <Line
                            type="monotone"
                            dataKey="bubbleUpper"
                            name="Bubble UpperBand"
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        )}
                      {activeTab === "log-regression" &&
                        visibility.bubbleLower && (
                          <Line
                            type="monotone"
                            dataKey="bubbleLower"
                            name="Bubble LowerBand"
                            stroke="#f97316"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        )}
                      {activeTab === "log-regression" &&
                        visibility.nonBubbleUpper && (
                          <Line
                            type="monotone"
                            dataKey="nonBubbleUpper"
                            name="Non-Bubble Upper"
                            stroke="#eab308"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        )}
                      {activeTab === "log-regression" &&
                        visibility.nonBubbleFit && (
                          <Line
                            type="monotone"
                            dataKey="nonBubbleFit"
                            name="Non-Bubble Fit"
                            stroke="#10b981"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                          />
                        )}
                      {activeTab === "log-regression" &&
                        visibility.nonBubbleLower && (
                          <Line
                            type="monotone"
                            dataKey="nonBubbleLower"
                            name="Non-Bubble Lower"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            dot={false}
                          />
                        )}
                      {activeTab === "log-regression" && visibility.price && (
                        <Line
                          type="monotone"
                          dataKey="price"
                          name="Price"
                          stroke="#f59e0b"
                          strokeWidth={2.5}
                          dot={false}
                          connectNulls
                        />
                      )}
                      {activeTab === "risk-metric" && (
                        <Line
                          type="monotone"
                          dataKey="risk"
                          name="Risk Metric"
                          stroke="#ec4899"
                          strokeWidth={2.5}
                          dot={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {activeTab === "log-regression" && (
                  <div className="flex flex-wrap justify-center items-center gap-2 mt-4 border-t border-slate-800/60 pt-3 flex-shrink-0 z-20">
                    <button
                      onClick={handleToggleAll}
                      className="text-[10px] font-mono font-bold px-2.5 py-1 rounded border bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300 transition-all"
                    >
                      Show/Hide all
                    </button>
                    <button
                      onClick={() => toggleLine("price")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.price
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Price
                    </button>
                    <button
                      onClick={() => toggleLine("bubbleUpper")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.bubbleUpper
                          ? "bg-red-500/10 text-red-400 border-red-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Bubble UpperBand
                    </button>
                    <button
                      onClick={() => toggleLine("bubbleLower")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.bubbleLower
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Bubble LowerBand
                    </button>
                    <button
                      onClick={() => toggleLine("nonBubbleUpper")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.nonBubbleUpper
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Non-Bubble Upper
                    </button>
                    <button
                      onClick={() => toggleLine("nonBubbleFit")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.nonBubbleFit
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Non-Bubble Fit
                    </button>
                    <button
                      onClick={() => toggleLine("nonBubbleLower")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.nonBubbleLower
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Non-Bubble Lower
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
