import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";
import {
  Eye,
  ShieldAlert,
  Loader2,
  Folder,
  Star,
  Calendar,
  RefreshCw,
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [chartData, setChartData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [timeframe, setTimeframe] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [chartKey, setChartKey] = useState(0); // Key used to force reset

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
    fetch(`http://127.0.0.1:8000/api/${activeTab}`)
      .then((res) => res.json())
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

  useEffect(() => {
    if (!chartData || chartData.length === 0) return;
    if (timeframe === "ALL") {
      setFilteredData(chartData);
      return;
    }
    const historical = chartData.filter((item) => item.price !== null);
    const latestDate = new Date(historical[historical.length - 1].date);
    const startDate = new Date(latestDate);
    if (timeframe === "1Y") startDate.setFullYear(startDate.getFullYear() - 1);
    else if (timeframe === "3Y")
      startDate.setFullYear(startDate.getFullYear() - 3);

    setFilteredData(
      chartData.filter((item) => new Date(item.date) >= startDate),
    );
  }, [timeframe, chartData]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  const toggleLine = (key) =>
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  const resetZoom = () => setChartKey((prev) => prev + 1); // Trigger re-render

  const handleToggleAll = () => {
    const anyVisible = Object.values(visibility).some((v) => v);
    setVisibility({
      price: !anyVisible,
      bubbleUpper: !anyVisible,
      bubbleLower: !anyVisible,
      nonBubbleUpper: !anyVisible,
      nonBubbleFit: !anyVisible,
      nonBubbleLower: !anyVisible,
    });
  };

  return (
    <div className="h-screen bg-[#070a13] text-slate-100 flex flex-col overflow-hidden">
      <header className="h-14 border-b border-slate-800/80 bg-[#0c101f] px-6 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400"
          >
            <Folder size={16} />
          </button>
          <h1 className="text-sm font-black tracking-widest text-white font-mono">
            EAGLE EYE
          </h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {isSidebarOpen && (
          <aside className="w-64 bg-[#0a0d1a] border-r border-slate-800/80 p-4 flex flex-col gap-6 overflow-y-auto">
            <button
              onClick={() => setActiveTab("support-band")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "support-band" ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400"}`}
            >
              Bull Market Support Bands
            </button>
            <button
              onClick={() => setActiveTab("log-regression")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "log-regression" ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400"}`}
            >
              Logarithmic Regression
            </button>
          </aside>
        )}

        <main className="flex-1 bg-[#060912] p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex-1 bg-[#0b0e1a] border border-slate-800/90 rounded-2xl p-4 flex flex-col relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-50">
                <Loader2 className="animate-spin" />
              </div>
            )}

            {/* Reset Zoom Button */}
            <button
              onClick={resetZoom}
              className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] px-3 py-1.5 rounded-full border border-slate-700 transition-all"
            >
              <RefreshCw size={12} /> Reset Zoom
            </button>

            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                key={`${activeTab}-${chartKey}`}
                data={filteredData}
                margin={{ top: 20, right: 30, bottom: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#475569"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => val.split("-")[0]}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={10}
                  scale={activeTab === "log-regression" ? "log" : "linear"}
                  domain={["auto", "auto"]}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#090d16" }}
                  formatter={(value) => formatCurrency(value)}
                />

                {activeTab === "support-band" && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="price"
                      name="Spot Price"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="sma20"
                      name="20-Week SMA"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      strokeDasharray="5 5"
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="ema21"
                      name="21-Week EMA"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </>
                )}

                {activeTab === "log-regression" && (
                  <>
                    {visibility.bubbleUpper && (
                      <Line
                        type="monotone"
                        dataKey="bubbleUpper"
                        name="Bubble Upper"
                        stroke="#ef4444"
                        dot={false}
                        connectNulls
                      />
                    )}
                    {visibility.bubbleLower && (
                      <Line
                        type="monotone"
                        dataKey="bubbleLower"
                        name="Bubble Lower"
                        stroke="#f97316"
                        dot={false}
                        connectNulls
                      />
                    )}
                    {visibility.nonBubbleUpper && (
                      <Line
                        type="monotone"
                        dataKey="nonBubbleUpper"
                        name="Non-Bubble Upper"
                        stroke="#eab308"
                        dot={false}
                        connectNulls
                      />
                    )}
                    {visibility.nonBubbleFit && (
                      <Line
                        type="monotone"
                        dataKey="nonBubbleFit"
                        name="Non-Bubble Fit"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                        connectNulls
                      />
                    )}
                    {visibility.nonBubbleLower && (
                      <Line
                        type="monotone"
                        dataKey="nonBubbleLower"
                        name="Non-Bubble Lower"
                        stroke="#3b82f6"
                        dot={false}
                        connectNulls
                      />
                    )}
                    {visibility.price && (
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
                  </>
                )}
                {/* Drag-to-zoom implementation */}
                <Brush
                  dataKey="date"
                  height={30}
                  stroke="#475569"
                  fill="#0b0e1a"
                  travellerWidth={10}
                />
              </LineChart>
            </ResponsiveContainer>

            {activeTab === "log-regression" && (
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <button
                  onClick={handleToggleAll}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Show/Hide All
                </button>
                <button
                  onClick={() => toggleLine("price")}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Price
                </button>
                <button
                  onClick={() => toggleLine("bubbleUpper")}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Bubble Upper
                </button>
                <button
                  onClick={() => toggleLine("bubbleLower")}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Bubble Lower
                </button>
                <button
                  onClick={() => toggleLine("nonBubbleUpper")}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Non-Bubble Upper
                </button>
                <button
                  onClick={() => toggleLine("nonBubbleFit")}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Non-Bubble Fit
                </button>
                <button
                  onClick={() => toggleLine("nonBubbleLower")}
                  className="text-[10px] p-2 bg-slate-800 rounded"
                >
                  Non-Bubble Lower
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
