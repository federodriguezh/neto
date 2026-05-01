#!/usr/bin/env python3
"""Fetch SPY historical adjusted close prices and save to public/data/spy.json."""

import json
import os

try:
    import yfinance as yf
except ImportError:
    print("yfinance is not installed. Install it with: pip install yfinance")
    raise


def main():
    os.makedirs("public/data", exist_ok=True)

    print("Fetching SPY history...")
    spy = yf.Ticker("SPY")
    hist = spy.history(period="max")

    data = []
    for date, row in hist.iterrows():
        adj_close = row.get("Adj Close")
        if adj_close is not None and not (adj_close != adj_close):  # NaN check
            data.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "adjClose": round(float(adj_close), 4),
                }
            )

    output_path = "public/data/spy.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(data)} SPY bars to {output_path}")


if __name__ == "__main__":
    main()
