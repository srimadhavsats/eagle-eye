import os
import pytest
import pandas as pd
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Import the FastAPI app directly from main
import main
from main import app

# Initialize the TestClient
client = TestClient(app)


@pytest.fixture(scope="module")
def sample_data_csv(tmp_path_factory):
    """
    Fixture to generate a mock historical daily CSV dataset.
    Generates enough daily rows (250+ days, ~35 weeks) to make sure Resampling and 
    rolling calculations (like 20W SMA) succeed without NaN/empty arrays.
    """
    temp_dir = tmp_path_factory.mktemp("data")
    temp_csv = temp_dir / "test_bitcoin_historical_daily.csv"
    
    # Generate daily chronological index spanning 35 weeks
    start_date = datetime(2025, 1, 1)
    date_list = [start_date + timedelta(days=x) for x in range(250)]
    
    # Generate a realistic upward trending price curve starting from $50,000
    base_price = 50000.0
    records = []
    for i, dt in enumerate(date_list):
        close_p = base_price + (i * 80.0)
        records.append({
            "date": dt.strftime("%Y-%m-%d"),
            "open": close_p - 100.0,
            "high": close_p + 200.0,
            "low": close_p - 200.0,
            "close": close_p
        })
        
    df = pd.DataFrame(records)
    df.to_csv(temp_csv, index=False)
    return str(temp_csv)


@pytest.fixture(autouse=True)
def setup_test_environment(sample_data_csv):
    """
    Automatically patches main.CSV_PATH and mocks outgoing network requests for all tests.
    This ensures tests are fast, clean, and never touch the live data files or external APIs.
    """
    # Create mock response for Yahoo Finance chart endpoint
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "chart": {
            "result": [
                {
                    "timestamp": [int(datetime.utcnow().timestamp())],
                    "indicators": {
                        "quote": [
                            {
                                "open": [70000.0],
                                "high": [71000.0],
                                "low": [69000.0],
                                "close": [70500.0]
                            }
                        ]
                    }
                }
            ]
        }
    }
    
    # Apply patches
    with patch("main.CSV_PATH", sample_data_csv), \
         patch("requests.get", return_value=mock_response):
        yield


def test_root_endpoint():
    """
    I want to verify that the root endpoint is online and returns the welcome message.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Eagle Eye Backend Radar is Active"}


def test_system_status():
    """
    Verifies that `/api/status` reads my mock database correctly and reports healthy status.
    """
    response = client.get("/api/status")
    assert response.status_code == 200
    
    payload = response.json()
    assert payload["status"] == "HEALTHY"
    assert "database" in payload
    assert payload["database"]["total_records"] == 250
    assert payload["database"]["last_synchronized_record"] == "2025-09-07"


def test_support_band_endpoint():
    """
    Tests that the Bull Market Support Band endpoint returns valid data
    and rolling averages (SMA 20 and EMA 21) are successfully computed.
    """
    response = client.get("/api/support-band")
    assert response.status_code == 200
    
    payload = response.json()
    assert payload["status"] == "success"
    assert "data" in payload
    
    data = payload["data"]
    assert len(data) > 0
    
    # Check that our rolling stats contain non-null entries for recent weeks
    last_entry = data[-1]
    assert "date" in last_entry
    assert last_entry["price"] is not None
    assert last_entry["sma20"] is not None
    assert last_entry["ema21"] is not None


def test_log_regression_endpoint():
    """
    Validates that the log regression model works and projections are generated.
    """
    # Test default projection (3 years)
    response = client.get("/api/log-regression")
    assert response.status_code == 200
    
    payload = response.json()
    assert payload["status"] == "success"
    
    data = payload["data"]
    assert len(data) > 0
    
    # Confirm structure of regression channels
    first_row = data[0]
    required_keys = ["date", "price", "nonBubbleLower", "nonBubbleFit", "nonBubbleUpper", "bubbleLower", "bubbleUpper"]
    for key in required_keys:
        assert key in first_row
        
    # Verify that passing custom projection years returns valid responses
    response_5y = client.get("/api/log-regression?projection_years=5")
    assert response_5y.status_code == 200
    assert len(response_5y.json()["data"]) > len(data)


def test_log_regression_validation():
    """
    Checks that input validation bounds (ge=1, le=10) prevent incorrect projection ranges.
    """
    # Under range limit
    response_low = client.get("/api/log-regression?projection_years=0")
    assert response_low.status_code == 422
    
    # Over range limit
    response_high = client.get("/api/log-regression?projection_years=11")
    assert response_high.status_code == 422


def test_risk_metric_endpoint():
    """
    Tests the quantitative risk scoring logic and ensures all risk outputs are bounds-clipped [0, 1].
    """
    response = client.get("/api/risk-metric")
    assert response.status_code == 200
    
    payload = response.json()
    assert payload["status"] == "success"
    
    data = payload["data"]
    assert len(data) > 0
    
    # Verify the normalized risk bounds
    for entry in data:
        assert "risk" in entry
        risk_val = entry["risk"]
        assert 0.0 <= risk_val <= 1.0


def test_mempool_fees_endpoint():
    """
    Tests that /api/mempool-fees returns correct structure by mocking the Mempool.space responses.
    """
    def side_effect(url, *args, **kwargs):
        resp = MagicMock()
        resp.status_code = 200
        if "fees/recommended" in url:
            resp.json.return_value = {
                "fastestFee": 15,
                "halfHourFee": 12,
                "hourFee": 10,
                "economyFee": 5,
                "minimumFee": 1
            }
        elif "mempool" in url:
            resp.json.return_value = {
                "count": 15000,
                "vsize": 35000000,
                "total_fee": 125000000
            }
        return resp
        
    with patch("requests.get", side_effect=side_effect):
        response = client.get("/api/mempool-fees")
        assert response.status_code == 200
        payload = response.json()
        assert payload["recommended"]["fastestFee"] == 15
        assert payload["mempool"]["count"] == 15000


def test_mempool_fees_historical_endpoint():
    """
    Tests that /api/mempool-fees-historical returns mock block fee distributions.
    """
    mock_blocks = [
        {
            "timestamp": 1718000000,
            "avgFee_90": 20,
            "avgFee_50": 10,
            "avgFee_10": 2
        }
    ]
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = mock_blocks
    
    with patch("requests.get", return_value=mock_response):
        response = client.get("/api/mempool-fees-historical?period=24h")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "success"
        data = payload["data"]
        assert len(data) == 1
        assert data[0]["avgFee_50"] == 10


