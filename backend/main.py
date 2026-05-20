import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Eagle Eye API")

# Enable CORS for React frontend to communicate with it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Robust Type-Defensive Parser to prevent runtime crashes
def safe_float(val, decimals=2):
    if pd.isna(val) or val is None:
        return None
    try:
        return round(float(val), decimals)
    except (ValueError, TypeError):
        return None


@app.get("/")
def read_root():
    return {"message": "Eagle Eye Backend Radar is Active"}


# --- ENDPOINT 1: BULL MARKET SUPPORT BAND ---
@app.get("/api/support-band")
def get_support_band():
    # Upgrade data pipeline query range from 5y to max for comprehensive coverage
    url = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=max"
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        json_data = res.json()

        result = json_data["chart"]["result"][0]
        timestamps = result["timestamp"]
        closes = result["indicators"]["quote"][0]["close"]

        df = pd.DataFrame({"timestamp": timestamps, "close": closes})
        df["date"] = pd.to_datetime(df["timestamp"], unit="s")
        df = df.dropna().copy()

        df_weekly = df.resample("W", on="date").last().reset_index()
        df_weekly = df_weekly.dropna(subset=["close"]).copy()

        # Calculate moving averages across the extended historical time-series layout
        df_weekly["sma_20"] = df_weekly["close"].rolling(window=20).mean()
        df_weekly["ema_21"] = df_weekly["close"].ewm(span=21, adjust=False).mean()

        chart_data = []
        for _, row in df_weekly.iterrows():
            date_str = (
                row["date"].strftime("%Y-%m-%d") if not pd.isna(row["date"]) else ""
            )
            if not date_str:
                continue
            chart_data.append(
                {
                    "date": date_str,
                    "price": safe_float(row["close"]),
                    "sma20": safe_float(row["sma_20"]),
                    "ema21": safe_float(row["ema_21"]),
                }
            )

        return {"status": "success", "asset": "BTC-USD", "data": chart_data}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- ENDPOINT 2: LOGARITHMIC REGRESSION BANDS WITH FUTURE PROJECTIONS ---
@app.get("/api/log-regression")
def get_log_regression():
    url = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=max"
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        json_data = res.json()

        result = json_data["chart"]["result"][0]
        timestamps = result["timestamp"]
        closes = result["indicators"]["quote"][0]["close"]

        df = pd.DataFrame({"timestamp": timestamps, "close": closes})
        df["date"] = pd.to_datetime(df["timestamp"], unit="s")
        df = df.dropna().copy()
        df = df.sort_values("date").reset_index(drop=True)
        df["index_days"] = df.index + 1

        # 1. Calculate the quantitative regression coefficients strictly on historical data
        log_x = np.log(df["index_days"])
        log_y = np.log(df["close"])
        m, c = np.polyfit(log_x, log_y, 1)

        # 2. Mathematical Extension: Generate 3 years of future daily timeline rows
        last_historical_date = df["date"].max()
        future_dates = pd.date_range(
            start=last_historical_date + pd.Timedelta(days=1), periods=365 * 3, freq="D"
        )
        future_df = pd.DataFrame({"date": future_dates})
        future_df["close"] = (
            np.nan
        )  # Future price is unknown, leaving as NaN so the line stops

        # 3. Concatenate historical data with the empty future matrix
        extended_df = pd.concat([df, future_df], ignore_index=True)
        extended_df["index_days"] = (
            extended_df.index + 1
        )  # Continue the day count smoothly

        # 4. Extrapolate values across the entire extended timeline using historical coefficients
        extended_df["fair_value"] = np.exp(c) * (extended_df["index_days"] ** m)
        extended_df["accumulation_bottom"] = np.exp(c - 0.45) * (
            extended_df["index_days"] ** m
        )
        extended_df["overvalued_peak"] = np.exp(c + 0.55) * (
            extended_df["index_days"] ** m
        )

        # 5. Downsample to weekly intervals to keep rendering performant
        df_weekly = extended_df.resample("W", on="date").last().reset_index()

        payload = []
        for _, row in df_weekly.iterrows():
            payload.append(
                {
                    "date": row["date"].strftime("%Y-%m-%d"),
                    "price": safe_float(
                        row["close"]
                    ),  # Returns null for future rows automatically
                    "fair_value": safe_float(row["fair_value"]),
                    "lower_band": safe_float(row["accumulation_bottom"]),
                    "upper_band": safe_float(row["overvalued_peak"]),
                }
            )

        return {"status": "success", "asset": "BTC-USD", "data": payload}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- ENDPOINT 3: QUANTITATIVE RISK METRIC ENGINE ---
@app.get("/api/risk-metric")
def get_risk_metric():
    url = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=max"
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        json_data = res.json()

        result = json_data["chart"]["result"][0]
        timestamps = result["timestamp"]
        closes = result["indicators"]["quote"][0]["close"]

        df = pd.DataFrame({"timestamp": timestamps, "close": closes})
        df["date"] = pd.to_datetime(df["timestamp"], unit="s")
        df = df.dropna().copy()

        df = df.sort_values("date").reset_index(drop=True)
        df["index_days"] = df.index + 1

        # Calculate regression bands to determine boundary extremes
        log_x = np.log(df["index_days"])
        log_y = np.log(df["close"])
        m, c = np.polyfit(log_x, log_y, 1)

        df["bottom"] = np.exp(c - 0.45) * (df["index_days"] ** m)
        df["peak"] = np.exp(c + 0.55) * (df["index_days"] ** m)

        # Risk Formula: Position of price between bottom (0) and peak (1) in logarithmic space
        log_price = np.log(df["close"])
        log_bottom = np.log(df["bottom"])
        log_peak = np.log(df["peak"])

        df["risk"] = (log_price - log_bottom) / (log_peak - log_bottom)
        df["risk"] = np.clip(
            df["risk"], 0.0, 1.0
        )  # Keep bounded tightly between 0 and 1

        df_weekly = df.resample("W", on="date").last().reset_index()
        df_weekly = df_weekly.dropna(subset=["close"]).copy()

        payload = []
        for _, row in df_weekly.iterrows():
            payload.append(
                {
                    "date": row["date"].strftime("%Y-%m-%d"),
                    "price": safe_float(row["close"]),
                    "risk": safe_float(
                        row["risk"], decimals=4
                    ),  # Higher precision decimal for gradients
                }
            )

        return {"status": "success", "asset": "BTC-USD", "data": payload}

    except Exception as e:
        return {"status": "error", "message": str(e)}
