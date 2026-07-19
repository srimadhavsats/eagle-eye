# Eagle Eye - Macro Crypto Intelligence Hub

An advanced quantitative analytics platform designed to model, visualize, and forecast long-term macroeconomic trends for digital assets. The architecture couples a high-performance Python FastAPI engine with a responsive, glassmorphic React interface to deliver interactive charting and indicators.

---

## 🛠️ Key Engineering Features

* **Top-Tier Diagnostic Panel**: Displays real-time calculations from the latest daily sync—spot price, Bull Market Support Band status (`SUPPORT HELD` / `BEARISH REGIME`), quantitative risk level, and log regression channel position.
* **Composed Risk Metric Overlay**: Renders spot price curves color-coded by macro risk alongside a secondary Y-axis area chart illustrating normalized risk metrics (0.00 to 1.00) using custom gradient shading.
* **Bull Market Support Band**: Dynamic weekly averages plotting the 20-Week Simple Moving Average (SMA) and 21-Week Exponential Moving Average (EMA) to identify cycle support thresholds.
* **Logarithmic Regression Bands**: Extrapolates standard deviation bands from genesis to model diminishing returns and volatility decay over multiple cycles, featuring lookahead projection controls.
* **Bitcoin Halving Countdown**: Renders a high-tech countdown timer estimating the 5th Bitcoin block reward halving event, coupled with an interactive progress bar showing current block height (from genesis/4th halving) and percentage completed towards block 1,050,000.
* **Macroeconomic & TradFi Correlation Indices**: Incorporates a rich suite of external benchmarks—including the US Dollar Index (DXY), Inflation (CPI YoY %), Federal Funds Interest Rate, US 10-Year Treasury Yield, S&P 500 Equity Index, and Gold Spot Market—to evaluate macroeconomic correlations.
* **Bitcoin Transaction Fee (Gas) Tracker**: Renders real-time recommended priority fee levels (High, Medium, Low, Economy, and Minimum Relay) in sat/vB along with dynamic fiat cost estimations for different transaction types (Taproot, Native SegWit, Nested SegWit, and Legacy). Incorporates live mempool congestion metrics (backlog in blocks, pending transaction count, total vsize, and memory usage capacity) and an interactive historical fee rate chart featuring 90th, 50th, and 10th percentile block trends.
* **On-Chain Valuation Models**: Incorporates quantitative on-chain proxies mathematically derived from historical asset behavior. Provides dynamic models and interactive visualizations for MVRV Z-Score (Market vs Realized Value), Net Unrealized Profit/Loss (NUPL), and the Puell Multiple to pinpoint cycle extremes and accumulation zones.
* **Premium Multi-Theme Workspace**: Fully supports dynamic theme-switching with custom-tailored visual palettes: **Slate Cyber** (default neon dark), **Light Terminal** (clean light mode), and **Neon Horizon** (vibrant cyberpunk contrast).
* **High-Fidelity Interactive Charts**: Built on top of Recharts, allowing mouse-drag area zoom-in, custom zoom preset selections (1Y, 3Y, 5Y, All), and toggle visibility for individual regression channels.
* **Automated CI/CD Deployment**: Complete GitHub Actions workflow that executes security audits on the backend using `bandit` and compiles and deploys the frontend bundle directly to GitHub Pages.

---

## 💻 Technology Stack

* **Backend Engine**: Python, FastAPI, Pandas, NumPy, Uvicorn, Bandit (security scanning)
* **Frontend Interface**: React, Vite, Tailwind CSS, Recharts, Lucide Icons, Plus Jakarta Sans & JetBrains Mono typography
* **Data Sources**: Public time-series and network status APIs (Yahoo Finance, Blockchain.com, and Mempool.space)

---

## 🚀 Local Installation & Execution

### 1. Start the Backend
Navigate to the `backend/` directory, set up the virtual environment, install dependencies, and start the development server:
```bash
cd backend
# Create virtual environment if needed: python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --port 8000 --reload
```

### 2. Start the Frontend
Navigate to the `frontend/` directory, install Node modules, and launch the Vite development server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://127.0.0.1:5173/eagle-eye/` in your browser.
