import os
from datetime import datetime

import numpy as np
import pandas as pd
import requests
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Eagle Eye Quantitative Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = os.path.join(
    os.path.dirname(__file__), "data", "bitcoin_historical_daily.csv"
)
GENESIS_DATE = pd.to_datetime("2009-01-03")


def safe_float(val, decimals=2):
    if pd.isna(val) or val is None:
        return None
    try:
        float_val = float(val)
        if float_val > 0 and round(float_val, decimals) == 0:
            return round(float_val, 6)
        return round(float_val, decimals)
    except (ValueError, TypeError):
        return None


def get_synchronized_dataset():
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError("Core static database sheet missing.")
    df = pd.read_csv(CSV_PATH)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    last_cached_date = df["date"].max()
    today_date = pd.to_datetime(datetime.utcnow().date())
    days_delta = (today_date - last_cached_date).days

    if days_delta > 0:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?interval=1d&range=7d"
        headers = {"User-Agent": "Mozilla/5.0"}
        try:
            res = requests.get(url, headers=headers, timeout=10)
            res.raise_for_status()
            json_data = res.json()["chart"]["result"][0]
            timestamps = json_data["timestamp"]
            ohlc = json_data["indicators"]["quote"][0]

            patch_df = pd.DataFrame(
                {
                    "date": pd.to_datetime(timestamps, unit="s").strftime("%Y-%m-%d"),
                    "open": ohlc["open"],
                    "high": ohlc["high"],
                    "low": ohlc["low"],
                    "close": ohlc["close"],
                }
            )
            patch_df["date"] = pd.to_datetime(patch_df["date"])
            new_rows = patch_df[patch_df["date"] > last_cached_date].dropna().copy()

            if not new_rows.empty:
                new_rows_csv = new_rows.copy()
                new_rows_csv["date"] = new_rows_csv["date"].dt.strftime("%Y-%m-%d")
                new_rows_csv.to_csv(CSV_PATH, mode="a", header=False, index=False)
                df = pd.concat([df, new_rows], ignore_index=True)
        except Exception as e:
            print(f"[*] Live sync delta bypass: {str(e)}")

    return df


@app.get("/")
def read_root():
    return {"message": "Eagle Eye Backend Radar is Active"}


@app.get("/api/status")
def get_system_status():
    try:
        df = pd.read_csv(CSV_PATH)
        return {
            "status": "HEALTHY",
            "database": {
                "total_records": len(df),
                "last_synchronized_record": str(df["date"].iloc[-1]),
            },
        }
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}


@app.get("/api/support-band")
def get_support_band():
    try:
        df_daily = get_synchronized_dataset()
        actual_last_date = df_daily["date"].max()

        df_weekly = (
            df_daily.resample("W", on="date")
            .last()
            .reset_index()
            .dropna(subset=["close"])
            .copy()
        )
        if not df_weekly.empty:
            df_weekly.iloc[-1, df_weekly.columns.get_loc("date")] = actual_last_date

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
        return {"status": "success", "data": chart_data}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/log-regression")
def get_log_regression(projection_years: int = Query(default=3, ge=1, le=10)):
    try:
        df_daily = get_synchronized_dataset()
        actual_last_date = df_daily["date"].max()

        df_weekly = (
            df_daily.resample("W", on="date")
            .last()
            .reset_index()
            .dropna(subset=["close"])
            .copy()
        )
        if not df_weekly.empty:
            df_weekly.iloc[-1, df_weekly.columns.get_loc("date")] = actual_last_date

        total_future_weeks = int(projection_years * 52)
        future_dates = pd.date_range(
            start=actual_last_date + pd.Timedelta(weeks=1),
            periods=total_future_weeks,
            freq="W",
        )
        future_df = pd.DataFrame({"date": future_dates, "close": np.nan})

        extended_df = pd.concat([df_weekly, future_df], ignore_index=True)
        extended_df["days_seq"] = (extended_df["date"] - GENESIS_DATE).dt.days

        # Core mathematical slope and intercept parameters for the logarithmic trend line
        m = 5.80162
        c = -17.1121

        log10_x = np.log10(extended_df["days_seq"])
        base_fit = 10 ** (m * log10_x + c)

        # Scaled band distributions matching the dashboard layout ratios
        extended_df["non_bubble_lower"] = base_fit * 0.69819
        extended_df["non_bubble_fit"] = base_fit * 1.00000
        extended_df["non_bubble_upper"] = base_fit * 1.21731
        extended_df["bubble_lower"] = base_fit * 1.67845
        extended_df["bubble_upper"] = base_fit * 2.80932

        payload = []
        for _, row in extended_df.iterrows():
            payload.append(
                {
                    "date": row["date"].strftime("%Y-%m-%d"),
                    "price": safe_float(row["close"]),
                    "nonBubbleLower": safe_float(row["non_bubble_lower"], decimals=2),
                    "nonBubbleFit": safe_float(row["non_bubble_fit"], decimals=2),
                    "nonBubbleUpper": safe_float(row["non_bubble_upper"], decimals=2),
                    "bubbleLower": safe_float(row["bubble_lower"], decimals=2),
                    "bubbleUpper": safe_float(row["bubble_upper"], decimals=2),
                }
            )
        return {"status": "success", "data": payload}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/risk-metric")
def get_risk_metric():
    try:
        df_daily = get_synchronized_dataset()
        actual_last_date = df_daily["date"].max()

        df_weekly = (
            df_daily.resample("W", on="date")
            .last()
            .reset_index()
            .dropna(subset=["close"])
            .copy()
        )
        if not df_weekly.empty:
            df_weekly.iloc[-1, df_weekly.columns.get_loc("date")] = actual_last_date

        df_weekly["days_seq"] = (df_weekly["date"] - GENESIS_DATE).dt.days

        m = 5.80162
        c = -17.1121
        log10_x = np.log10(df_weekly["days_seq"])
        base_fit = 10 ** (m * log10_x + c)

        df_weekly["lower_band"] = base_fit * 0.69819
        df_weekly["upper_band"] = base_fit * 2.80932

        log_price = np.log(df_weekly["close"])
        log_bottom = np.log(df_weekly["lower_band"])
        log_peak = np.log(df_weekly["upper_band"])

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
        return {"status": "success", "data": payload}
    except Exception as e:
        return {"status": "error", "message": str(e)}
