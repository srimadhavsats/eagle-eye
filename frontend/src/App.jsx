import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import { Eye, Loader2, Folder, Star, Calendar, RefreshCw } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [chartData, setChartData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Zoom Handling Bounds States
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [fullDatasetCache, setFullDatasetCache] = useState([]);

  // High-Fidelity Visibility State Matrix Matrix
  const [visibility, setVisibility] = useState({
    price: true,
    bubbleUpper: true,
    bubbleLower: true,
    nonBubbleUpper: true,
    nonBubbleFit: true,
    nonBubbleLower: true,
  });

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`http://127.0.0.1:8000/api/${activeTab}`)
      .then((res) => {
        if (!res.ok)
          throw new Error("Target quantitative endpoint unreachable.");
        return res.json();
      })
      .then((payload) => {
        if (payload.status === "error") throw new Error(payload.message);
        setChartData(payload.data);
        setFullDatasetCache(payload.data);
        setFilteredData(payload.data);
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

  // --- RE-ENGINEERED DYNAMIC X-AXIS GRANULARITY CONTROLLER ---
  const formatXAxis = (tickItem) => {
    if (!filteredData || filteredData.length === 0 || !tickItem)
      return tickItem;

    const startTimestamp = new Date(filteredData[0].date);
    const endTimestamp = new Date(filteredData[filteredData.length - 1].date);
    const totalDaysVisible =
      (endTimestamp - startTimestamp) / (1000 * 3600 * 24);

    const parsedDate = new Date(tickItem);
    const yearString = tickItem.split("-")[0];
    const monthsMatrix = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const currentMonthLabel = monthsMatrix[parsedDate.getMonth()];

    // 1. Unzoomed Macro Base State
    if (totalDaysVisible > 730) {
      return yearString;
    }
    // 2. Moderate Zoom Range View
    else if (totalDaysVisible > 90) {
      const simplifiedYear = yearString.slice(2);
      return `${currentMonthLabel} '${simplifiedYear}`;
    }
    // 3. High Zoom Micro-Structure View
    else {
      const calendarDay = parsedDate.getDate();
      return `${calendarDay}. ${currentMonthLabel}`;
    }
  };

  // Click & Drag Calculation Handler
  const handleZoomExecution = () => {
    let [leftBoundary, rightBoundary] = [refAreaLeft, refAreaRight];

    if (leftBoundary === rightBoundary || !rightBoundary) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    if (leftBoundary > rightBoundary) {
      [leftBoundary, rightBoundary] = [rightBoundary, leftBoundary];
    }

    const targetedSegment = chartData.filter(
      (dataPoint) =>
        dataPoint.date >= leftBoundary && dataPoint.date <= rightBoundary,
    );

    if (targetedSegment.length > 1) {
      setFilteredData(targetedSegment);
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const clearZoomSelection = () => {
    setFilteredData(fullDatasetCache);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const toggleLineVisibility = (targetKey) => {
    setVisibility((prevMatrix) => ({
      ...prevMatrix,
      [targetKey]: !prevMatrix[targetKey],
    }));
  };

  const handleToggleAllChannels = () => {
    const isAnyActive = Object.values(visibility).some((val) => val === true);
    setVisibility({
      price: !isAnyActive,
      bubbleUpper: !isAnyActive,
      bubbleLower: !isAnyActive,
      nonBubbleUpper: !isAnyActive,
      nonBubbleFit: !isAnyActive,
      nonBubbleLower: !isAnyActive,
    });
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
      {/* Header Container */}
      <header className="h-14 border-b border-slate-800/80 bg-[#0c101f] px-6 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-4">
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

        <span className="text-[10px] font-mono px-2.5 py-0.5 bg-slate-950 border border-slate-800 rounded-full text-emerald-400 font-bold tracking-wider flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          MAIN
        </span>
      </header>

      {/* Main Split-Screen Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
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
              </div>
            </div>
          </aside>
        )}

        {/* Dynamic Canvas Area */}
        <main className="flex-1 bg-[#060912] p-6 flex flex-col gap-4 overflow-y-auto min-w-0">
          <div className="bg-[#0b0e1a] border border-slate-800/60 rounded-xl px-5 py-3 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                {getChartTitle()}
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Identifier:{" "}
                <span className="text-amber-400 font-bold">BTC-USD</span> •
                Interval: <span className="text-slate-300">Weekly</span>
              </p>
            </div>
          </div>

          <div className="flex-1 bg-[#0b0e1a] border border-slate-800/90 rounded-2xl p-4 md:p-5 min-h-[450px] flex flex-col justify-between shadow-xl relative overflow-hidden">
            {loading && (
              <div className="absolute inset-0 bg-[#0b0e1a]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50">
                <Loader2 className="animate-spin text-emerald-400" size={32} />
                <p className="text-[10px] font-mono tracking-widest text-emerald-400/80">
                  SYNCHRONIZING CHARTS...
                </p>
              </div>
            )}

            {error && (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-red-900/40 bg-red-950/5 rounded-xl m-4">
                <ShieldAlert className="text-red-500 mb-2" size={36} />
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-200">
                  Data Synchronization Error
                </h3>
                <p className="text-xs text-slate-400 mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="w-full h-full min-h-0 min-w-0 flex-1 flex flex-col justify-between relative">
                {/* Fixed Top-Right Reset Zoom Controller */}
                <button
                  onClick={clearZoomSelection}
                  className="absolute top-0 right-2 z-40 flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-[10px] font-mono font-bold px-3 py-1.5 rounded-md border border-slate-800 shadow-lg transition-all"
                >
                  <RefreshCw size={11} /> Reset Zoom
                </button>

                <div className="flex-1 min-h-0 w-full mt-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={filteredData}
                      margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
                      onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                      onMouseMove={(e) =>
                        refAreaLeft && e && setRefAreaRight(e.activeLabel)
                      }
                      onMouseUp={handleZoomExecution}
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
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatXAxis}
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
                        tickFormatter={formatCurrency}
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
                          formatCurrency(value),
                          name,
                        ]}
                      />

                      {/* Drag Area Highlight Block */}
                      {refAreaLeft && refAreaRight && (
                        <ReferenceArea
                          x1={refAreaLeft}
                          x2={refAreaRight}
                          strokeOpacity={0.3}
                          fill="#10b981"
                          fillOpacity={0.15}
                        />
                      )}

                      {/* --- SUPPORT BANDS VIEW CHANNEL --- */}
                      {activeTab === "support-band" && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="price"
                            name="Spot Price"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="sma20"
                            name="20-Week SMA"
                            stroke="#10b981"
                            strokeWidth={1.5}
                            dot={false}
                            strokeDasharray="4 4"
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="ema21"
                            name="21-Week EMA"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls
                          />
                        </>
                      )}

                      {/* --- REGRESSION CHANNELS VIEW CHANNEL --- */}
                      {activeTab === "log-regression" &&
                        visibility.bubbleUpper && (
                          <Line
                            type="monotone"
                            dataKey="bubbleUpper"
                            name="Bubble UpperBand"
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            dot={false}
                            connectNulls={true}
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
                            connectNulls={true}
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
                            connectNulls={true}
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
                            connectNulls={true}
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
                            connectNulls={true}
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
                          connectNulls={true}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* --- SEVEN-TIER PANEL CORE CONTROLS --- */}
                {activeTab === "log-regression" && (
                  <div className="flex flex-wrap justify-center items-center gap-2 mt-4 border-t border-slate-800/60 pt-3 flex-shrink-0 z-20">
                    <button
                      onClick={handleToggleAllChannels}
                      className="text-[10px] font-mono font-bold px-2.5 py-1 rounded border bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300 transition-all"
                    >
                      Show/Hide all
                    </button>
                    <button
                      onClick={() => toggleLineVisibility("price")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.price
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Price
                    </button>
                    <button
                      onClick={() => toggleLineVisibility("bubbleUpper")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.bubbleUpper
                          ? "bg-red-500/10 text-red-400 border-red-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Bubble UpperBand
                    </button>
                    <button
                      onClick={() => toggleLineVisibility("bubbleLower")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.bubbleLower
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Bubble LowerBand
                    </button>
                    <button
                      onClick={() => toggleLineVisibility("nonBubbleUpper")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.nonBubbleUpper
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Non-Bubble Upper
                    </button>
                    <button
                      onClick={() => toggleLineVisibility("nonBubbleFit")}
                      className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-all ${
                        visibility.nonBubbleFit
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-950 text-slate-600 border-slate-900"
                      }`}
                    >
                      Non-Bubble Fit
                    </button>
                    <button
                      onClick={() => toggleLineVisibility("nonBubbleLower")}
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
