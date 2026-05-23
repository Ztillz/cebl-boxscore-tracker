from pathlib import Path

import pandas as pd
from ceblpy import ceblpy


RAW_DIR = Path("data/raw")


def ensure_dirs() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)


def pull_schedule(season: int) -> pd.DataFrame:
    return ceblpy.load_cebl_schedule(season)


def pull_team_boxscores(season: int) -> pd.DataFrame:
    return ceblpy.load_cebl_team_boxscore(season)


def pull_player_boxscores(season: int) -> pd.DataFrame:
    return ceblpy.load_cebl_player_boxscore(season)


def save_raw_data(season: int) -> None:
    ensure_dirs()

    schedule = pull_schedule(season)
    team_boxscores = pull_team_boxscores(season)
    player_boxscores = pull_player_boxscores(season)

    schedule.to_csv(RAW_DIR / f"schedule_{season}.csv", index=False)
    team_boxscores.to_csv(RAW_DIR / f"team_boxscores_{season}.csv", index=False)
    player_boxscores.to_csv(RAW_DIR / f"player_boxscores_{season}.csv", index=False)

    print(f"Saved schedule: {schedule.shape}")
    print(f"Saved team boxscores: {team_boxscores.shape}")
    print(f"Saved player boxscores: {player_boxscores.shape}")


if __name__ == "__main__":
    from src.config import SEASON

    save_raw_data(season=SEASON)