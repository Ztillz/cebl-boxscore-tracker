import json
import pandas as pd
import requests
from pathlib import Path

GAME_ID = "2798717"  # change this
URL = f"https://fibalivestats.dcd.shared.geniussports.com/data/{GAME_ID}/data.json"

OUT_DIR = Path("data/debug")
OUT_DIR.mkdir(parents=True, exist_ok=True)

response = requests.get(URL, timeout=30)

print("Status code:", response.status_code)
print("Content-Type:", response.headers.get("content-type"))

if response.status_code == 401:
    raise SystemExit("401 Unauthorized: endpoint requires authentication.")

if response.status_code == 403:
    raise SystemExit("403 Forbidden: endpoint is blocked or requires permission.")

if response.status_code == 404:
    raise SystemExit("404 Not Found: game ID or URL is wrong.")

response.raise_for_status()

data = response.json()

# save full raw JSON
raw_path = OUT_DIR / f"{GAME_ID}_raw.json"
with open(raw_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

# export play-by-play
pbp = data.get("pbp", [])

if not pbp:
    raise SystemExit("No pbp array found in this JSON.")

pbp_df = pd.DataFrame(pbp)

csv_path = OUT_DIR / f"{GAME_ID}_pbp.csv"
pbp_df.to_csv(csv_path, index=False, encoding="utf-8-sig")

print(f"Saved raw JSON to: {raw_path}")
print(f"Saved play-by-play CSV to: {csv_path}")
print(f"PBP rows: {len(pbp_df)}")
print("Columns:")
print(pbp_df.columns.tolist())