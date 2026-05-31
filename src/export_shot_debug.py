import json
from pathlib import Path

import pandas as pd
import requests


GAME_ID = "2798717"  # change this game id when needed
URL = f"https://fibalivestats.dcd.shared.geniussports.com/data/{GAME_ID}/data.json"

OUT_DIR = Path("data/debug")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_json(url):
    response = requests.get(url, timeout=30)

    print("Status code:", response.status_code)
    print("Content-Type:", response.headers.get("content-type"))

    if response.status_code == 401:
        raise SystemExit("401 Unauthorized: endpoint requires authentication.")

    if response.status_code == 403:
        raise SystemExit("403 Forbidden: endpoint is blocked or requires permission.")

    if response.status_code == 404:
        raise SystemExit("404 Not Found: game ID or URL is wrong.")

    response.raise_for_status()
    return response.json()


def extract_team_shots(data, game_id):
    rows = []

    teams = data.get("tm", {})

    for team_slot in ["1", "2"]:
        team = teams.get(team_slot, {})

        team_name = team.get("name")
        team_short_name = team.get("shortName")
        team_code = team.get("code")
        opponent_slot = "2" if team_slot == "1" else "1"
        opponent = teams.get(opponent_slot, {})
        opponent_name = opponent.get("name")

        shots = team.get("shot", [])

        for shot in shots:
            row = {
                "game_id": game_id,
                "team_slot": team_slot,
                "team_name": team_name,
                "team_short_name": team_short_name,
                "team_code": team_code,
                "opponent_name": opponent_name,
            }

            # keep every original shot field
            for key, value in shot.items():
                row[key] = value

            rows.append(row)

    return pd.DataFrame(rows)


def main():
    data = fetch_json(URL)

    raw_path = OUT_DIR / f"{GAME_ID}_raw.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    shots_df = extract_team_shots(data, GAME_ID)

    if shots_df.empty:
        raise SystemExit("No shot[] data found under tm.1 or tm.2.")

    csv_path = OUT_DIR / f"{GAME_ID}_shots.csv"
    shots_df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    print(f"Saved raw JSON to: {raw_path}")
    print(f"Saved shot CSV to: {csv_path}")
    print(f"Shot rows: {len(shots_df)}")
    print("Columns:")
    print(shots_df.columns.tolist())

    print("\nPreview:")
    print(shots_df.head(10))


if __name__ == "__main__":
    main()