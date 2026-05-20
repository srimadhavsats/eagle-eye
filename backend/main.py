import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Eagle Eye API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# --- ENDPOINT 1: MARKET SUPPORT BANDS ---
@app.get("/api/support-band")
def get_support_band():
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

        # Immediate conversion to weekly intervals to drop sparse historical anomalies
        df_weekly = df.resample("W", on="date").last().reset_index()
        df_weekly = df_weekly.dropna(subset=["close"]).copy()

        df_weekly["sma_20"] = df_weekly["close"].rolling(window=20).mean()
        df_weekly["ema_21"] = df_weekly["close"].ewm(span=21, adjust=False).mean()

        chart_data = []
        for _, row in df_weekly.iterrows():
            chart_data.append(
                {
                    "date": row["date"].strftime("%Y-%m-%d"),
                    "price": safe_float(row["close"]),
                    "sma20": safe_float(row["sma_20"]),
                    "ema21": safe_float(row["ema_21"]),
                }
            )

        return {"status": "success", "asset": "BTC-USD", "data": chart_data}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- ENDPOINT 2: LOGARITHMIC REGRESSION BANDS ---
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

        # 1. Clean data sequence on weekly compression scales to eliminate gaps
        df_weekly = df.resample("W", on="date").last().reset_index()
        df_weekly = df_weekly.dropna(subset=["close"]).copy()
        df_weekly["index_seq"] = df_weekly.index + 1

        # 2. Extract technical parameters on contiguous weekly blocks
        log_x = np.log(df_weekly["index_seq"])
        log_y = np.log(df_weekly["close"])
        m, c = np.polyfit(log_x, log_y, 1)

        # 3. Formulate exactly 3 years of future weekly projection points
        last_historical_date = df_weekly["date"].max()
        future_dates = pd.date_range(
            start=last_historical_date + pd.Timedelta(weeks=1), periods=52 * 3, freq="W"
        )
        future_df = pd.DataFrame({"date": future_dates, "close": np.nan})

        # 4. Unify data matrices into an unbroken time-series layout
        extended_df = pd.concat([df_weekly, future_df], ignore_index=True)
        extended_df["index_seq"] = extended_df.index + 1

        # 5. Populate bands completely across the entire layout matrix
        extended_df["fair_value"] = np.exp(c) * (extended_df["index_seq"] ** m)
        extended_df["accumulation_bottom"] = np.exp(c - 0.45) * (
            extended_df["index_seq"] ** m
        )
        extended_df["overvalued_peak"] = np.exp(c + 0.55) * (
            extended_df["index_seq"] ** m
        )

        payload = []
        for _, row in extended_df.iterrows():
            payload.append(
                {
                    "date": row["date"].strftime("%Y-%m-%d"),
                    "price": safe_float(row["close"]),
                    "fair_value": safe_float(row["fair_value"]),
                    "lower_band": safe_float(row["accumulation_bottom"]),
                    "upper_band": safe_float(row["overvalued_peak"]),
                }
            )

        return {"status": "success", "asset": "BTC-USD", "data": payload}

    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- ENDPOINT 3: QUANTITATIVE RISK DISTRIBUTION ---
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

        df_weekly = df.resample("W", on="date").last().reset_index()
        df_weekly = df_weekly.dropna(subset=["close"]).copy()
        df_weekly["index_seq"] = df_weekly.index + 1

        log_x = np.log(df_weekly["index_seq"])
        log_y = np.log(df_weekly["close"])
        m, c = np.polyfit(log_x, log_y, 1)

        df_weekly["bottom"] = np.exp(c - 0.45) * (df_weekly["index_seq"] ** m)
        df_weekly["peak"] = np.exp(c + 0.55) * (df_weekly["index_seq"] ** m)

        log_price = np.log(df_weekly["close"])
        log_bottom = np.log(df_weekly["bottom"])
        log_peak = np.log(df_weekly["peak"])

        df_weekly["risk"] = (log_price - log_bottom) / (log_peak - log_bottom)
        df_weekly["risk"] = np.clip(df_weekly["risk"], 0.0, 1.0)

        payload = []
        for _, row in df_weekly.iterrows():
            payload.append(
                {
                    "date": row["date"].strftime("%Y-%m-%d"),
                    "price": safe_float(row["close"]),
                    "risk": safe_float(row["risk"], decimals=4),
                }
            )

        return {"status": "success", "asset": "BTC-USD", "data": payload}

    except Exception as e:
        return {"status": "error", "message": str(e)}
