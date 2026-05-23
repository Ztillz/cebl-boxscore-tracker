from src.pull_cebl_data import save_raw_data
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


def main() -> None:
    print(f"Starting CEBL update for {SEASON}")

    print("\nStep 1: Pulling raw data")
    save_raw_data(SEASON)

    print("\nStep 2: Building processed tables")
    schedule_df, team_box_df, player_box_df = load_raw_data(SEASON)

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

    print("\nStep 3: Exporting outputs")
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