from pathlib import Path
from openpyxl import Workbook
import pandas as pd
from src.config import SEASON

PROCESSED_DIR = Path("data/processed")
EXPORT_DIR = Path("data/exports")
TEAM_EXPORT_DIR = EXPORT_DIR / "team_logs"


def ensure_dirs() -> None:

    EXPORT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    TEAM_EXPORT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


def load_team_games(season: int) -> pd.DataFrame:

    path = (
        PROCESSED_DIR /
        f"team_games_{season}.csv"
    )

    return pd.read_csv(path)


def export_team_logs(
    team_games: pd.DataFrame,
    season: int
) -> None:

    teams = sorted(
        team_games["team_name"]
        .dropna()
        .unique()
    )

    for team in teams:

        team_df = (
            team_games[
                team_games["team_name"] == team
            ]
            .sort_values("game_number")
            .copy()
        )

        safe_name = (
            team.lower()
            .replace(" ", "_")
            .replace("-", "_")
        )

        output_path = (
            TEAM_EXPORT_DIR /
            f"{safe_name}_{season}.csv"
        )

        team_df.to_csv(
            output_path,
            index=False
        )

        print(
            f"Exported {team} "
            f"-> {output_path.name}"
        )

def export_excel_workbook(
    season: int
) -> None:

    workbook_path = (
        EXPORT_DIR /
        f"cebl_master_workbook_{season}.xlsx"
    )

    wb = Workbook()

    # Remove default sheet
    default_sheet = wb.active
    wb.remove(default_sheet)

    # Load processed tables
    team_games = pd.read_csv(
        PROCESSED_DIR /
        f"team_games_{season}.csv"
    )

    team_comparison = pd.read_csv(
        PROCESSED_DIR /
        f"team_comparison_{season}.csv"
    )

    player_games = pd.read_csv(
        PROCESSED_DIR /
        f"player_games_{season}.csv"
    )

    charting_metrics = pd.read_csv(
        PROCESSED_DIR /
        f"charting_metrics_{season}.csv"
    )

    # Helper function
    def add_df_sheet(sheet_name, df):

        ws = wb.create_sheet(
            title=sheet_name[:31]
        )

        ws.append(df.columns.tolist())

        for row in df.itertuples(index=False):
            ws.append(list(row))

    # Main sheets
    add_df_sheet(
        "Charting Metrics",
        charting_metrics
    )

    add_df_sheet(
        "Team Comparison",
        team_comparison
    )

    add_df_sheet(
        "Player Games",
        player_games
    )

    # One tab per team
    teams = sorted(
        team_games["team_name"]
        .dropna()
        .unique()
    )

    for team in teams:

        team_df = (
            team_games[
                team_games["team_name"] == team
            ]
            .sort_values("game_number")
        )

        add_df_sheet(
            team,
            team_df
        )

    wb.save(workbook_path)

    print(
        f"Workbook saved -> "
        f"{workbook_path}"
    )

if __name__ == "__main__":

    

    ensure_dirs()

    team_games_df = load_team_games(
        SEASON
    )

    export_team_logs(
        team_games_df,
        SEASON
    )
    export_excel_workbook(
    SEASON
    )