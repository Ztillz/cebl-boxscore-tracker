from pathlib import Path
import json
import time
import requests
import pandas as pd

RAW_DIR = Path("data/raw")
RAW_JSON_DIR = Path("data/raw/live_json")

SCHEDULE_URL = (
    "https://github.com/ryanndu/cebl-data/releases/download/"
    "schedule/cebl_schedule.csv"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json,text/plain,*/*",
}


def ensure_dirs() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    RAW_JSON_DIR.mkdir(parents=True, exist_ok=True)


def pull_schedule(season: int) -> pd.DataFrame:
    schedule = pd.read_csv(SCHEDULE_URL)
    schedule = schedule[schedule["season"] == season].copy()
    return schedule


def fetch_game_json(url: str) -> dict:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r.json()


def save_game_json_files(schedule: pd.DataFrame, season: int) -> None:
    games = schedule.dropna(subset=["fiba_json_url"]).copy()

    for _, row in games.iterrows():
        game_id = str(row["fiba_id"])
        url = row["fiba_json_url"]
        out_path = RAW_JSON_DIR / f"{season}_{game_id}.json"

        try:
            data = fetch_game_json(url)

            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)

            print(f"Saved live JSON for game {game_id}")

            time.sleep(0.5)

        except Exception as e:
            print(f"Failed game {game_id}: {e}")


def inspect_json_structure(season: int) -> None:
    files = sorted(RAW_JSON_DIR.glob(f"{season}_*.json"))

    if not files:
        print("No JSON files found.")
        return

    sample = files[0]

    with open(sample, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"\nSample file: {sample}")
    print("Top-level type:", type(data))

    if isinstance(data, dict):
        print("Top-level keys:")
        print(list(data.keys()))

    elif isinstance(data, list):
        print("List length:", len(data))
        if data and isinstance(data[0], dict):
            print("First item keys:")
            print(list(data[0].keys()))


def pull_team_boxscores(season: int) -> pd.DataFrame:
    raise NotImplementedError(
        "Next step: map saved FIBA JSON files into the same team_boxscores CSV schema."
    )


def pull_player_boxscores(season: int) -> pd.DataFrame:
    raise NotImplementedError(
        "Next step: map saved FIBA JSON files into the same player_boxscores CSV schema."
    )


def save_raw_data(season: int) -> None:
    ensure_dirs()

    schedule = pull_schedule(season)
    schedule.to_csv(RAW_DIR / f"schedule_{season}.csv", index=False)

    save_game_json_files(schedule, season)
    inspect_json_structure(season)

    print(f"Saved schedule: {schedule.shape}")
    print("Live JSON files saved. Now inspect the JSON structure and build transformers.")