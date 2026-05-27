from pathlib import Path

import pandas as pd
import unicodedata
from src.config import SEASON

RAW_DIR = Path("data/raw")
PROCESSED_DIR = Path("data/processed")
def normalize_text(value: str) -> str:

    if pd.isna(value):
        return value

    value = str(value)

    value = unicodedata.normalize(
        "NFKD",
        value
    ).encode(
        "ascii",
        "ignore"
    ).decode(
        "utf-8"
    )

    value = value.lower()

    value = " ".join(value.split())

    return value

def ensure_dirs() -> None:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


def load_raw_data(season: int):
    schedule = pd.read_csv(RAW_DIR / f"schedule_{season}.csv")

    team_box_cols = [
        "game_id",
        "fiba_id",
        "season",
        "team_name",
        "short_name",
        "team_code",
        "team_score",
        "field_goals_made",
        "field_goals_attempted",
        "field_goal_percentage",
        "two_point_field_goals_made",
        "two_point_field_goals_attempted",
        "two_point_percentage",
        "three_point_field_goals_made",
        "three_point_field_goals_attempted",
        "three_point_percentage",
        "free_throws_made",
        "free_throws_attempted",
        "free_throw_percentage",
        "offensive_rebounds",
        "defensive_rebounds",
        "rebounds",
        "assists",
        "steals",
        "turnovers",
        "blocks",
        "personal_fouls",
        "fouls_drawn",
        "points_in_the_paint",
        "second_chance_points",
        "points_from_turnovers",
        "bench_points",
        "fast_break_points",
    ]

    player_box_cols = [
        "game_id",
        "fiba_id",
        "season",
        "team_name",
        "team_code",
        "player_id",
        "player_name",
        "first_name",
        "family_name",
        "shirt_number",
        "position",
        "starter",
        "minutes",
        "field_goals_made",
        "field_goals_attempted",
        "field_goal_percentage",
        "two_point_field_goals_made",
        "two_point_field_goals_attempted",
        "two_point_percentage",
        "three_point_field_goals_made",
        "three_point_field_goals_attempted",
        "three_point_percentage",
        "free_throws_made",
        "free_throws_attempted",
        "free_throw_percentage",
        "offensive_rebounds",
        "defensive_rebounds",
        "rebounds",
        "assists",
        "steals",
        "turnovers",
        "blocks",
        "personal_fouls",
        "fouls_drawn",
        "points",
        "second_chance_points",
        "fast_break_points",
        "plus_minus",
        "points_in_the_paint",
    ]

    team_box = pd.DataFrame(columns=team_box_cols)
    player_box = pd.DataFrame(columns=player_box_cols)

    return schedule, team_box, player_box


def build_team_games(schedule: pd.DataFrame,
                     team_box: pd.DataFrame) -> pd.DataFrame:

    home_df = schedule[[
    "fiba_id",
    "home_team_name",
    "away_team_name",
    "start_time_utc"
    ]].copy()

    home_df.columns = [
        "game_id",
        "team_name",
        "opponent_name",
        "game_date"
    ]

    away_df = schedule[[
    "fiba_id",
    "away_team_name",
    "home_team_name",
    "start_time_utc"
    ]].copy()

    away_df.columns = [
        "game_id",
        "team_name",
        "opponent_name",
        "game_date"
    ]

    opponents_df = pd.concat([home_df, away_df], ignore_index=True)

    team_box["game_id"] = team_box["game_id"].astype(str)
    opponents_df["game_id"] = opponents_df["game_id"].astype(str)
    team_box["team_name_clean"] = (
    team_box["team_name"]
    .apply(normalize_text)
    )

    opponents_df["team_name_clean"] = (
    opponents_df["team_name"]
    .apply(normalize_text)
    )
    team_games = team_box.merge(
    opponents_df.drop(columns=["team_name"]),
    on=["game_id", "team_name_clean"],
    how="left"
    )

    team_games = team_games.sort_values(
        ["team_name", "game_date"]
    )

    team_games["game_number"] = (
        team_games.groupby("team_name")
        .cumcount() + 1
    )

    team_games["stocks"] = (
        team_games["steals"] +
        team_games["blocks"]
    )

    team_games["ft"] = (
        team_games["free_throws_made"].astype(str)
        + "-"
        + team_games["free_throws_attempted"].astype(str)
    )

    return team_games

def build_team_comparison(team_games: pd.DataFrame) -> pd.DataFrame:
    comparison_stats = [
        "team_score",
        "field_goals_made",
        "field_goals_attempted",
        "field_goal_percentage",
        "two_point_field_goals_made",
        "two_point_field_goals_attempted",
        "two_point_percentage",
        "three_point_field_goals_made",
        "three_point_field_goals_attempted",
        "three_point_percentage",
        "free_throws_made",
        "free_throws_attempted",
        "free_throw_percentage",
        "offensive_rebounds",
        "defensive_rebounds",
        "rebounds",
        "assists",
        "steals",
        "turnovers",
        "blocks",
        "personal_fouls",
        "fouls_drawn",
        "points_in_the_paint",
        "second_chance_points",
        "points_from_turnovers",
        "bench_points",
        "fast_break_points",
        "stocks",
    ]

    base_cols = [
        "game_id",
        "season",
        "game_date",
        "game_number",
        "team_name",
        "short_name",
        "opponent_name",
    ]

    self_df = team_games[base_cols + comparison_stats].copy()

    opp_df = team_games[
        ["game_id", "team_name"] + comparison_stats
    ].copy()

    opp_df = opp_df.rename(columns={"team_name": "opponent_name"})

    for col in comparison_stats:
        opp_df = opp_df.rename(columns={col: f"opp_{col}"})

    comparison = self_df.merge(
        opp_df,
        on=["game_id", "opponent_name"],
        how="left",
    )

    for col in comparison_stats:
        comparison = comparison.rename(columns={col: f"self_{col}"})
        comparison[f"diff_{col}"] = (
            comparison[f"self_{col}"] - comparison[f"opp_{col}"]
        )

    return comparison

def build_player_games(
    player_box: pd.DataFrame,
    team_games: pd.DataFrame
) -> pd.DataFrame:

    player_games = player_box.copy()

    # Build lookup from team_games
    lookup_cols = [
        "game_id",
        "team_name",
        "opponent_name",
        "game_date",
        "game_number",
    ]

    lookup_df = team_games[lookup_cols].copy()

    # Ensure merge types match
    player_games["game_id"] = (
        player_games["game_id"].astype(str)
    )

    lookup_df["game_id"] = (
        lookup_df["game_id"].astype(str)
    )
    player_games["team_name_clean"] = (
    player_games["team_name"]
    .apply(normalize_text)
    )

    lookup_df["team_name_clean"] = (
    lookup_df["team_name"]
    .apply(normalize_text)
    )
    # Merge opponent/game metadata
    player_games = player_games.merge(
    lookup_df.drop(columns=["team_name"]),
    on=["game_id", "team_name_clean"],
    how="left"
    )

    # Sort cleanly
    player_games = player_games.sort_values(
        ["team_name", "game_number", "minutes"],
        ascending=[True, True, False]
    )

    return player_games

def build_charting_metrics(
    team_games: pd.DataFrame
) -> pd.DataFrame:

    charting = team_games.copy()

    charting = charting[[
        "game_id",
        "season",
        "game_date",
        "game_number",
        "team_name",
        "short_name",
        "opponent_name",

        "team_score",

        "field_goals_made",
        "field_goals_attempted",
        "field_goal_percentage",

        "two_point_field_goals_made",
        "two_point_field_goals_attempted",
        "two_point_percentage",

        "three_point_field_goals_made",
        "three_point_field_goals_attempted",
        "three_point_percentage",

        "free_throws_made",
        "free_throws_attempted",
        "free_throw_percentage",

        "offensive_rebounds",
        "defensive_rebounds",
        "rebounds",

        "assists",
        "steals",
        "blocks",
        "turnovers",

        "stocks",

        "points_in_the_paint",
        "second_chance_points",
        "points_from_turnovers",
        "bench_points",
        "fast_break_points",

        "ft",
    ]]

    # Rename cleaner charting columns
    charting = charting.rename(columns={

        "team_score": "points",

        "field_goal_percentage": "fg_pct",
        "two_point_percentage": "2p_pct",
        "three_point_percentage": "3p_pct",
        "free_throw_percentage": "ft_pct",

        "offensive_rebounds": "oreb",
        "defensive_rebounds": "dreb",

    })

    return charting

def save_processed_tables(
    team_games: pd.DataFrame,
    team_comparison: pd.DataFrame,
    player_games: pd.DataFrame,
    charting_metrics: pd.DataFrame,
    season: int
) -> None:

    ensure_dirs()

    team_games_path = (
        PROCESSED_DIR /
        f"team_games_{season}.csv"
    )

    team_comparison_path = (
        PROCESSED_DIR /
        f"team_comparison_{season}.csv"
    )

    player_games_path = (
        PROCESSED_DIR /
        f"player_games_{season}.csv"
    )
    charting_metrics_path = (
    PROCESSED_DIR /
    f"charting_metrics_{season}.csv"
    )

    team_games.to_csv(team_games_path, index=False)

    team_comparison.to_csv(
        team_comparison_path,
        index=False
    )

    player_games.to_csv(
        player_games_path,
        index=False
    )
    charting_metrics.to_csv(
    charting_metrics_path,
    index=False
    )   

    print(f"Saved: {team_games_path}")
    print(team_games.shape)

    print(f"Saved: {team_comparison_path}")
    print(team_comparison.shape)

    print(f"Saved: {player_games_path}")
    print(player_games.shape)

    print(f"Saved: {charting_metrics_path}")
    print(charting_metrics.shape)

if __name__ == "__main__":


    (
        schedule_df,
        team_box_df,
        player_box_df
    ) = load_raw_data(SEASON)

    team_games_df = build_team_games(
        schedule_df,
        team_box_df
    )

    team_comparison_df = build_team_comparison(
        team_games_df
    )

    player_games_df = build_player_games(
        player_box_df,
        team_games_df
    )
    charting_metrics_df = build_charting_metrics(
    team_games_df
    )

    save_processed_tables(
    team_games_df,
    team_comparison_df,
    player_games_df,
    charting_metrics_df,
    SEASON
    )