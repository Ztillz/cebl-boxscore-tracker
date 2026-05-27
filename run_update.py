from src.pull_cebl_data import save_raw_data
from src.live_json_patch import patch_missing_live_boxscores
from src.build_tables import (
    load_raw_data,
    build_team_games,
    build_team_comparison,
    build_player_games,
    build_charting_metrics,
    save_processed_tables,
)
from src.export_outputs import (
    ensure_dirs as ensure_export_dirs,
    load_team_games,
    export_team_logs,
    export_excel_workbook,
)

from src.config import SEASON


def print_diagnostic(schedule_df, team_box_df, player_box_df, label):
    print(f"\n=========================")
    print(label)
    print("=========================")

    print("\nSchedule rows:", len(schedule_df))
    print("Schedule games:", schedule_df["fiba_id"].nunique())

    print("\nTeam boxscore rows:", len(team_box_df))
    print("Team boxscore games:", team_box_df["game_id"].nunique())

    print("\nPlayer boxscore rows:", len(player_box_df))
    print("Player boxscore games:", player_box_df["game_id"].nunique())

    schedule_game_ids = set(schedule_df["fiba_id"].dropna().astype(int))
    team_game_ids = set(team_box_df["game_id"].dropna().astype(int))
    player_game_ids = set(player_box_df["game_id"].dropna().astype(int))

    print("\nGames in schedule but missing from TEAM boxscores:")
    print(sorted(schedule_game_ids - team_game_ids))

    print("\nGames in schedule but missing from PLAYER boxscores:")
    print(sorted(schedule_game_ids - player_game_ids))


def main() -> None:
    print(f"Starting CEBL update for {SEASON}")

    print("\nStep 1: Pulling raw data")
    save_raw_data(SEASON)

    print("\nStep 2: Loading raw data")
    schedule_df, team_box_df, player_box_df = load_raw_data(SEASON)

    print_diagnostic(
        schedule_df,
        team_box_df,
        player_box_df,
        "RAW DATA BEFORE LIVE PATCH"
    )

    print("\nStep 3: Patching missing games from live JSON")
    team_box_df, player_box_df = patch_missing_live_boxscores(
        SEASON,
        schedule_df,
        team_box_df,
        player_box_df,
    )

    print_diagnostic(
        schedule_df,
        team_box_df,
        player_box_df,
        "RAW DATA AFTER LIVE PATCH"
    )

    print("\nStep 4: Building processed tables")

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

    print("\nStep 5: Exporting outputs")
    ensure_export_dirs()

    team_games_df = load_team_games(SEASON)

    export_team_logs(
        team_games_df,
        SEASON
    )

    export_excel_workbook(SEASON)

    print("\nUpdate complete.")


if __name__ == "__main__":
    main()