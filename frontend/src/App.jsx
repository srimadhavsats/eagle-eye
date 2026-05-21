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
import { Eye, Loader2, Folder, Calendar, RefreshCw } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [chartData, setChartData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Zoom State
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [fullData, setFullData] = useState([]);

  useEffect(() => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/${activeTab}`)
      .then((res) => res.json())
      .then((payload) => {
        setChartData(payload.data);
        setFullData(payload.data);
        setFilteredData(payload.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeTab]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);

  // Dynamic X-Axis Formatter: Years -> Months -> Days
  const formatXAxis = (tickItem) => {
    const range =
      (new Date(filteredData[filteredData.length - 1].date) -
        new Date(filteredData[0].date)) /
      (1000 * 3600 * 24);
    if (range > 365) return tickItem.split("-")[0]; // Year
    if (range > 30) return tickItem.slice(5); // Month-Day
    return tickItem; // Full Date
  };

  const zoom = () => {
    let [left, right] = [refAreaLeft, refAreaRight];
    if (left === right || right === "") {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    if (left > right) [left, right] = [right, left];

    const newData = chartData.filter((d) => d.date >= left && d.date <= right);
    setFilteredData(newData);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const resetZoom = () => {
    setFilteredData(fullData);
    setRefAreaLeft(null);
    setRefAreaRight(null);
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
              Support Bands
            </button>
            <button
              onClick={() => setActiveTab("log-regression")}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold ${activeTab === "log-regression" ? "bg-emerald-500/10 text-emerald-400" : "text-slate-400"}`}
            >
              Regression Channels
            </button>
          </aside>
        )}

        <main className="flex-1 bg-[#060912] p-6 flex flex-col overflow-y-auto">
          <div className="flex-1 bg-[#0b0e1a] border border-slate-800/90 rounded-2xl p-4 relative">
            <button
              onClick={resetZoom}
              className="absolute top-4 right-4 z-40 flex items-center gap-2 bg-slate-800 text-[10px] px-3 py-1.5 rounded-full border border-slate-700"
            >
              <RefreshCw size={10} /> Reset Zoom
            </button>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={filteredData}
                onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                onMouseMove={(e) =>
                  refAreaLeft && e && setRefAreaRight(e.activeLabel)
                }
                onMouseUp={zoom}
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
                  tickFormatter={formatXAxis}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={10}
                  scale={activeTab === "log-regression" ? "log" : "linear"}
                  domain={["auto", "auto"]}
                  tickFormatter={formatCurrency}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} />

                {/* Visual indicator for the selection box */}
                {refAreaLeft && refAreaRight ? (
                  <ReferenceArea
                    x1={refAreaLeft}
                    x2={refAreaRight}
                    strokeOpacity={0.3}
                    fill="#10b981"
                    fillOpacity={0.2}
                  />
                ) : null}

                {/* Render lines dynamically based on active tab */}
                {activeTab === "support-band" ? (
                  <>
                    <Line
                      dataKey="price"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      dataKey="sma20"
                      stroke="#10b981"
                      strokeDasharray="5 5"
                      dot={false}
                      connectNulls
                    />
                  </>
                ) : (
                  <>
                    <Line
                      dataKey="price"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      dataKey="nonBubbleFit"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </main>
      </div>
    </div>
  );
}
