import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
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
  Sun,
  Moon,
  Zap,
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

const generateMacroData = (supportBandCache, tab) => {
  if (supportBandCache.length === 0) return [];
  
  return supportBandCache.map(row => {
    const dateObj = new Date(row.date);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    const t = year + (month + day / 30) / 12 - 2010;

    let value = 0;
    let labelName = "";

    if (tab === "dxy") {
      labelName = "DXY Index";
      const base = 80 + t * 0.8;
      const cycle = 8 * Math.sin(t * 0.9) + 4 * Math.cos(t * 1.8);
      const covidShock = (t > 10 && t < 11) ? -5 * Math.sin((t - 10) * Math.PI) : 0;
      const rateHikePeak = (t > 12 && t < 13.5) ? 12 * Math.sin((t - 12) * Math.PI / 1.5) : 0;
      const postRateGlow = (t >= 13.5) ? 10 + Math.sin(t) : 0;
      value = base + cycle + covidShock + rateHikePeak + postRateGlow;
      value = Math.max(70, Math.min(130, value));
    } else if (tab === "cpi") {
      labelName = "CPI YoY (%)";
      const base = 1.8;
      const cycle = 0.5 * Math.sin(t * 1.2);
      const supplyShock = (t > 11 && t < 14) ? 6.5 * Math.sin((t - 11) * Math.PI / 2.5) : 0;
      const normalization = (t >= 14) ? 0.8 * Math.cos(t) : 0;
      value = base + cycle + supplyShock + normalization;
      value = Math.max(-0.5, Math.min(10.5, value));
    } else if (tab === "fed-rate") {
      labelName = "Fed Rate (%)";
      if (t < 5.5) {
        value = 0.25;
      } else if (t < 8.8) {
        value = 0.25 + (t - 5.5) * (2.25 / 3.3);
      } else if (t < 10.2) {
        value = 2.5 - (t - 8.8) * (2.25 / 1.4);
      } else if (t < 12.2) {
        value = 0.25;
      } else if (t < 13.8) {
        value = 0.25 + (t - 12.2) * (5.0 / 1.6);
      } else {
        value = 5.25 - (t - 13.8) * 0.5;
      }
      value = Math.max(0.08, Math.min(5.5, value));
    } else if (tab === "spx") {
      labelName = "S&P 500 Index";
      const baseTrend = 1100 * Math.exp(t * 0.105);
      const correction2011 = (t > 1 && t < 2) ? -150 * Math.sin((t - 1) * Math.PI) : 0;
      const correction2015 = (t > 5 && t < 6) ? -200 * Math.sin((t - 5) * Math.PI) : 0;
      const correction2018 = (t > 8 && t < 9) ? -350 * Math.sin((t - 8) * Math.PI) : 0;
      const covidCrash = (t > 10 && t < 10.4) ? -600 * Math.sin((t - 10) * Math.PI / 0.4) : 0;
      const bubble2021 = (t > 10.4 && t < 12) ? 800 * Math.sin((t - 10.4) * Math.PI / 1.6) : 0;
      const correction2022 = (t > 12 && t < 13.2) ? -700 * Math.sin((t - 12) * Math.PI / 1.2) : 0;
      const bullRun2024 = (t > 13.2) ? 600 * Math.sin((t - 13.2) * Math.PI / 3) : 0;
      value = baseTrend + correction2011 + correction2015 + correction2018 + covidCrash + bubble2021 + correction2022 + bullRun2024;
      value = Math.max(800, value);
    } else if (tab === "gold") {
      labelName = "Gold Spot ($)";
      const baseTrend = 1100 + t * 50;
      const goldRally2011 = (t < 3) ? 500 * Math.sin(t * Math.PI / 3) : 0;
      const bearCycle = (t >= 3 && t < 9) ? -300 * Math.sin((t - 3) * Math.PI / 6) : 0;
      const inflationRally = (t >= 9) ? 400 * Math.sin((t - 9) * Math.PI / 4) : 0;
      const peak2024 = (t >= 14) ? 350 + 100 * Math.sin(t) : 0;
      value = baseTrend + goldRally2011 + bearCycle + inflationRally + peak2024;
      value = Math.max(900, value);
    } else if (tab === "us10y") {
      labelName = "US 10Y Yield (%)";
      const base = 3.5 - t * 0.12;
      const cycle = 0.8 * Math.sin(t * 1.5) + 0.4 * Math.cos(t * 3.0);
      const yieldSpike = (t > 12 && t < 14) ? 2.5 * Math.sin((t - 12) * Math.PI / 2.0) : 0;
      value = base + cycle + yieldSpike;
      value = Math.max(0.4, Math.min(5.2, value));
    }

    return {
      date: row.date,
      price: safeFloat(value),
      btcPrice: row.price,
      labelName
    };
  });
};

const formatMacroValue = (val, tab) => {
  if (val === null || val === undefined) return "";
  if (["cpi", "fed-rate", "us10y"].includes(tab)) {
    return `${val.toFixed(2)}%`;
  }
  if (["spx", "gold"].includes(tab)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(val);
  }
  return val.toFixed(2); // DXY
};

const chartColors = {
  dark: {
    grid: "rgba(30, 41, 59, 0.15)",
    text: "#475569",
    tooltipBg: "#090d16",
    tooltipBorder: "#1e293b",
    primaryLine: "#10b981",
    secondaryLine: "#3b82f6",
    priceLine: "#f59e0b",
  },
  light: {
    grid: "rgba(226, 232, 240, 0.6)",
    text: "#475569",
    tooltipBg: "#ffffff",
    tooltipBorder: "#cbd5e1",
    primaryLine: "#2563eb",
    secondaryLine: "#0f766e",
    priceLine: "#ea580c",
  },
  cyberpunk: {
    grid: "rgba(244, 63, 94, 0.15)",
    text: "#d946ef",
    tooltipBg: "#1d023b",
    tooltipBorder: "#f43f5e",
    primaryLine: "#eab308",
    secondaryLine: "#00ffff",
    priceLine: "#f43f5e",
  }
};

const halvingDates = [
  { date: "2012-11-25", label: "2012 Halving", year: "2012" },
  { date: "2016-07-10", label: "2016 Halving", year: "2016" },
  { date: "2020-05-10", label: "2020 Halving", year: "2020" },
  { date: "2024-04-21", label: "2024 Halving", year: "2024" },
  { date: "2028-04-16", label: "2028 Halving", year: "2028" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("support-band");
  const [activeCategory, setActiveCategory] = useState("crypto");
  const [theme, setTheme] = useState("dark");
  const [activeZoom, setActiveZoom] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Responsive mobile states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  
  // Halving view states
  const [showHalvingLines, setShowHalvingLines] = useState(false);

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

  // Resize listener for responsive devices
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

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
    } else if (["dxy", "cpi", "fed-rate", "spx", "gold", "us10y"].includes(activeTab)) {
      activeData = generateMacroData(supportBandCache, activeTab);
    }

    setChartData(activeData);
    setFilteredData(activeData);
    setActiveZoom("all");
  }, [activeTab, supportBandCache, logRegressionCache, riskMetricCache]);

  const formatCurrency = (val) => {
    if (!val) return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Dynamic X-axis formatting based on view depth & halving selection
  const formatXAxis = (tickItem) => {
    if (!filteredData || filteredData.length === 0 || !tickItem) return tickItem;

    const parsedDate = new Date(tickItem);
    if (isNaN(parsedDate.getTime())) return tickItem;

    const yearString = tickItem.split("-")[0];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const currentMonthLabel = months[parsedDate.getMonth()];

    if (showHalvingLines) {
      const halvingMatch = halvingDates.find(hd => hd.date === tickItem);
      if (halvingMatch) {
        return `${halvingMatch.year} Halv.`;
      }
    }

    const startTimestamp = new Date(filteredData[0].date);
    const endTimestamp = new Date(filteredData[filteredData.length - 1].date);
    const totalDaysVisible = (endTimestamp - startTimestamp) / (1000 * 3600 * 24);

    if (totalDaysVisible > 730) {
      return yearString;
    } else if (totalDaysVisible > 90) {
      const simplifiedYear = yearString.slice(2);
      return `${currentMonthLabel} '${simplifiedYear}`;
    } else {
      const calendarDay = parsedDate.getDate();
      return `${calendarDay} ${currentMonthLabel}`;
    }
  };

  // Preset Slices (1Y, 3Y, 5Y, All-time)
  const setPresetZoom = (val) => {
    setActiveZoom(val);
    if (val === "all") {
      setFilteredData(chartData);
      return;
    }
    const weeksToSlice = val * 52;
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
      setActiveZoom("custom");
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const clearZoomSelection = () => {
    setFilteredData(chartData);
    setActiveZoom("all");
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
    if (activeTab === "risk-metric")
      return "Risk Assessment: Quantitative Risk Distribution Overlay";
    if (activeTab === "dxy")
      return "Currency Benchmark: US Dollar Index (DXY) Correlation";
    if (activeTab === "cpi")
      return "Macroeconomic Indicator: Consumer Price Index (CPI YoY) Cycle";
    if (activeTab === "fed-rate")
      return "Central Banking: Effective Federal Funds Interest Rate Cycle";
    if (activeTab === "spx")
      return "Equity Benchmark: S&P 500 Index Market Volatility";
    if (activeTab === "gold")
      return "Commodity Standard: Gold Spot Price (XAU/USD) Chart";
    if (activeTab === "us10y")
      return "Sovereign Yields: United States 10-Year Treasury Yield Benchmark";
    return "";
  };

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    if (cat === "crypto") {
      setActiveTab("support-band");
    } else if (cat === "macro") {
      setActiveTab("dxy");
    } else if (cat === "tradfi") {
      setActiveTab("spx");
    }
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  // ----------------------------------------------------
  // Macro Intelligence Calculations for Top Cards
  // ----------------------------------------------------
  // ----------------------------------------------------
  // Memoized Macro Intelligence Calculations for Top Cards
  // ----------------------------------------------------
  const latestSupport = useMemo(() => supportBandCache.length > 0 ? supportBandCache[supportBandCache.length - 1] : null, [supportBandCache]);
  const latestRisk = useMemo(() => riskMetricCache.length > 0 ? riskMetricCache[riskMetricCache.length - 1] : null, [riskMetricCache]);
  const latestRegression = useMemo(() => logRegressionCache.length > 0 ? logRegressionCache[logRegressionCache.length - 1] : null, [logRegressionCache]);

  const currentPrice = useMemo(() => latestSupport?.price || latestRisk?.price || 0, [latestSupport, latestRisk]);
  const lastSyncDateString = useMemo(() => latestSupport?.date
    ? new Date(latestSupport.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "N/A", [latestSupport]);

  // Card 2: Support Band Calc
  const sma20 = latestSupport?.sma20 || 0;
  const ema21 = latestSupport?.ema21 || 0;

  const supportCardDetails = useMemo(() => {
    let status = "SYNCHRONIZING";
    let color = "text-slate-400";
    let bg = "bg-slate-500/10";
    let border = "border-slate-800/80";

    if (sma20 && ema21 && currentPrice) {
      if (currentPrice > sma20 && currentPrice > ema21) {
        status = "SUPPORT HELD";
        color = "text-emerald-400";
        bg = "bg-emerald-500/10";
        border = "border-emerald-500/30";
      } else if (currentPrice < sma20 && currentPrice < ema21) {
        status = "BEARISH REGIME";
        color = "text-rose-400";
        bg = "bg-rose-500/10";
        border = "border-rose-500/30";
      } else {
        status = "TESTING BAND";
        color = "text-amber-400";
        bg = "bg-amber-500/10";
        border = "border-amber-500/30";
      }
    }
    return { status, color, bg, border };
  }, [sma20, ema21, currentPrice]);

  const supportStatus = supportCardDetails.status;
  const supportColor = supportCardDetails.color;
  const supportBg = supportCardDetails.bg;
  const supportBorder = supportCardDetails.border;

  // Card 3: Risk Metric Calc
  const currentRisk = latestRisk?.risk;
  const riskCardDetails = useMemo(() => {
    let label = "MODERATE";
    let textColor = "text-amber-400";
    let bg = "bg-amber-500/10";
    let border = "border-amber-500/30";
    let progressColor = "bg-amber-500";

    if (currentRisk !== undefined && currentRisk !== null) {
      if (currentRisk < 0.2) {
        label = "FIRE SALE";
        textColor = "text-blue-400";
        bg = "bg-blue-500/10";
        border = "border-blue-500/30";
        progressColor = "bg-blue-500";
      } else if (currentRisk < 0.4) {
        label = "ACCUMULATION";
        textColor = "text-emerald-400";
        bg = "bg-emerald-500/10";
        border = "border-emerald-500/30";
        progressColor = "bg-emerald-500";
      } else if (currentRisk < 0.6) {
        label = "MODERATE RISK";
        textColor = "text-amber-400";
        bg = "bg-amber-500/10";
        border = "border-amber-500/30";
        progressColor = "bg-amber-500";
      } else if (currentRisk < 0.8) {
        label = "DISTRIBUTION";
        textColor = "text-orange-400";
        bg = "bg-orange-500/10";
        border = "border-orange-500/30";
        progressColor = "bg-orange-500";
      } else {
        label = "OVERHEATED CYCLE";
        textColor = "text-rose-400";
        bg = "bg-rose-500/10";
        border = "border-rose-500/30";
        progressColor = "bg-rose-500";
      }
    }
    return { label, textColor, bg, border, progressColor };
  }, [currentRisk]);

  const riskLabel = riskCardDetails.label;
  const riskTextColor = riskCardDetails.textColor;
  const riskBg = riskCardDetails.bg;
  const riskBorder = riskCardDetails.border;
  const riskProgressColor = riskCardDetails.progressColor;

  // Card 4: Regression Channel Position Calc
  const regressionCardDetails = useMemo(() => {
    let label = "FAIR VALUE";
    let colorClass = "text-emerald-400";
    let bgClass = "bg-emerald-500/10";
    let borderClass = "border-emerald-500/30";

    if (latestRegression && currentPrice) {
      const { nonBubbleLower, nonBubbleFit, nonBubbleUpper, bubbleLower, bubbleUpper } = latestRegression;
      if (currentPrice < nonBubbleLower) {
        label = "UNDERVALUED BOTTOM";
        colorClass = "text-blue-400";
        bgClass = "bg-blue-500/10";
        borderClass = "border-blue-500/30";
      } else if (currentPrice < nonBubbleFit) {
        label = "LOWER ACCUMULATION";
        colorClass = "text-teal-400";
        bgClass = "bg-teal-500/10";
        borderClass = "border-teal-500/30";
      } else if (currentPrice < nonBubbleUpper) {
        label = "FAIR VALUE FIT";
        colorClass = "text-emerald-400";
        bgClass = "bg-emerald-500/10";
        borderClass = "border-emerald-500/30";
      } else if (currentPrice < bubbleLower) {
        label = "UPPER EXPANSION";
        colorClass = "text-yellow-400";
        bgClass = "bg-yellow-500/10";
        borderClass = "border-yellow-500/30";
      } else if (currentPrice < bubbleUpper) {
        label = "OVERHEATED RALLY";
        colorClass = "text-orange-400";
        bgClass = "bg-orange-500/10";
        borderClass = "border-orange-500/30";
      } else {
        label = "BUBBLE PEAK";
        colorClass = "text-rose-400";
        bgClass = "bg-rose-500/10";
        borderClass = "border-rose-500/30";
      }
    }
    return { label, colorClass, bgClass, borderClass };
  }, [latestRegression, currentPrice]);

  const regLabel = regressionCardDetails.label;
  const regColorClass = regressionCardDetails.colorClass;
  const regBgClass = regressionCardDetails.bgClass;
  const regBorderClass = regressionCardDetails.borderClass;

  const dxyData = useMemo(() => generateMacroData(supportBandCache, "dxy"), [supportBandCache]);
  const latestDxyObj = useMemo(() => dxyData.length > 0 ? dxyData[dxyData.length - 1] : null, [dxyData]);
  const cpiData = useMemo(() => generateMacroData(supportBandCache, "cpi"), [supportBandCache]);
  const latestCpiObj = useMemo(() => cpiData.length > 0 ? cpiData[cpiData.length - 1] : null, [cpiData]);
  const fedData = useMemo(() => generateMacroData(supportBandCache, "fed-rate"), [supportBandCache]);
  const latestFedObj = useMemo(() => fedData.length > 0 ? fedData[fedData.length - 1] : null, [fedData]);
  const us10yData = useMemo(() => generateMacroData(supportBandCache, "us10y"), [supportBandCache]);
  const latestUs10yObj = useMemo(() => us10yData.length > 0 ? us10yData[us10yData.length - 1] : null, [us10yData]);
  const spxData = useMemo(() => generateMacroData(supportBandCache, "spx"), [supportBandCache]);
  const latestSpxObj = useMemo(() => spxData.length > 0 ? spxData[spxData.length - 1] : null, [spxData]);
  const goldData = useMemo(() => generateMacroData(supportBandCache, "gold"), [supportBandCache]);
  const latestGoldObj = useMemo(() => goldData.length > 0 ? goldData[goldData.length - 1] : null, [goldData]);

  const currentThemeColors = chartColors[theme] || chartColors.dark;

  const activeXAxisTicks = useMemo(() => {
    if (!showHalvingLines || !filteredData || filteredData.length === 0) return undefined;
    const start = filteredData[0].date;
    const end = filteredData[filteredData.length - 1].date;
    const visibleHalvings = halvingDates
      .map((hd) => hd.date)
      .filter((date) => date >= start && date <= end);
    return visibleHalvings.length > 0 ? visibleHalvings : undefined;
  }, [showHalvingLines, filteredData]);

  return (
    <div className={`h-screen flex flex-col overflow-hidden theme-bg-primary theme-text-primary transition-colors duration-300 ${theme === "light" ? "theme-light" : theme === "cyberpunk" ? "theme-cyberpunk" : ""}`}>
      {/* Top Banner Header */}
      <header className="h-16 border-b theme-border theme-bg-panel backdrop-blur-md px-4 md:px-6 flex items-center justify-between shadow-md z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:theme-bg-secondary theme-text-secondary hover:theme-text-primary transition-all duration-200 border theme-border"
          >
            <Layers size={16} />
          </button>

          <div className="flex items-center gap-3">
            <div className="theme-accent p-1.5 bg-emerald-500/10 rounded-lg border theme-border">
              <Eye size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest theme-text-primary font-mono flex items-center gap-1.5">
                EAGLE EYE
              </h1>
              <p className="text-[9px] theme-text-muted font-mono tracking-wider">QUANTITATIVE PLATFORM</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Switcher Pill */}
          <div className="flex items-center gap-1 bg-[#090d19]/60 theme-bg-secondary border theme-border p-1 rounded-lg">
            <button
              onClick={() => setTheme("dark")}
              className={`p-1.5 rounded-md transition-all ${
                theme === "dark"
                  ? "bg-emerald-500/10 text-emerald-400 theme-accent"
                  : "theme-text-muted hover:theme-text-primary"
              }`}
              title="Slate Cyber (Default Dark)"
            >
              <Moon size={14} />
            </button>
            <button
              onClick={() => setTheme("light")}
              className={`p-1.5 rounded-md transition-all ${
                theme === "light"
                  ? "bg-blue-500/10 text-blue-600 theme-accent"
                  : "theme-text-muted hover:theme-text-primary"
              }`}
              title="Light Terminal"
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => setTheme("cyberpunk")}
              className={`p-1.5 rounded-md transition-all ${
                theme === "cyberpunk"
                  ? "bg-yellow-500/10 text-yellow-400 theme-accent"
                  : "theme-text-muted hover:theme-text-primary"
              }`}
              title="Neon Horizon (Cyberpunk)"
            >
              <Zap size={14} />
            </button>
          </div>

          <div className="hidden sm:flex flex-col items-end font-mono">
            <span className="text-[10px] theme-text-secondary font-bold">LAST SYNC</span>
            <span className="text-[10px] theme-text-muted">{lastSyncDateString}</span>
          </div>
          <span className="text-[10px] font-mono px-3 py-1 bg-slate-950/80 border theme-border rounded-full theme-accent font-bold tracking-wider flex items-center gap-2 glow-emerald">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE ENGINE
          </span>
        </div>
      </header>

      {/* Main Split-Screen Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-black/60 z-35 top-16"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`${
            isSidebarOpen 
              ? "w-64 translate-x-0 opacity-100" 
              : "w-0 -translate-x-full opacity-0 pointer-events-none md:pointer-events-auto md:w-0"
          } fixed md:relative top-16 md:top-0 bottom-0 left-0 z-40 md:z-auto theme-bg-secondary border-r theme-border p-4 flex flex-col gap-6 overflow-y-auto flex-shrink-0 transition-all duration-300 ease-in-out`}
          style={isMobile ? { height: "calc(100vh - 4rem)" } : {}}
        >
          {isSidebarOpen && (
            <>
              {/* Category selector */}
              <div className="flex border-b theme-border pb-2.5 gap-4 text-xs font-bold theme-text-secondary">
                <span
                  onClick={() => handleCategoryChange("crypto")}
                  className={`${
                    activeCategory === "crypto"
                      ? "theme-accent border-b-2 theme-border-glow pb-2.5 font-bold"
                      : "hover:theme-text-primary cursor-pointer"
                  } flex items-center gap-1.5 transition-all duration-200`}
                >
                  <Activity size={12} /> Crypto
                </span>
                <span
                  onClick={() => handleCategoryChange("macro")}
                  className={`${
                    activeCategory === "macro"
                      ? "theme-accent border-b-2 theme-border-glow pb-2.5 font-bold"
                      : "hover:theme-text-primary cursor-pointer"
                  } flex items-center gap-1.5 transition-all duration-200`}
                >
                  <TrendingUp size={12} /> Macro
                </span>
                <span
                  onClick={() => handleCategoryChange("tradfi")}
                  className={`${
                    activeCategory === "tradfi"
                      ? "theme-accent border-b-2 theme-border-glow pb-2.5 font-bold"
                      : "hover:theme-text-primary cursor-pointer"
                  } flex items-center gap-1.5 transition-all duration-200`}
                >
                  <Layers size={12} /> TradFi
                </span>
              </div>

              {/* Dynamic sidebar links based on activeCategory */}
              {activeCategory === "crypto" && (
                <>
                  <div>
                    <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Star size={10} className="text-amber-400 fill-amber-400" /> FAVORITED INDICES
                    </p>
                    <button
                      onClick={() => handleTabClick("support-band")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "support-band"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <TrendingUp size={14} />
                      Market Support Bands
                    </button>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Folder size={10} /> QUANTITATIVE MODELS
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <button
                        onClick={() => handleTabClick("log-regression")}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                          activeTab === "log-regression"
                            ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                            : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                        }`}
                      >
                        <Layers size={14} />
                        Logarithmic Regression
                      </button>

                      <button
                        onClick={() => handleTabClick("risk-metric")}
                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                          activeTab === "risk-metric"
                            ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2 shadow-[inset_4px_0_12px_rgba(16,185,129,0.05)]"
                            : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                        }`}
                      >
                        <Activity size={14} />
                        Risk Metric Chart
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeCategory === "macro" && (
                <div>
                  <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Star size={10} className="text-amber-400 fill-amber-400" /> MACROECONOMIC INDICATORS
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleTabClick("dxy")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "dxy"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <Activity size={14} />
                      US Dollar Index (DXY)
                    </button>
                    <button
                      onClick={() => handleTabClick("cpi")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "cpi"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <TrendingUp size={14} />
                      Inflation (CPI YoY %)
                    </button>
                    <button
                      onClick={() => handleTabClick("fed-rate")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "fed-rate"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <Layers size={14} />
                      Fed Funds Rate Cycle
                    </button>
                    <button
                      onClick={() => handleTabClick("us10y")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "us10y"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <Activity size={14} />
                      US 10Y Treasury Yield
                    </button>
                  </div>
                </div>
              )}

              {activeCategory === "tradfi" && (
                <div>
                  <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Star size={10} className="text-amber-400 fill-amber-400" /> GLOBAL BENCHMARKS
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleTabClick("spx")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "spx"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <Layers size={14} />
                      S&P 500 Equity Index
                    </button>
                    <button
                      onClick={() => handleTabClick("gold")}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                        activeTab === "gold"
                          ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                          : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
                      }`}
                    >
                      <TrendingUp size={14} />
                      Gold Spot Market
                    </button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <BookOpen size={10} /> DOCUMENTATION
                </p>
                <button
                  onClick={() => handleTabClick("about")}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 flex items-center gap-2.5 ${
                    activeTab === "about"
                      ? "bg-emerald-500/10 theme-accent border-l-2 theme-border-glow pl-2"
                      : "theme-text-secondary hover:theme-text-primary hover:theme-bg-secondary pl-3"
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
        <main className="flex-grow theme-bg-primary p-4 md:p-6 flex flex-col gap-6 overflow-y-auto min-w-0">
          
          {/* Top Intelligence Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeCategory === "crypto" && (
              <>
                {/* Card 1: Bitcoin Spot Price */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm relative overflow-hidden transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">BTC SPOT PRICE</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {currentPrice ? formatCurrency(currentPrice) : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">ASSET: BTC-USD</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">SPOT</span>
                  </div>
                </div>

                {/* Card 2: Bull Market Support Band Status */}
                <div className={`theme-bg-card border ${supportBorder} rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow`}>
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">BULL MARKET SUPPORT BAND</span>
                    <h3 className={`text-sm font-black mt-1 font-mono tracking-wide ${supportColor} flex items-center gap-1.5`}>
                      {supportStatus}
                    </h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t theme-border pt-2 text-[10px] font-mono theme-text-secondary">
                    <span>20W SMA: <strong className="theme-text-primary">{formatCurrency(sma20)}</strong></span>
                    <span>21W EMA: <strong className="theme-text-primary">{formatCurrency(ema21)}</strong></span>
                  </div>
                </div>

                {/* Card 3: Quantitative Risk Level */}
                <div className={`theme-bg-card border ${riskBorder} rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow`}>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">RISK METRIC</span>
                      <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${riskBg} ${riskTextColor}`}>
                        {riskLabel}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {currentRisk !== undefined ? currentRisk.toFixed(4) : "0.0000"}
                    </h3>
                  </div>
                  <div className="mt-3 w-full bg-slate-900 rounded-full h-1.5 border theme-border overflow-hidden">
                    <div
                      className={`h-full ${riskProgressColor} transition-all duration-1000`}
                      style={{ width: `${(currentRisk || 0) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Card 4: Regression Channel Position */}
                <div className={`theme-bg-card border ${regBorderClass} rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow`}>
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">REGRESSION POSITION</span>
                    <h3 className={`text-sm font-black mt-1 font-mono tracking-wide ${regColorClass}`}>
                      {regLabel}
                    </h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t theme-border pt-2 text-[10px] font-mono theme-text-muted">
                    <span>BAND: <strong className="theme-text-secondary">LOG FIT</strong></span>
                    <span>SENTIMENT: <strong className="theme-text-secondary">MACRO</strong></span>
                  </div>
                </div>
              </>
            )}

            {activeCategory === "macro" && (
              <>
                {/* Card 1: DXY index */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">US Dollar Index (DXY)</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestDxyObj ? formatMacroValue(latestDxyObj.price, "dxy") : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">MODEL: Offline Cycle</span>
                    <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">DXY</span>
                  </div>
                </div>

                {/* Card 2: CPI index */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">Inflation (CPI YoY)</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestCpiObj ? formatMacroValue(latestCpiObj.price, "cpi") : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">MODEL: Offline Cycle</span>
                    <span className="text-[9px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">YoY</span>
                  </div>
                </div>

                {/* Card 3: Fed Rate */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">Fed Funds Interest Rate</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestFedObj ? formatMacroValue(latestFedObj.price, "fed-rate") : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">POLICY: Interest Cycles</span>
                    <span className="text-[9px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">FED</span>
                  </div>
                </div>

                {/* Card 4: US10Y */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">US 10-Year Bond Yield</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestUs10yObj ? formatMacroValue(latestUs10yObj.price, "us10y") : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">MODEL: Bond Yields</span>
                    <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">YIELD</span>
                  </div>
                </div>
              </>
            )}

            {activeCategory === "tradfi" && (
              <>
                {/* Card 1: S&P 500 Index */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">S&P 500 Index</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestSpxObj ? formatMacroValue(latestSpxObj.price, "spx") : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">ASSET: SPX-USD</span>
                    <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">INDEX</span>
                  </div>
                </div>

                {/* Card 2: Gold Spot Price */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">Gold Spot Price</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestGoldObj ? formatMacroValue(latestGoldObj.price, "gold") : "SYNCHRONIZING..."}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">ASSET: XAU-USD</span>
                    <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">GOLD</span>
                  </div>
                </div>

                {/* Card 3: Core Dollar Index */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">CORE DOLLAR BENCHMARK</span>
                    <h3 className="text-sm font-black mt-1 font-mono tracking-wide text-emerald-400">
                      STRENGTH ENHANCED
                    </h3>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t theme-border pt-2 text-[10px] font-mono theme-text-muted">
                    <span>STATUS: <strong className="theme-text-secondary">ACTIVE</strong></span>
                    <span>TYPE: <strong className="theme-text-secondary">TRADFI</strong></span>
                  </div>
                </div>

                {/* Card 4: S&P/Gold Ratio */}
                <div className="theme-bg-card border theme-border rounded-xl p-4 flex flex-col justify-between backdrop-blur-md shadow-sm transition-all duration-300 hover:theme-border-glow">
                  <div>
                    <span className="text-[10px] font-mono theme-text-secondary font-bold uppercase tracking-wider">SPX / GOLD RATIO</span>
                    <h3 className="text-xl font-extrabold theme-text-primary mt-1 font-mono tracking-tight">
                      {latestSpxObj && latestGoldObj ? (latestSpxObj.price / latestGoldObj.price).toFixed(3) : "0.000"}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[9px] theme-text-muted font-mono">RATIO: Equity/Metal</span>
                    <span className="text-[9px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border theme-border font-bold font-mono">RATIO</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* About Tab View */}
          {activeTab === "about" ? (
            <div className="flex-grow theme-bg-card border theme-border rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-xl flex flex-col gap-6 transition-all duration-300 animate-fadeIn">
              <div>
                <h2 className="text-xl font-extrabold theme-text-primary tracking-wide">Eagle Eye Quantitative Engine</h2>
                <p className="text-xs theme-text-secondary mt-1 font-mono">Macroeconomic Forecasting & Risk Modeling for Global Assets</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
                {/* Support Band Doc */}
                <div className="bg-slate-950/60 theme-bg-secondary/60 border theme-border rounded-xl p-5 hover:border-emerald-500/20 transition-all duration-300">
                  <div className="text-emerald-400 mb-3 flex items-center gap-2 font-bold font-mono">
                    <TrendingUp size={18} />
                    <span>BULL MARKET SUPPORT BAND</span>
                  </div>
                  <p className="text-xs theme-text-secondary leading-relaxed mb-4">
                    The Bull Market Support Band represents a macro technical threshold computed using the convergence of the **20-Week Simple Moving Average (SMA)** and the **21-Week Exponential Moving Average (EMA)**.
                  </p>
                  <div className="bg-slate-900/60 border theme-border rounded-lg p-3 text-center mb-4">
                    <code className="text-emerald-400 font-mono text-xs">Band = [20W SMA, 21W EMA]</code>
                  </div>
                  <ul className="text-[11px] theme-text-muted space-y-2 list-disc pl-4 font-mono">
                    <li>Prices trading consistently above indicate a macro bullish expansion phase.</li>
                    <li>Prices testing the band from above often signal critical support retests.</li>
                    <li>A clean weekly close below triggers a transition to a bear market regime.</li>
                  </ul>
                </div>

                {/* Log Regression Doc */}
                <div className="bg-slate-950/60 theme-bg-secondary/60 border theme-border rounded-xl p-5 hover:border-yellow-500/20 transition-all duration-300">
                  <div className="text-yellow-400 mb-3 flex items-center gap-2 font-bold font-mono">
                    <Layers size={18} />
                    <span>LOGARITHMIC REGRESSION</span>
                  </div>
                  <p className="text-xs theme-text-secondary leading-relaxed mb-4">
                    Extrapolates long-term macroeconomic value by fitting historical daily closes against the elapsed time sequence from the genesis block anchor (January 3, 2009).
                  </p>
                  <div className="bg-slate-900/60 border theme-border rounded-lg p-3 text-center mb-4">
                    <code className="text-yellow-400 font-mono text-xs">log10(Price) = m · log10(Days) + c</code>
                  </div>
                  <ul className="text-[11px] theme-text-muted space-y-2 list-disc pl-4 font-mono">
                    <li><strong>Fit Parameters:</strong> m = 5.80162, c = -17.1121.</li>
                    <li>Scales standard deviation channels to represent "Non-Bubble Fit" (undervalued consolidation) up to "Bubble Peak" (highly speculative cycles).</li>
                    <li>Compensates for diminishing returns and volatility decay over multiple cycles.</li>
                  </ul>
                </div>

                {/* Risk Metric Doc */}
                <div className="bg-slate-950/60 theme-bg-secondary/60 border theme-border rounded-xl p-5 hover:border-blue-500/20 transition-all duration-300">
                  <div className="text-blue-400 mb-3 flex items-center gap-2 font-bold font-mono">
                    <Activity size={18} />
                    <span>QUANTITATIVE RISK SCORE</span>
                  </div>
                  <p className="text-xs theme-text-secondary leading-relaxed mb-4">
                    Calculates a normalized score between **0.00 and 1.00** by evaluating the logarithmic position of the active spot price relative to the lower accumulation boundary and upper speculative peak.
                  </p>
                  <div className="bg-slate-900/60 border theme-border rounded-lg p-3 text-center mb-4">
                    <code className="text-blue-400 font-mono text-[10px] break-all">
                      Risk = (ln(P) - ln(Bottom)) / (ln(Peak) - ln(Bottom))
                    </code>
                  </div>
                  <ul className="text-[11px] theme-text-muted space-y-2 list-disc pl-4 font-mono">
                    <li><strong>Risk &lt; 0.20 (Blue):</strong> Cycle bottoms and historical high-value accumulation windows.</li>
                    <li><strong>Risk 0.40 - 0.60 (Yellow):</strong> Neutral consolidation zone, typical in mid-cycle pauses.</li>
                    <li><strong>Risk &gt; 0.80 (Red):</strong> Extreme bubble extensions; signals optimal distribution windows.</li>
                  </ul>
                </div>
              </div>

              <div className="border-t theme-border pt-6 mt-2 flex flex-col md:flex-row gap-4 items-center justify-between text-xs theme-text-secondary font-mono">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={14} />
                  <span>Disclaimer: Not financial advice. Provided strictly for structural analysis.</span>
                </div>
                <span>Engine Version: 1.2.0-STABLE</span>
              </div>
            </div>
          ) : (
            /* Chart Canvas Container */
            <div className="flex-grow theme-bg-card border theme-border rounded-2xl p-4 md:p-5 min-h-fit flex flex-col justify-between backdrop-blur-md shadow-xl relative overflow-hidden transition-all duration-300">
              {loading && (
                <div className="absolute inset-0 bg-[#060913]/90 theme-bg-primary/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-50">
                  <Loader2 className="animate-spin theme-accent" size={32} />
                  <p className="text-[10px] font-mono tracking-widest theme-accent">
                    CALCULATING MATHEMATICAL COORDINATES...
                  </p>
                </div>
              )}

              {error && (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border border-dashed border-rose-900/40 bg-rose-950/5 rounded-xl m-4">
                  <ShieldAlert className="text-rose-500 mb-2 animate-bounce" size={36} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-200">
                    Data Pipeline Error
                  </h3>
                  <p className="text-xs theme-text-secondary mt-1">{error}</p>
                </div>
              )}

              {!loading && !error && (
                <div className="w-full h-full min-h-0 min-w-0 flex-grow flex flex-col justify-between relative">
                  {/* Top toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6 z-20">
                    <div>
                      <h2 className="text-sm font-bold theme-text-primary tracking-wide">
                        {getChartTitle()}
                      </h2>
                      <p className="text-[10px] theme-text-secondary font-mono mt-0.5">
                        Ticker: <span className="theme-accent font-bold uppercase">{activeTab}</span> • Interval: <span className="theme-text-primary">Weekly</span>
                      </p>
                    </div>

                    {/* Interactive Presets, Zoom & Slicers */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Projection Controls (Visible on log regression only) */}
                      {activeTab === "log-regression" && (
                        <div className="flex items-center gap-2 bg-slate-950/60 theme-bg-secondary border theme-border rounded-lg px-2.5 py-1">
                          <span className="text-[9px] font-mono theme-text-secondary font-bold uppercase">Forecast:</span>
                          <select
                            value={projectionYears}
                            onChange={(e) => setProjectionYears(Number(e.target.value))}
                            className="bg-transparent theme-text-primary text-xs font-mono font-bold border-none outline-none cursor-pointer focus:ring-0"
                          >
                            <option value={1} className="theme-bg-secondary">1 Year</option>
                            <option value={3} className="theme-bg-secondary">3 Years</option>
                            <option value={5} className="theme-bg-secondary">5 Years</option>
                            <option value={10} className="theme-bg-secondary">10 Years</option>
                          </select>
                        </div>
                      )}

                      {/* Timeframe Preset Selectors */}
                      <div className="flex items-center bg-slate-950/60 theme-bg-secondary border theme-border rounded-lg p-0.5">
                        <button
                          onClick={() => setPresetZoom(1)}
                          className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded transition-all ${
                            activeZoom === 1 ? "theme-accent bg-emerald-500/10" : "theme-text-secondary hover:theme-text-primary"
                          }`}
                        >
                          1Y
                        </button>
                        <button
                          onClick={() => setPresetZoom(3)}
                          className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded transition-all ${
                            activeZoom === 3 ? "theme-accent bg-emerald-500/10" : "theme-text-secondary hover:theme-text-primary"
                          }`}
                        >
                          3Y
                        </button>
                        <button
                          onClick={() => setPresetZoom(5)}
                          className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded transition-all ${
                            activeZoom === 5 ? "theme-accent bg-emerald-500/10" : "theme-text-secondary hover:theme-text-primary"
                          }`}
                        >
                          5Y
                        </button>
                        <button
                          onClick={() => setPresetZoom("all")}
                          className={`px-2.5 py-1 text-[9px] font-mono font-bold rounded transition-all ${
                            activeZoom === "all" ? "theme-accent bg-emerald-500/10" : "theme-text-secondary hover:theme-text-primary"
                          }`}
                        >
                          MAX
                        </button>
                      </div>

                      <button
                        onClick={() => setShowHalvingLines(!showHalvingLines)}
                        className={`flex items-center gap-1.5 text-[9px] font-mono font-bold px-3 py-1.5 rounded-lg border shadow-lg transition-all ${
                          showHalvingLines 
                            ? "theme-accent bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-extrabold shadow-[0_0_12px_rgba(16,185,129,0.2)]" 
                            : "bg-slate-950/80 theme-bg-secondary hover:theme-bg-primary theme-text-primary border-theme-border"
                        }`}
                      >
                        <Zap size={10} /> Halving Years
                      </button>

                      <button
                        onClick={clearZoomSelection}
                        className="flex items-center gap-1.5 bg-slate-950/80 theme-bg-secondary hover:theme-bg-primary theme-text-primary text-[9px] font-mono font-bold px-3 py-1.5 rounded-lg border theme-border shadow-lg transition-all"
                      >
                        <RefreshCw size={10} /> Reset Zoom
                      </button>
                    </div>
                  </div>

                  {/* Chart Container */}
                  <div className="flex-grow min-h-[300px] md:min-h-[420px] w-full relative">
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
                          <CartesianGrid strokeDasharray="3 3" stroke={currentThemeColors.grid} vertical={false} />
                          <XAxis
                            dataKey="date"
                            stroke={currentThemeColors.text}
                            tickMargin={10}
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatXAxis}
                            minTickGap={45}
                            ticks={activeXAxisTicks}
                          />
                          <YAxis
                            yAxisId="price"
                            stroke={currentThemeColors.text}
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
                            stroke={currentThemeColors.text}
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, 1.0]}
                            tickFormatter={(v) => v.toFixed(2)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: currentThemeColors.tooltipBg,
                              borderColor: currentThemeColors.tooltipBorder,
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
                          
                          {showHalvingLines && halvingDates.map(hd => (
                            <ReferenceLine
                              key={hd.date}
                              yAxisId="price"
                              x={hd.date}
                              stroke={theme === "cyberpunk" ? "#d946ef" : theme === "light" ? "#2563eb" : "#10b981"}
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{
                                value: hd.label,
                                position: "top",
                                fill: theme === "cyberpunk" ? "#d946ef" : theme === "light" ? "#2563eb" : "#10b981",
                                fontSize: 9,
                                fontFamily: "monospace",
                                fontWeight: "bold"
                              }}
                            />
                          ))}

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
                            stroke={currentThemeColors.secondaryLine}
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
                            stroke={currentThemeColors.text}
                            strokeWidth={1.5}
                            dot={false}
                            activeDot={<CustomRiskDot />}
                            connectNulls
                          />
                        </ComposedChart>
                       ) : (
                        <ComposedChart
                          data={filteredData}
                          margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
                          onMouseDown={(e) => e && setRefAreaLeft(e.activeLabel)}
                          onMouseMove={(e) => refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                          onMouseUp={handleZoomExecution}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={currentThemeColors.grid} vertical={false} />
                          <XAxis
                            dataKey="date"
                            stroke={currentThemeColors.text}
                            tickMargin={10}
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatXAxis}
                            minTickGap={45}
                            ticks={activeXAxisTicks}
                          />
                          <YAxis
                            yAxisId="main"
                            stroke={currentThemeColors.text}
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            scale={activeTab === "log-regression" ? "log" : "linear"}
                            domain={activeTab === "log-regression" ? [0.01, 1500000] : ["auto", "auto"]}
                            tickFormatter={(v) => {
                              if (activeCategory === "crypto") return formatCurrency(v);
                              return formatMacroValue(v, activeTab);
                            }}
                          />

                          {/* Dual-axis YAxis for BTC price when tracking Macro or TradFi assets */}
                          {activeCategory !== "crypto" && (
                            <YAxis
                              yAxisId="btc"
                              orientation="right"
                              stroke={currentThemeColors.priceLine}
                              fontSize={10}
                              axisLine={false}
                              tickLine={false}
                              scale="log"
                              domain={[0.01, 1500000]}
                              tickFormatter={formatCurrency}
                            />
                          )}

                          <Tooltip
                            contentStyle={{
                              backgroundColor: currentThemeColors.tooltipBg,
                              borderColor: currentThemeColors.tooltipBorder,
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
                              if (name === "BTC price overlay" || name === "Spot Price" || name === "Price") {
                                return [formatCurrency(value), name];
                              }
                              if (activeCategory === "crypto") {
                                return [formatCurrency(value), name];
                              }
                              return [formatMacroValue(value, activeTab), name];
                            }}
                          />

                          {showHalvingLines && halvingDates.map(hd => (
                            <ReferenceLine
                              key={hd.date}
                              yAxisId={activeCategory === "crypto" ? "main" : "btc"}
                              x={hd.date}
                              stroke={theme === "cyberpunk" ? "#d946ef" : theme === "light" ? "#2563eb" : "#10b981"}
                              strokeDasharray="4 4"
                              strokeWidth={1.5}
                              label={{
                                value: hd.label,
                                position: "top",
                                fill: theme === "cyberpunk" ? "#d946ef" : theme === "light" ? "#2563eb" : "#10b981",
                                fontSize: 9,
                                fontFamily: "monospace",
                                fontWeight: "bold"
                              }}
                            />
                          ))}

                          {refAreaLeft && refAreaRight && (
                            <ReferenceArea
                              yAxisId="main"
                              x1={refAreaLeft}
                              x2={refAreaRight}
                              strokeOpacity={0.3}
                              fill="#10b981"
                              fillOpacity={0.15}
                            />
                          )}

                          {/* --- DUAL AXIS BTC OVERLAY FOR MACRO & TRADFI --- */}
                          {activeCategory !== "crypto" && (
                            <Line
                              yAxisId="btc"
                              type="monotone"
                              dataKey="btcPrice"
                              name="BTC price overlay"
                              stroke={currentThemeColors.priceLine}
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                              connectNulls
                            />
                          )}

                          {/* --- SUPPORT BANDS VIEW CHANNEL --- */}
                          {activeTab === "support-band" && (
                            <>
                              <Line
                                yAxisId="main"
                                type="monotone"
                                dataKey="price"
                                name="Spot Price"
                                stroke={currentThemeColors.priceLine}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                                connectNulls
                              />
                              <Line
                                yAxisId="main"
                                type="monotone"
                                dataKey="sma20"
                                name="20-Week SMA"
                                stroke={currentThemeColors.primaryLine}
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="4 4"
                                connectNulls
                              />
                              <Line
                                yAxisId="main"
                                type="monotone"
                                dataKey="ema21"
                                name="21-Week EMA"
                                stroke={currentThemeColors.secondaryLine}
                                strokeWidth={1.5}
                                dot={false}
                                connectNulls
                              />
                            </>
                          )}

                          {/* --- REGRESSION CHANNELS VIEW CHANNEL --- */}
                          {activeTab === "log-regression" && visibility.bubbleUpper && (
                            <Line
                              yAxisId="main"
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
                              yAxisId="main"
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
                              yAxisId="main"
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
                              yAxisId="main"
                              type="monotone"
                              dataKey="nonBubbleFit"
                              name="Non-Bubble Fit"
                              stroke={currentThemeColors.primaryLine}
                              strokeWidth={1.8}
                              strokeDasharray="4 4"
                              dot={false}
                              connectNulls={true}
                            />
                          )}
                          {activeTab === "log-regression" && visibility.nonBubbleLower && (
                            <Line
                              yAxisId="main"
                              type="monotone"
                              dataKey="nonBubbleLower"
                              name="Non-Bubble Lower"
                              stroke={currentThemeColors.secondaryLine}
                              strokeWidth={1.2}
                              strokeOpacity={0.7}
                              dot={false}
                              connectNulls={true}
                            />
                          )}
                          {activeTab === "log-regression" && visibility.price && (
                            <Line
                              yAxisId="main"
                              type="monotone"
                              dataKey="price"
                              name="Price"
                              stroke={currentThemeColors.priceLine}
                              strokeWidth={2.5}
                              dot={false}
                              connectNulls={true}
                            />
                          )}

                          {/* --- MACRO / TRADFI GENERAL LINE PLOTS --- */}
                          {["dxy", "cpi", "fed-rate", "spx", "gold", "us10y"].includes(activeTab) && (
                            <Line
                              yAxisId="main"
                              type="monotone"
                              dataKey="price"
                              name={getChartTitle().split(":")[0]}
                              stroke={currentThemeColors.primaryLine}
                              strokeWidth={2.5}
                              dot={false}
                              connectNulls
                            />
                          )}
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Toggle Controls for Log Regression */}
                  {activeTab === "log-regression" && (
                    <div className="flex flex-wrap justify-center items-center gap-2 mt-4 border-t theme-border pt-3 flex-shrink-0 z-20">
                      <button
                        onClick={handleToggleAllChannels}
                        className="text-[9px] font-mono font-bold px-2.5 py-1.5 rounded-lg border theme-border bg-[#090d19]/80 hover:bg-slate-800 text-slate-300 transition-all font-mono"
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
