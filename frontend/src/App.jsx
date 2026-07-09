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
  ComposedChart,
  Area,
} from "recharts";
import {
  Eye,
  Loader2,
  Folder,
  Star,
  RefreshCw,
  TrendingUp,
  Layers,
  BookOpen,
  Activity,
  Info,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

// --- Client-side Calculations and Data Synchronization Helpers ---
const GENESIS_TIME = new Date("2009-01-03T00:00:00Z").getTime();

const getDaysSeq = (dateStr) => {
  const date = new Date(dateStr + "T00:00:00Z");
  const diffTime = date.getTime() - GENESIS_TIME;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const getSundayOfDate = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = date.getDate() - day + (day === 0 ? 0 : 7);
  const sunday = new Date(date.setDate(diff));
  return sunday.toISOString().split('T')[0];
};

const safeFloat = (val, decimals = 2) => {
  if (val === null || val === undefined || isNaN(val)) return null;
  const floatVal = parseFloat(val);
  if (floatVal > 0 && Number(floatVal.toFixed(decimals)) === 0) {
    return parseFloat(floatVal.toFixed(6));
  }
  return parseFloat(floatVal.toFixed(decimals));
};

const fetchBinanceDaily = async () => {
  try {
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=100");
    if (!res.ok) throw new Error("Binance API error");
    return await res.json();
  } catch (e) {
    console.warn("Binance live sync bypassed, using cached data:", e);
    return [];
  }
};

const mergeBinanceDaily = (historicalWeekly, dailyKlines) => {
  const weeklyMap = new Map();
  historicalWeekly.forEach(item => {
    weeklyMap.set(item.date, item.close);
  });

  dailyKlines.forEach(k => {
    const timestamp = k[0];
    const closePrice = parseFloat(k[4]);
    const dateStr = new Date(timestamp).toISOString().split('T')[0];
    const sundayStr = getSundayOfDate(dateStr);
    
    weeklyMap.set(sundayStr, closePrice);
  });

  return Array.from(weeklyMap.entries())
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const getLogRegression = (dfWeekly, projectionYears) => {
  const data = dfWeekly.map(item => ({ ...item }));
  if (data.length === 0) return [];
  
  const lastDate = new Date(data[data.length - 1].date);
  const totalFutureWeeks = projectionYears * 52;
  for (let i = 1; i <= totalFutureWeeks; i++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(lastDate.getDate() + i * 7);
    const dateStr = futureDate.toISOString().split('T')[0];
    data.push({ date: dateStr, close: null });
  }

  const m = 5.80162;
  const c = -17.1121;

  return data.map(row => {
    const daysSeq = getDaysSeq(row.date);
    const log10_x = Math.log10(daysSeq);
    const base_fit = Math.pow(10, m * log10_x + c);

    return {
      date: row.date,
      price: safeFloat(row.close),
      nonBubbleLower: safeFloat(base_fit * 0.69819, 2),
      nonBubbleFit: safeFloat(base_fit * 1.00000, 2),
      nonBubbleUpper: safeFloat(base_fit * 1.21731, 2),
      bubbleLower: safeFloat(base_fit * 1.67845, 2),
      bubbleUpper: safeFloat(base_fit * 2.80932, 2)
    };
  });
};

const loadClientCalculations = async (projectionYears) => {
  const weeklyRes = await fetch(`${import.meta.env.BASE_URL}data/bitcoin_weekly.json`);
  if (!weeklyRes.ok) throw new Error("Could not load historical data file.");
  const historicalWeekly = await weeklyRes.json();

  const dailyKlines = await fetchBinanceDaily();
  const mergedWeekly = mergeBinanceDaily(historicalWeekly, dailyKlines);

  const windowSize = 20;
  const smaValues = [];
  for (let i = 0; i < mergedWeekly.length; i++) {
    if (i < windowSize - 1) {
      smaValues.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += mergedWeekly[i - j].close;
      }
      smaValues.push(sum / windowSize);
    }
  }

  const emaSpan = 21;
  const alpha = 2 / (emaSpan + 1);
  const emaValues = [];
  if (mergedWeekly.length > 0) {
    let prevEma = mergedWeekly[0].close;
    emaValues.push(prevEma);
    for (let i = 1; i < mergedWeekly.length; i++) {
      const curEma = mergedWeekly[i].close * alpha + prevEma * (1 - alpha);
      emaValues.push(curEma);
      prevEma = curEma;
    }
  }

  const supportBandData = mergedWeekly.map((row, i) => ({
    date: row.date,
    price: safeFloat(row.close),
    sma20: safeFloat(smaValues[i]),
    ema21: safeFloat(emaValues[i])
  }));

  const riskMetricData = mergedWeekly.map(row => {
    const daysSeq = getDaysSeq(row.date);
    const log10_x = Math.log10(daysSeq);
    const base_fit = Math.pow(10, 5.80162 * log10_x - 17.1121);
    const lower_band = base_fit * 0.69819;
    const upper_band = base_fit * 2.80932;
    
    let riskVal = 0;
    if (row.close && lower_band && upper_band) {
      const log_price = Math.log(row.close);
      const log_bottom = Math.log(lower_band);
      const log_peak = Math.log(upper_band);
      riskVal = (log_price - log_bottom) / (log_peak - log_bottom);
      riskVal = Math.max(0.0, Math.min(1.0, riskVal));
    }

    return {
      date: row.date,
      price: safeFloat(row.close),
      risk: safeFloat(riskVal, 4)
    };
  });

  const logRegressionData = getLogRegression(mergedWeekly, projectionYears);

  return {
    supportBand: supportBandData,
    riskMetric: riskMetricData,
    logRegression: logRegressionData
  };
};

const getRiskColor = (risk) => {
  if (risk === null || risk === undefined) return "#64748b";
  if (risk < 0.2) return "#3b82f6"; // Cool Blue
  if (risk < 0.4) return "#10b981"; // Emerald Green
  if (risk < 0.6) return "#eab308"; // Golden Yellow
  if (risk < 0.8) return "#f97316"; // Orange
  return "#ef4444"; // Hot Red
};

const CustomRiskDot = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload || payload.risk === undefined) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={2.5}
      fill={getRiskColor(payload.risk)}
      stroke="none"
      className="transition-all duration-300 hover:r-4 cursor-pointer"
    />
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Projection lookahead control
  const [projectionYears, setProjectionYears] = useState(3);

  // Cached states for instant navigation & stats
  const [supportBandCache, setSupportBandCache] = useState([]);
  const [logRegressionCache, setLogRegressionCache] = useState([]);
  const [riskMetricCache, setRiskMetricCache] = useState([]);

  // Active chart states
  const [chartData, setChartData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  // Zoom Handling Bounds States
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);

  // High-Fidelity Visibility States for Log Regression
  const [visibility, setVisibility] = useState({
    price: true,
    bubbleUpper: true,
    bubbleLower: true,
    nonBubbleUpper: true,
    nonBubbleFit: true,
    nonBubbleLower: true,
  });

  // 1. Initial Load: Fetch all datasets in parallel
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try local server first
        const [supportRes, logRes, riskRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/support-band").then((r) => {
            if (!r.ok) throw new Error("Local server error");
            return r.json();
          }),
          fetch(`http://127.0.0.1:8000/api/log-regression?projection_years=${projectionYears}`).then((r) => {
            if (!r.ok) throw new Error("Local server error");
            return r.json();
          }),
          fetch("http://127.0.0.1:8000/api/risk-metric").then((r) => {
            if (!r.ok) throw new Error("Local server error");
            return r.json();
          }),
        ]);

        if (supportRes.status === "error") throw new Error(supportRes.message);
        if (logRes.status === "error") throw new Error(logRes.message);
        if (riskRes.status === "error") throw new Error(riskRes.message);

        setSupportBandCache(supportRes.data);
        setLogRegressionCache(logRes.data);
        setRiskMetricCache(riskRes.data);
      } catch (err) {
        console.warn("Local API failed, switching to Serverless Client Mode:", err.message);
        try {
          const clientData = await loadClientCalculations(projectionYears);
          setSupportBandCache(clientData.supportBand);
          setLogRegressionCache(clientData.logRegression);
          setRiskMetricCache(clientData.riskMetric);
        } catch (clientErr) {
          setError(`Data Pipeline Error: ${clientErr.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // 2. Refetch Log Regression when projectionYears changes
  useEffect(() => {
    if (supportBandCache.length === 0) return; // Prevent run on mount
    const fetchRegressionForecast = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/log-regression?projection_years=${projectionYears}`
        ).then((r) => {
          if (!r.ok) throw new Error("Local server error");
          return r.json();
        });
        if (res.status === "error") throw new Error(res.message);
        setLogRegressionCache(res.data);
      } catch (err) {
        console.warn("Local API failed for regression forecast, calculating client-side:", err.message);
        const regressionData = getLogRegression(
          supportBandCache.map(row => ({ date: row.date, close: row.price })),
          projectionYears
        );
        setLogRegressionCache(regressionData);
      }
    };
    fetchRegressionForecast();
  }, [projectionYears]);

  // 3. Keep active chart selection synchronized with cached states
  useEffect(() => {
    let activeData = [];
    if (activeTab === "support-band") {
      activeData = supportBandCache;
    } else if (activeTab === "log-regression") {
      activeData = logRegressionCache;
    } else if (activeTab === "risk-metric") {
      activeData = riskMetricCache;
    }

    setChartData(activeData);
    setFilteredData(activeData);
  }, [activeTab, supportBandCache, logRegressionCache, riskMetricCache]);

  const formatCurrency = (val) => {
    if (!val) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Dynamic X-axis formatting based on view depth
  const formatXAxis = (tickItem) => {
    if (!filteredData || filteredData.length === 0 || !tickItem) return tickItem;

    const startTimestamp = new Date(filteredData[0].date);
    const endTimestamp = new Date(filteredData[filteredData.length - 1].date);
    const totalDaysVisible = (endTimestamp - startTimestamp) / (1000 * 3600 * 24);

    const parsedDate = new Date(tickItem);
    const yearString = tickItem.split("-")[0];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const currentMonthLabel = months[parsedDate.getMonth()];

    if (totalDaysVisible > 730) {
      return yearString;
    } else if (totalDaysVisible > 90) {
      const simplifiedYear = yearString.slice(2);
      return `${currentMonthLabel} '${simplifiedYear}`;
    } else {
      const calendarDay = parsedDate.getDate();
      return `${calendarDay}. ${currentMonthLabel}`;
    }
  };

  // Preset Slices (1Y, 3Y, 5Y, All-time)
  const setPresetZoom = (years) => {
    if (years === "all") {
      setFilteredData(chartData);
      return;
    }
    const weeksToSlice = years * 52;
    if (chartData.length > weeksToSlice) {
      const sliced = chartData.slice(chartData.length - weeksToSlice);
      setFilteredData(sliced);
    } else {
      setFilteredData(chartData);
    }
  };

  // Zoom Execution Handler
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
      (dataPoint) => dataPoint.date >= leftBoundary && dataPoint.date <= rightBoundary
    );

    if (targetedSegment.length > 1) {
      setFilteredData(targetedSegment);
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const clearZoomSelection = () => {
    setFilteredData(chartData);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const toggleLineVisibility = (targetKey) => {
    setVisibility((prev) => ({
      ...prev,
      [targetKey]: !prev[targetKey],
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
      return "Market Analysis: Bull Market Support Band (20W SMA & 21W EMA)";
    if (activeTab === "log-regression")
      return "Macro Modeling: Lifetime Logarithmic Regression Channels";
    return "Risk Assessment: Quantitative Risk Distribution Overlay";
  };

  // ----------------------------------------------------
  // Macro Intelligence Calculations for Top Cards
  // ----------------------------------------------------
  const latestSupport = supportBandCache.length > 0 ? supportBandCache[supportBandCache.length - 1] : null;
  const latestRisk = riskMetricCache.length > 0 ? riskMetricCache[riskMetricCache.length - 1] : null;
  const latestRegression = logRegressionCache.length > 0 ? logRegressionCache[logRegressionCache.length - 1] : null;

  const currentPrice = latestSupport?.price || latestRisk?.price || 0;
  const lastSyncDateString = latestSupport?.date
    ? new Date(latestSupport.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A";

  // Card 2: Support Band Calc
  const sma20 = latestSupport?.sma20 || 0;
  const ema21 = latestSupport?.ema21 || 0;
  let supportStatus = "SYNCHRONIZING";
  let supportColor = "text-slate-400";
  let supportBg = "bg-slate-500/10";
  let supportBorder = "border-slate-800/80";

  if (sma20 && ema21 && currentPrice) {
    if (currentPrice > sma20 && currentPrice > ema21) {
      supportStatus = "SUPPORT HELD";
      supportColor = "text-emerald-400";
      supportBg = "bg-emerald-500/10";
      supportBorder = "border-emerald-500/30";
    } else if (currentPrice < sma20 && currentPrice < ema21) {
      supportStatus = "BEARISH REGIME";
      supportColor = "text-rose-400";
      supportBg = "bg-rose-500/10";
      supportBorder = "border-rose-500/30";
    } else {
      supportStatus = "TESTING BAND";
      supportColor = "text-amber-400";
      supportBg = "bg-amber-500/10";
      supportBorder = "border-amber-500/30";
    }
  }

  // Card 3: Risk Metric Calc
  const currentRisk = latestRisk?.risk;
  let riskLabel = "MODERATE";
  let riskTextColor = "text-amber-400";
  let riskBg = "bg-amber-500/10";
  let riskBorder = "border-amber-500/30";
  let riskProgressColor = "bg-amber-500";

  if (currentRisk !== undefined && currentRisk !== null) {
    if (currentRisk < 0.2) {
      riskLabel = "FIRE SALE";
      riskTextColor = "text-blue-400";
      riskBg = "bg-blue-500/10";
      riskBorder = "border-blue-500/30";
      riskProgressColor = "bg-blue-500";
    } else if (currentRisk < 0.4) {
      riskLabel = "ACCUMULATION";
      riskTextColor = "text-emerald-400";
      riskBg = "bg-emerald-500/10";
      riskBorder = "border-emerald-500/30";
      riskProgressColor = "bg-emerald-500";
    } else if (currentRisk < 0.6) {
      riskLabel = "MODERATE RISK";
      riskTextColor = "text-amber-400";
      riskBg = "bg-amber-500/10";
      riskBorder = "border-amber-500/30";
      riskProgressColor = "bg-amber-500";
    } else if (currentRisk < 0.8) {
      riskLabel = "DISTRIBUTION";
      riskTextColor = "text-orange-400";
      riskBg = "bg-orange-500/10";
      riskBorder = "border-orange-500/30";
      riskProgressColor = "bg-orange-500";
    } else {
      riskLabel = "OVERHEATED CYCLE";
      riskTextColor = "text-rose-400";
      riskBg = "bg-rose-500/10";
      riskBorder = "border-rose-500/30";
      riskProgressColor = "bg-rose-500";
    }
  }

  // Card 4: Regression Channel Position Calc
  let regLabel = "FAIR VALUE";
  let regColorClass = "text-emerald-400";
  let regBgClass = "bg-emerald-500/10";
  let regBorderClass = "border-emerald-500/30";

  if (latestRegression && currentPrice) {
    const { nonBubbleLower, nonBubbleFit, nonBubbleUpper, bubbleLower, bubbleUpper } = latestRegression;
    if (currentPrice < nonBubbleLower) {
      regLabel = "UNDERVALUED BOTTOM";
      regColorClass = "text-blue-400";
      regBgClass = "bg-blue-500/10";
      regBorderClass = "border-blue-500/30";
    } else if (currentPrice < nonBubbleFit) {
      regLabel = "LOWER ACCUMULATION";
      regColorClass = "text-teal-400";
      regBgClass = "bg-teal-500/10";
      regBorderClass = "border-teal-500/30";
    } else if (currentPrice < nonBubbleUpper) {
      regLabel = "FAIR VALUE FIT";
      regColorClass = "text-emerald-400";
      regBgClass = "bg-emerald-500/10";
      regBorderClass = "border-emerald-500/30";
    } else if (currentPrice < bubbleLower) {
      regLabel = "UPPER EXPANSION";
      regColorClass = "text-yellow-400";
      regBgClass = "bg-yellow-500/10";
      regBorderClass = "border-yellow-500/30";
    } else if (currentPrice < bubbleUpper) {
      regLabel = "OVERHEATED RALLY";
      regColorClass = "text-orange-400";
      regBgClass = "bg-orange-500/10";
      regBorderClass = "border-orange-500/30";
    } else {
      regLabel = "BUBBLE PEAK";
      regColorClass = "text-rose-400";
      regBgClass = "bg-rose-500/10";
      regBorderClass = "border-rose-500/30";
    }
  }

  return (
    <div className="h-screen bg-[#05070e] text-slate-100 flex flex-col overflow-hidden">
      {/* Top Banner Header */}
      <header className="h-16 border-b border-slate-800/60 bg-[#090d19]/80 backdrop-blur-md px-6 flex items-center justify-between shadow-md z-30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-white transition-all duration-200 border border-slate-800/40 hover:border-slate-700"
          >
            <Layers size={16} />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-emerald-400 p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/25">
              <Eye size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest text-white font-mono flex items-center gap-1.5">
                EAGLE EYE
              </h1>
              <p className="text-[9px] text-slate-500 font-mono tracking-wider">QUANTITATIVE PLATFORM</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end font-mono">
            <span className="text-[10px] text-slate-400 font-bold">LAST SYNC</span>
            <span className="text-[10px] text-slate-500">{lastSyncDateString}</span>
          </div>
          <span className="text-[10px] font-mono px-3 py-1 bg-slate-950/80 border border-slate-800 rounded-full text-emerald-400 font-bold tracking-wider flex items-center gap-2 glow-emerald">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE ENGINE
          </span>
        </div>
      </header>

      {/* Main Split-Screen Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`${
            isSidebarOpen ? "w-64" : "w-0"
          } bg-[#070a14] border-r border-slate-800/60 p-4 flex flex-col gap-6 overflow-y-auto flex-shrink-0 transition-all duration-300 ease-in-out`}
        >
          {isSidebarOpen && (
            <>
              <div className="flex border-b border-slate-800 pb-2.5 gap-4 text-xs font-bold text-slate-400">
                <span className="text-emerald-400 border-b border-emerald-400 pb-2.5 cursor-pointer flex items-center gap-1.5">
                  <Activity size={12} /> Crypto
                </span>
                <span className="hover:text-slate-200 cursor-pointer transition-colors duration-200">Macro</span>
                <span className="hover:text-slate-200 cursor-pointer transition-colors duration-200">TradFi</span>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Star size={10} className="text-amber-400 fill-amber-400" /> FAVORITED INDICES
                </p>
                <button
                  onClick={() => setActiveTab("support-band")}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                    activeTab === "support-band"
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 pl-3"
                  }`}
                >
                  <TrendingUp size={14} />
                  Market Support Bands
                </button>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Folder size={10} /> QUANTITATIVE MODELS
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setActiveTab("log-regression")}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                      activeTab === "log-regression"
                        ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 pl-3"
                    }`}
                  >
                    <Layers size={14} />
                    Logarithmic Regression
                  </button>

                  <button
                    onClick={() => setActiveTab("risk-metric")}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                      activeTab === "risk-metric"
                        ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 pl-3"
                    }`}
                  >
                    <Activity size={14} />
                    Risk Metric Chart
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <BookOpen size={10} /> DOCUMENTATION
                </p>
                <button
                  onClick={() => setActiveTab("about")}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                    activeTab === "about"
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-400 pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 pl-3"
                  }`}
                >
                  <Info size={14} />
                  About & Methodology
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Dynamic Canvas Area */}
        <main className="flex-1 bg-[#04060b] p-6 flex flex-col gap-6 overflow-y-auto min-w-0">
          
          {/* Top intelligence Grid (Visible on all tabs for quick diagnostic analysis) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Bitcoin Spot Price */}
            <div className="bg-[#080d19]/45 border border-slate-800/60 rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm relative overflow-hidden transition-all duration-300 hover:border-slate-700">
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">BTC SPOT PRICE</span>
                <h3 className="text-xl font-extrabold text-white mt-1 font-mono tracking-tight">
                  {currentPrice ? formatCurrency(currentPrice) : "SYNCHRONIZING..."}
                </h3>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[9px] text-slate-500 font-mono">ASSET: BTC-USD</span>
                <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold font-mono">SPOT</span>
              </div>
            </div>

            {/* Card 2: Bull Market Support Band Status */}
            <div className={`bg-[#080d19]/45 border ${supportBorder} rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:border-slate-700`}>
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">BULL MARKET SUPPORT BAND</span>
                <h3 className={`text-sm font-black mt-1 font-mono tracking-wide ${supportColor} flex items-center gap-1.5`}>
                  {supportStatus}
                </h3>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800/40 pt-2 text-[10px] font-mono text-slate-400">
                <span>20W SMA: <strong className="text-slate-200">{formatCurrency(sma20)}</strong></span>
                <span>21W EMA: <strong className="text-slate-200">{formatCurrency(ema21)}</strong></span>
              </div>
            </div>

            {/* Card 3: Quantitative Risk Level */}
            <div className={`bg-[#080d19]/45 border ${riskBorder} rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:border-slate-700`}>
              <div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">RISK METRIC</span>
                  <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${riskBg} ${riskTextColor}`}>
                    {riskLabel}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-white mt-1 font-mono tracking-tight">
                  {currentRisk !== undefined ? currentRisk.toFixed(4) : "0.0000"}
                </h3>
              </div>
              <div className="mt-3 w-full bg-slate-900 rounded-full h-1.5 border border-slate-800/60 overflow-hidden">
                <div
                  className={`h-full ${riskProgressColor} transition-all duration-1000`}
                  style={{ width: `${(currentRisk || 0) * 100}%` }}
                />
              </div>
            </div>

            {/* Card 4: Regression Channel Position */}
            <div className={`bg-[#080d19]/45 border ${regBorderClass} rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:border-slate-700`}>
              <div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">REGRESSION POSITION</span>
                <h3 className={`text-sm font-black mt-1 font-mono tracking-wide ${regColorClass}`}>
                  {regLabel}
                </h3>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800/40 pt-2 text-[10px] font-mono text-slate-500">
                <span>BAND: <strong className="text-slate-300">LOG FIT</strong></span>
                <span>SENTIMENT: <strong className="text-slate-300">MACRO</strong></span>
              </div>
            </div>
          </div>

          {/* About Tab View */}
          {activeTab === "about" ? (
            <div className="flex-grow bg-[#080d19]/45 border border-slate-800/90 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-xl flex flex-col gap-6 transition-all duration-300 animate-fadeIn">
              <div>
                <h2 className="text-xl font-extrabold text-white tracking-wide">Eagle Eye Quantitative Engine</h2>
                <p className="text-xs text-slate-400 mt-1 font-mono">Macroeconomic Forecasting & Risk Modeling for Crypto Assets</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
                {/* Support Band Doc */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="text-emerald-400 mb-3 flex items-center gap-2 font-bold font-mono">
                    <TrendingUp size={18} />
                    <span>BULL MARKET SUPPORT BAND</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    The Bull Market Support Band represents a macro technical threshold computed using the convergence of the **20-Week Simple Moving Average (SMA)** and the **21-Week Exponential Moving Average (EMA)**.
                  </p>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-center mb-4">
                    <code className="text-emerald-400 font-mono text-xs">Band = [20W SMA, 21W EMA]</code>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-2 list-disc pl-4 font-mono">
                    <li>Prices trading consistently above indicate a macro bullish expansion phase.</li>
                    <li>Prices testing the band from above often signal critical support retests.</li>
                    <li>A clean weekly close below triggers a transition to a bear market regime.</li>
                  </ul>
                </div>

                {/* Log Regression Doc */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 hover:border-yellow-500/20 transition-all duration-300">
                  <div className="text-yellow-400 mb-3 flex items-center gap-2 font-bold font-mono">
                    <Layers size={18} />
                    <span>LOGARITHMIC REGRESSION</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Extrapolates long-term macroeconomic value by fitting historical daily closes against the elapsed time sequence from the genesis block anchor (January 3, 2009).
                  </p>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-center mb-4">
                    <code className="text-yellow-400 font-mono text-xs">log10(Price) = m · log10(Days) + c</code>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-2 list-disc pl-4 font-mono">
                    <li><strong>Fit Parameters:</strong> m = 5.80162, c = -17.1121.</li>
                    <li>Scales standard deviation channels to represent "Non-Bubble Fit" (undervalued consolidation) up to "Bubble Peak" (highly speculative cycles).</li>
                    <li>Compensates for diminishing returns and volatility decay over multiple cycles.</li>
                  </ul>
                </div>

                {/* Risk Metric Doc */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-5 hover:border-blue-500/20 transition-all duration-300">
                  <div className="text-blue-400 mb-3 flex items-center gap-2 font-bold font-mono">
                    <Activity size={18} />
                    <span>QUANTITATIVE RISK SCORE</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Calculates a normalized score between **0.00 and 1.00** by evaluating the logarithmic position of the active spot price relative to the lower accumulation boundary and upper speculative peak.
                  </p>
                  <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 text-center mb-4">
                    <code className="text-blue-400 font-mono text-[10px] break-all">
                      Risk = (ln(P) - ln(Bottom)) / (ln(Peak) - ln(Bottom))
                    </code>
                  </div>
                  <ul className="text-[11px] text-slate-500 space-y-2 list-disc pl-4 font-mono">
                    <li><strong>Risk &lt; 0.20 (Blue):</strong> Cycle bottoms and historical high-value accumulation windows.</li>
                    <li><strong>Risk 0.40 - 0.60 (Yellow):</strong> Neutral consolidation zone, typical in mid-cycle pauses.</li>
                    <li><strong>Risk &gt; 0.80 (Red):</strong> Extreme bubble extensions; signals optimal distribution windows.</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-slate-800/60 pt-6 mt-2 flex flex-col md:flex-row gap-4 items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={14} />
                  <span>Disclaimer: Not financial advice. Provided strictly for structural analysis.</span>
                </div>
                <span>Engine Version: 1.2.0-STABLE</span>
              </div>
            </div>
          ) : (
            /* Chart Canvas Container */
            <div className="flex-1 bg-[#080d19]/45 border border-slate-800/90 rounded-2xl p-4 md:p-5 min-h-[450px] flex flex-col justify-between backdrop-blur-md shadow-xl relative overflow-hidden transition-all duration-300">
              {loading && (
                <div className="absolute inset-0 bg-[#060913]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50">
                  <Loader2 className="animate-spin text-emerald-400" size={32} />
                  <p className="text-[10px] font-mono tracking-widest text-emerald-400/80">
                    CALCULATING MATHEMATICAL COORDINATES...
                  </p>
                </div>
              )}

              {error && (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-rose-900/40 bg-rose-950/5 rounded-xl m-4">
                  <ShieldAlert className="text-rose-500 mb-2 animate-bounce" size={36} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-200">
                    Data Pipeline Error
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">{error}</p>
                </div>
              )}

              {!loading && !error && (
                <div className="w-full h-full min-h-0 min-w-0 flex-1 flex flex-col justify-between relative">
                  {/* Top toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6 z-20">
                    <div>
                      <h2 className="text-sm font-bold text-white tracking-wide">
                        {getChartTitle()}
                      </h2>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Ticker: <span className="text-amber-400 font-bold">BTC-USD</span> • Interval: <span className="text-slate-300">Weekly</span>
                      </p>
                    </div>

                    {/* Interactive Presets, Zoom & Slicers */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Projection Controls (Visible on log regression only) */}
                      {activeTab === "log-regression" && (
                        <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 rounded-lg px-2.5 py-1">
                          <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Forecast:</span>
                          <select
                            value={projectionYears}
                            onChange={(e) => setProjectionYears(Number(e.target.value))}
                            className="bg-transparent text-slate-200 text-xs font-mono font-bold border-none outline-none cursor-pointer focus:ring-0"
                          >
                            <option value={1} className="bg-[#0b0e1a]">1 Year</option>
                            <option value={3} className="bg-[#0b0e1a]">3 Years</option>
                            <option value={5} className="bg-[#0b0e1a]">5 Years</option>
                            <option value={10} className="bg-[#0b0e1a]">10 Years</option>
                          </select>
                        </div>
                      )}

                      {/* Timeframe Preset Selectors */}
                      <div className="flex items-center bg-slate-950/60 border border-slate-800/80 rounded-lg p-0.5">
                        <button
                          onClick={() => setPresetZoom(1)}
                          className="px-2.5 py-1 text-[9px] font-mono font-bold rounded text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all"
                        >
                          1Y
                        </button>
                        <button
                          onClick={() => setPresetZoom(3)}
                          className="px-2.5 py-1 text-[9px] font-mono font-bold rounded text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all"
                        >
                          3Y
                        </button>
                        <button
                          onClick={() => setPresetZoom(5)}
                          className="px-2.5 py-1 text-[9px] font-mono font-bold rounded text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all"
                        >
                          5Y
                        </button>
                        <button
                          onClick={() => setPresetZoom("all")}
                          className="px-2.5 py-1 text-[9px] font-mono font-bold rounded text-slate-400 hover:text-white hover:bg-slate-800/40 transition-all border-l border-slate-800/40"
                        >
                          MAX
                        </button>
                      </div>

                      <button
                        onClick={clearZoomSelection}
                        className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white text-[9px] font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-800 shadow-lg transition-all"
                      >
                        <RefreshCw size={10} /> Reset Zoom
                      </button>
                    </div>
                  </div>

                  {/* Chart Container */}
                  <div className="flex-1 min-h-0 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeTab === "risk-metric" ? (
                        <ComposedChart
                          data={filteredData}
                          margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
                          onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                          onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                          onMouseUp={handleZoomExecution}
                        >
                          <defs>
                            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                              <stop offset="50%" stopColor="#eab308" stopOpacity={0.12} />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.15} vertical={false} />
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
                            yAxisId="price"
                            stroke="#475569"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            scale="log"
                            domain={[0.01, 1500000]}
                            tickFormatter={formatCurrency}
                          />
                          <YAxis
                            yAxisId="risk"
                            orientation="right"
                            stroke="#475569"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, 1.0]}
                            tickFormatter={(v) => v.toFixed(2)}
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
                            formatter={(value, name) => {
                              if (name === "Risk Metric") return [value.toFixed(4), name];
                              return [formatCurrency(value), name];
                            }}
                          />
                          {refAreaLeft && refAreaRight && (
                            <ReferenceArea
                              yAxisId="price"
                              x1={refAreaLeft}
                              x2={refAreaRight}
                              strokeOpacity={0.3}
                              fill="#10b981"
                              fillOpacity={0.15}
                            />
                          )}

                          <Area
                            yAxisId="risk"
                            type="monotone"
                            dataKey="risk"
                            name="Risk Metric"
                            stroke="#3b82f6"
                            strokeWidth={1.5}
                            fill="url(#riskGrad)"
                            dot={false}
                            connectNulls
                          />

                          <Line
                            yAxisId="price"
                            type="monotone"
                            dataKey="price"
                            name="Price"
                            stroke="#475569"
                            strokeWidth={1.5}
                            dot={<CustomRiskDot />}
                            activeDot={{ r: 5 }}
                            connectNulls
                          />
                        </ComposedChart>
                      ) : (
                        <LineChart
                          data={filteredData}
                          margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
                          onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                          onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                          onMouseUp={handleZoomExecution}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.15} vertical={false} />
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
                            scale={activeTab === "log-regression" ? "log" : "linear"}
                            domain={activeTab === "log-regression" ? [0.01, 1500000] : ["auto", "auto"]}
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
                            formatter={(value, name) => [formatCurrency(value), name]}
                          />

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
                          {activeTab === "log-regression" && visibility.bubbleUpper && (
                            <Line
                              type="monotone"
                              dataKey="bubbleUpper"
                              name="Bubble UpperBand"
                              stroke="#ef4444"
                              strokeWidth={1.2}
                              strokeOpacity={0.7}
                              dot={false}
                              connectNulls={true}
                            />
                          )}
                          {activeTab === "log-regression" && visibility.bubbleLower && (
                            <Line
                              type="monotone"
                              dataKey="bubbleLower"
                              name="Bubble LowerBand"
                              stroke="#f97316"
                              strokeWidth={1.2}
                              strokeOpacity={0.7}
                              dot={false}
                              connectNulls={true}
                            />
                          )}
                          {activeTab === "log-regression" && visibility.nonBubbleUpper && (
                            <Line
                              type="monotone"
                              dataKey="nonBubbleUpper"
                              name="Non-Bubble Upper"
                              stroke="#eab308"
                              strokeWidth={1.2}
                              strokeOpacity={0.7}
                              dot={false}
                              connectNulls={true}
                            />
                          )}
                          {activeTab === "log-regression" && visibility.nonBubbleFit && (
                            <Line
                              type="monotone"
                              dataKey="nonBubbleFit"
                              name="Non-Bubble Fit"
                              stroke="#10b981"
                              strokeWidth={1.8}
                              strokeDasharray="4 4"
                              dot={false}
                              connectNulls={true}
                            />
                          )}
                          {activeTab === "log-regression" && visibility.nonBubbleLower && (
                            <Line
                              type="monotone"
                              dataKey="nonBubbleLower"
                              name="Non-Bubble Lower"
                              stroke="#3b82f6"
                              strokeWidth={1.2}
                              strokeOpacity={0.7}
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
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Toggle Controls for Log Regression */}
                  {activeTab === "log-regression" && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-4 border-t border-slate-800/40 pt-3 flex-shrink-0 z-20">
                      <button
                        onClick={handleToggleAllChannels}
                        className="text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300 transition-all"
                      >
                        Show/Hide all
                      </button>
                      <button
                        onClick={() => toggleLineVisibility("price")}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          visibility.price
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                            : "bg-slate-950/40 text-slate-600 border-slate-950"
                        }`}
                      >
                        Price
                      </button>
                      <button
                        onClick={() => toggleLineVisibility("bubbleUpper")}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          visibility.bubbleUpper
                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                            : "bg-slate-950/40 text-slate-600 border-slate-950"
                        }`}
                      >
                        Bubble UpperBand
                      </button>
                      <button
                        onClick={() => toggleLineVisibility("bubbleLower")}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          visibility.bubbleLower
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                            : "bg-slate-950/40 text-slate-600 border-slate-950"
                        }`}
                      >
                        Bubble LowerBand
                      </button>
                      <button
                        onClick={() => toggleLineVisibility("nonBubbleUpper")}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          visibility.nonBubbleUpper
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                            : "bg-slate-950/40 text-slate-600 border-slate-950"
                        }`}
                      >
                        Non-Bubble Upper
                      </button>
                      <button
                        onClick={() => toggleLineVisibility("nonBubbleFit")}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          visibility.nonBubbleFit
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-slate-950/40 text-slate-600 border-slate-950"
                        }`}
                      >
                        Non-Bubble Fit
                      </button>
                      <button
                        onClick={() => toggleLineVisibility("nonBubbleLower")}
                        className={`text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                          visibility.nonBubbleLower
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-slate-950/40 text-slate-600 border-slate-950"
                        }`}
                      >
                        Non-Bubble Lower
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
