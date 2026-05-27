# src/live_json_patch.py

from pathlib import Path
import json
import pandas as pd


RAW_DIR = Path("data/raw")
LIVE_JSON_DIR = RAW_DIR / "live_json"


TEAM_STAT_MAP = {
    "field_goals_made": "tot_sFieldGoalsMade",
    "field_goals_attempted": "tot_sFieldGoalsAttempted",
    "field_goals_percentage": "tot_sFieldGoalsPercentage",
    "three_point_field_goals_made": "tot_sThreePointersMade",
    "three_point_field_goals_attempted": "tot_sThreePointersAttempted",
    "three_point_field_goals_percentage": "tot_sThreePointersPercentage",
    "two_point_field_goals_made": "tot_sTwoPointersMade",
    "two_point_field_goals_attempted": "tot_sTwoPointersAttempted",
    "two_point_field_goals_percentage": "tot_sTwoPointersPercentage",
    "free_throws_made": "tot_sFreeThrowsMade",
    "free_throws_attempted": "tot_sFreeThrowsAttempted",
    "free_throws_percentage": "tot_sFreeThrowsPercentage",
    "defensive_rebounds": "tot_sReboundsDefensive",
    "offensive_rebounds": "tot_sReboundsOffensive",
    "total_rebounds": "tot_sReboundsTotal",
    "assists": "tot_sAssists",
    "turnovers": "tot_sTurnovers",
    "steals": "tot_sSteals",
    "blocks": "tot_sBlocks",
    "blocks_received": "tot_sBlocksReceived",
    "personal_fouls": "tot_sFoulsPersonal",
    "fouls_on": "tot_sFoulsOn",
    "points": "tot_sPoints",
    "points_from_turnovers": "tot_sPointsFromTurnovers",
    "second_chance_points": "tot_sPointsSecondChance",
    "fast_break_points": "tot_sPointsFastBreak",
    "bench_points": "tot_sBenchPoints",
    "points_in_the_paint": "tot_sPointsInThePaint",
}

PLAYER_STAT_MAP = {
    "minutes": "sMinutes",
    "field_goals_made": "sFieldGoalsMade",
    "field_goals_attempted": "sFieldGoalsAttempted",
    "field_goals_percentage": "sFieldGoalsPercentage",
    "three_point_field_goals_made": "sThreePointersMade",
    "three_point_field_goals_attempted": "sThreePointersAttempted",
    "three_point_field_goals_percentage": "sThreePointersPercentage",
    "two_point_field_goals_made": "sTwoPointersMade",
    "two_point_field_goals_attempted": "sTwoPointersAttempted",
    "two_point_field_goals_percentage": "sTwoPointersPercentage",
    "free_throws_made": "sFreeThrowsMade",
    "free_throws_attempted": "sFreeThrowsAttempted",
    "free_throws_percentage": "sFreeThrowsPercentage",
    "defensive_rebounds": "sReboundsDefensive",
    "offensive_rebounds": "sReboundsOffensive",
    "total_rebounds": "sReboundsTotal",
    "assists": "sAssists",
    "turnovers": "sTurnovers",
    "steals": "sSteals",
    "blocks": "sBlocks",
    "blocks_received": "sBlocksReceived",
    "personal_fouls": "sFoulsPersonal",
    "fouls_on": "sFoulsOn",
    "points": "sPoints",
    "second_chance_points": "sPointsSecondChance",
    "fast_break_points": "sPointsFastBreak",
    "plus_minus": "sPlusMinusPoints",
    "points_in_the_paint": "sPointsInThePaint",
}


def find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
    normalized = {c.lower(): c for c in df.columns}

    for candidate in candidates:
        if candidate.lower() in normalized:
            return normalized[candidate.lower()]

    return None


def safe_get(d: dict, key: str, default=None):
    value = d.get(key, default)
    return default if value == "" else value


def load_json(game_id: int, season: int) -> dict | None:
    path = LIVE_JSON_DIR / f"{season}_{game_id}.json"

    if not path.exists():
        print(f"No live JSON found for game {game_id}")
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_live_team_rows(
    game_id: int,
    season: int,
    schedule_row: pd.Series,
    team_box_df: pd.DataFrame,
) -> list[dict]:
    data = load_json(game_id, season)

    if not data:
        return []

    rows = []

    for team_key, team_data in data.get("tm", {}).items():
        row = {col: pd.NA for col in team_box_df.columns}

        mappings = {
            "game_id": ["game_id", "fiba_id"],
            "fiba_id": ["fiba_id"],
            "season": ["season"],
            "team_name": ["team_name", "name"],
            "team_code": ["team_code", "code"],
            "team_score": ["team_score", "score"],
            "home_team_name": ["home_team_name"],
            "away_team_name": ["away_team_name"],
        }

        for value_name, candidates in mappings.items():
            col = find_col(team_box_df, candidates)

            if not col:
                continue

            if value_name in ["game_id", "fiba_id"]:
                row[col] = game_id
            elif value_name == "season":
                row[col] = season
            elif value_name == "team_name":
                row[col] = safe_get(team_data, "name")
            elif value_name == "team_code":
                row[col] = safe_get(team_data, "code")
            elif value_name == "team_score":
                row[col] = safe_get(team_data, "score")
            elif value_name in schedule_row.index:
                row[col] = schedule_row[value_name]

        for output_col_base, json_key in TEAM_STAT_MAP.items():
            col = find_col(
                team_box_df,
                [
                    output_col_base,
                    output_col_base.upper(),
                    output_col_base.replace("_", " "),
                    json_key,
                    json_key.replace("tot_", ""),
                ],
            )

            if col:
                row[col] = safe_get(team_data, json_key)

        rows.append(row)

    return rows


def build_live_player_rows(
    game_id: int,
    season: int,
    schedule_row: pd.Series,
    player_box_df: pd.DataFrame,
) -> list[dict]:
    data = load_json(game_id, season)

    if not data:
        return []

    rows = []

    for team_key, team_data in data.get("tm", {}).items():
        team_name = safe_get(team_data, "name")
        team_code = safe_get(team_data, "code")

        players = team_data.get("pl", {})

        for player_key, player_data in players.items():
            row = {col: pd.NA for col in player_box_df.columns}

            mappings = {
                "game_id": ["game_id", "fiba_id"],
                "fiba_id": ["fiba_id"],
                "season": ["season"],
                "team_name": ["team_name", "nameTeam"],
                "team_code": ["team_code", "code"],
                "player_id": ["player_id", "person_id", "pno"],
                "player_name": ["player_name", "name", "full_name"],
                "first_name": ["first_name", "firstName"],
                "family_name": ["family_name", "last_name", "familyName"],
                "shirt_number": ["shirt_number", "jersey_number", "shirtNumber"],
                "position": ["position", "playingPosition"],
                "starter": ["starter", "is_starter"],
            }

            for value_name, candidates in mappings.items():
                col = find_col(player_box_df, candidates)

                if not col:
                    continue

                if value_name in ["game_id", "fiba_id"]:
                    row[col] = game_id
                elif value_name == "season":
                    row[col] = season
                elif value_name == "team_name":
                    row[col] = team_name
                elif value_name == "team_code":
                    row[col] = team_code
                elif value_name == "player_id":
                    row[col] = player_key
                elif value_name == "player_name":
                    row[col] = safe_get(player_data, "name") or (
                        f"{safe_get(player_data, 'firstName', '')} {safe_get(player_data, 'familyName', '')}".strip()
                    )
                elif value_name == "first_name":
                    row[col] = safe_get(player_data, "firstName")
                elif value_name == "family_name":
                    row[col] = safe_get(player_data, "familyName")
                elif value_name == "shirt_number":
                    row[col] = safe_get(player_data, "shirtNumber")
                elif value_name == "position":
                    row[col] = safe_get(player_data, "playingPosition")
                elif value_name == "starter":
                    row[col] = safe_get(player_data, "starter")

            for output_col_base, json_key in PLAYER_STAT_MAP.items():
                col = find_col(
                    player_box_df,
                    [
                        output_col_base,
                        output_col_base.upper(),
                        output_col_base.replace("_", " "),
                        json_key,
                    ],
                )

                if col:
                    row[col] = safe_get(player_data, json_key)

            rows.append(row)

    return rows


def patch_missing_live_boxscores(
    season: int,
    schedule_df: pd.DataFrame,
    team_box_df: pd.DataFrame,
    player_box_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    schedule_game_ids = set(schedule_df["fiba_id"].dropna().astype(int))
    team_game_ids = set(team_box_df["game_id"].dropna().astype(int))
    player_game_ids = set(player_box_df["game_id"].dropna().astype(int))

    missing_team_games = sorted(schedule_game_ids - team_game_ids)
    missing_player_games = sorted(schedule_game_ids - player_game_ids)

    missing_games = sorted(set(missing_team_games) | set(missing_player_games))

    print("\nLive JSON patch missing games:")
    print(missing_games)

    new_team_rows = []
    new_player_rows = []

    for game_id in missing_games:
        schedule_match = schedule_df[schedule_df["fiba_id"].astype(int) == game_id]

        if schedule_match.empty:
            continue

        schedule_row = schedule_match.iloc[0]

        if game_id in missing_team_games:
            new_team_rows.extend(
                build_live_team_rows(
                    game_id,
                    season,
                    schedule_row,
                    team_box_df,
                )
            )

        if game_id in missing_player_games:
            new_player_rows.extend(
                build_live_player_rows(
                    game_id,
                    season,
                    schedule_row,
                    player_box_df,
                )
            )

    if new_team_rows:
        new_team_df = pd.DataFrame(new_team_rows, columns=team_box_df.columns)
        team_box_df = pd.concat([team_box_df, new_team_df], ignore_index=True)
        print(f"Added live team rows: {len(new_team_df)}")

    if new_player_rows:
        new_player_df = pd.DataFrame(new_player_rows, columns=player_box_df.columns)
        player_box_df = pd.concat([player_box_df, new_player_df], ignore_index=True)
        print(f"Added live player rows: {len(new_player_df)}")

    team_box_df.to_csv(RAW_DIR / f"team_boxscores_{season}.csv", index=False)
    player_box_df.to_csv(RAW_DIR / f"player_boxscores_{season}.csv", index=False)

    print("Saved patched raw boxscore files.")

    return team_box_df, player_box_df