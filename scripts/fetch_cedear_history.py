#!/usr/bin/env python3
"""Fetch CEDEAR historical prices from yfinance and save as static JSON files."""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import requests
import yfinance as yf

DATA912_LIVE_URL = "https://data912.com/live/arg_cedears"
OUTPUT_DIR = Path("public/data/cedears")


def fetch_data912_symbols() -> list[str]:
    """Fetch the current list of CEDEAR symbols from data912."""
    response = requests.get(DATA912_LIVE_URL, timeout=30)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError(f"Expected list from data912, got {type(data)}")
    symbols = [item["symbol"] for item in data if isinstance(item, dict) and "symbol" in item]
    return sorted(set(symbols))


def fetch_yahoo_history(symbol: str) -> list[dict]:
    """Fetch historical bars for a CEDEAR from yfinance.

    Tries fallback periods for newly listed tickers that don't yet
    support 'max' daily granularity.
    """
    ticker = yf.Ticker(f"{symbol}.BA")
    for period in ("max", "5d", "1d"):
        hist = ticker.history(period=period)
        if not hist.empty:
            bars = []
            for date, row in hist.iterrows():
                bars.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "open": round(float(row["Open"]), 2),
                    "close": round(float(row["Close"]), 2),
                })
            return bars
    return []


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching symbol list from data912...")
    symbols = fetch_data912_symbols()
    print(f"Found {len(symbols)} CEDEAR symbols")

    updated = 0
    skipped = 0
    failed = 0

    for symbol in symbols:
        output_path = OUTPUT_DIR / f"{symbol}.json"

        try:
            history = fetch_yahoo_history(symbol)
        except Exception as e:
            print(f"  FAIL {symbol}: {e}")
            failed += 1
            continue

        if not history:
            print(f"  SKIP {symbol}: no data from yfinance")
            skipped += 1
            continue

        new_content = json.dumps(history, indent=2)

        if output_path.exists():
            old_content = output_path.read_text()
            if old_content == new_content:
                print(f"  SAME {symbol}")
                continue

        output_path.write_text(new_content)
        print(f"  SAVE {symbol} ({len(history)} days)")
        updated += 1

    print(f"\nDone: {updated} updated, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
