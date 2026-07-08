import os
import time

import pandas as pd
import requests


def download_historical_seed():
    """
    Executes a professional-grade database bootstrap. Stitches the official
    Blockchain.com macro history (2010-2014) with high-density Yahoo OHLC data
    (2014-Present) to create a flawless, un-deletable local storage base.
    """
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, "bitcoin_historical_daily.csv")

    if os.path.exists(csv_path):
        os.remove(csv_path)

    print(
        "[*] Launching Tier 1 Pipeline: Extracting official 2010-2014 historical closing data..."
    )
    blockchain_url = (
        "https://api.blockchain.info/charts/market-price?timespan=all&format=json"
    )
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        # Fetching early data directly from the network indexer
        bc_res = requests.get(blockchain_url, headers=headers, timeout=15)
        bc_res.raise_for_status()
        bc_values = bc_res.json().get("values", [])

        early_records = []
        for pt in bc_values:
            pt_date = pd.to_datetime(pt["x"], unit="s")
            # Isolate the pre-Yahoo era (before September 17, 2014)
            if pt_date < pd.to_datetime("2014-09-17") and pt["y"] > 0:
                early_records.append(
                    {
                        "date": pt_date.strftime("%Y-%m-%d"),
                        "open": pt["y"],
                        "high": pt["y"],
                        "low": pt["y"],
                        "close": pt["y"],
                    }
                )
        early_df = pd.DataFrame(early_records)
        print(
            f"[+] Tier 1 Sync Complete: Captured {len(early_df)} daily blocks starting from {early_df['date'].min()}"
        )

        print(
            "[*] Launching Tier 2 Pipeline: Fetching high-density daily OHLC candles (2014-Present)..."
        )
        period1 = 1410912000  # Sept 17, 2014
        period2 = int(time.time())
        yahoo_url = f"https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD?period1={period1}&period2={period2}&interval=1d"

        y_res = requests.get(yahoo_url, headers=headers, timeout=15)
        y_res.raise_for_status()
        json_data = y_res.json()["chart"]["result"][0]

        modern_df = pd.DataFrame(
            {
                "date": pd.to_datetime(json_data["timestamp"], unit="s").strftime(
                    "%Y-%m-%d"
                ),
                "open": json_data["indicators"]["quote"][0]["open"],
                "high": json_data["indicators"]["quote"][0]["high"],
                "low": json_data["indicators"]["quote"][0]["low"],
                "close": json_data["indicators"]["quote"][0]["close"],
            }
        )
        modern_df = modern_df.dropna().copy()
        print(
            f"[+] Tier 2 Sync Complete: Captured {len(modern_df)} high-fidelity OHLC market candles."
        )

        # Matrix Unification
        print("[*] Unifying tiers into a synchronized macroeconomic database...")
        master_df = pd.concat([early_df, modern_df], ignore_index=True)
        master_df = master_df.drop_duplicates(subset=["date"])
        master_df = master_df.sort_values("date").reset_index(drop=True)

        # Write clean data matrix to disk vault
        master_df.to_csv(csv_path, index=False)
        print(f"\n[+] Master Database Built Successfully!")
        print(f"    - Destination: {csv_path}")
        print(f"    - Total Chronological Rows: {len(master_df)}")
        print(
            f"    - Unbroken Timeline Span: {master_df['date'].min()} to {master_df['date'].max()}"
        )

    except Exception as e:
        print(f"[-] Data pipeline initialization failed: {str(e)}")


if __name__ == "__main__":
    download_historical_seed()
