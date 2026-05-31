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


def safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def extract_team_quarter_scores(data, game_id):
    rows = []
    teams = data.get("tm", {})

    for team_slot in ["1", "2"]:
        team = teams.get(team_slot, {})

        opponent_slot = "2" if team_slot == "1" else "1"
        opponent = teams.get(opponent_slot, {})

        for quarter_num in [1, 2, 3, 4]:
            team_points = safe_int(team.get(f"p{quarter_num}_score"))
            opponent_points = safe_int(opponent.get(f"p{quarter_num}_score"))

            rows.append({
                "game_id": game_id,
                "team_slot": team_slot,
                "team_name": team.get("name"),
                "team_short_name": team.get("shortName"),
                "team_code": team.get("code"),
                "opponent_name": opponent.get("name"),
                "quarter": quarter_num,
                "points": team_points,
                "opponent_points": opponent_points,
                "point_diff": team_points - opponent_points,
            })

    return pd.DataFrame(rows)


def is_success(value):
    return value == 1 or value == "1" or value is True


def normalize_text(value):
    return str(value).strip().lower()


def extract_pbp_quarter_stats(data, game_id):
    pbp = data.get("pbp", [])
    teams = data.get("tm", {})

    team_lookup = {
        "1": teams.get("1", {}).get("name"),
        "2": teams.get("2", {}).get("name"),
        1: teams.get("1", {}).get("name"),
        2: teams.get("2", {}).get("name"),
    }

    rows = []

    for event in pbp:
        period = event.get("period")
        team_slot = event.get("tno")
        team_name = team_lookup.get(team_slot)

        if not period or not team_name:
            continue

        action_type = normalize_text(event.get("actionType"))
        sub_type = normalize_text(event.get("subType"))
        success = is_success(event.get("success"))

        is_2pt_attempt = action_type in ["2pt", "2pt shot", "two pointer"]
        is_3pt_attempt = action_type in ["3pt", "3pt shot", "three pointer"]
        is_ft_attempt = action_type in ["freethrow", "free throw", "ft"]

        row = {
            "game_id": game_id,
            "quarter": period,
            "team_slot": team_slot,
            "team_name": team_name,
            "action_type": event.get("actionType"),
            "sub_type": event.get("subType"),
            "success": event.get("success"),
            "scoring": event.get("scoring"),
            "player": event.get("player"),
            "pno": event.get("pno"),
            "clock": event.get("clock"),
            "s1": event.get("s1"),
            "s2": event.get("s2"),
            "lead": event.get("lead"),

            "fga": int(is_2pt_attempt or is_3pt_attempt),
            "fgm": int((is_2pt_attempt or is_3pt_attempt) and success),

            "two_pa": int(is_2pt_attempt),
            "two_pm": int(is_2pt_attempt and success),

            "three_pa": int(is_3pt_attempt),
            "three_pm": int(is_3pt_attempt and success),

            "fta": int(is_ft_attempt),
            "ftm": int(is_ft_attempt and success),
        }

        rows.append(row)

    events_df = pd.DataFrame(rows)

    if events_df.empty:
        return events_df, pd.DataFrame()

    grouped = (
        events_df
        .groupby(["game_id", "team_slot", "team_name", "quarter"], dropna=False)
        .agg(
            events=("action_type", "count"),

            fgm=("fgm", "sum"),
            fga=("fga", "sum"),

            two_pm=("two_pm", "sum"),
            two_pa=("two_pa", "sum"),

            three_pm=("three_pm", "sum"),
            three_pa=("three_pa", "sum"),

            ftm=("ftm", "sum"),
            fta=("fta", "sum"),

            turnovers=("action_type", lambda x: sum(normalize_text(v) == "turnover" for v in x)),
            fouls=("action_type", lambda x: sum("foul" in normalize_text(v) for v in x)),
            rebounds=("action_type", lambda x: sum("rebound" in normalize_text(v) for v in x)),
            assists=("action_type", lambda x: sum("assist" in normalize_text(v) for v in x)),
            steals=("action_type", lambda x: sum("steal" in normalize_text(v) for v in x)),
            blocks=("action_type", lambda x: sum("block" in normalize_text(v) for v in x)),
        )
        .reset_index()
    )

    grouped["fg_pct"] = grouped["fgm"] / grouped["fga"]
    grouped["two_p_pct"] = grouped["two_pm"] / grouped["two_pa"]
    grouped["three_p_pct"] = grouped["three_pm"] / grouped["three_pa"]
    grouped["ft_pct"] = grouped["ftm"] / grouped["fta"]

    # convert to readable percentages
    percentage_cols = [
        "fg_pct",
        "two_p_pct",
        "three_p_pct",
        "ft_pct",
    ]

    for col in percentage_cols:
        grouped[col] = (grouped[col] * 100).round(1)

    grouped = grouped.fillna(0)

    return events_df, grouped


def main():
    data = fetch_json(URL)

    raw_path = OUT_DIR / f"{GAME_ID}_raw.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    quarter_scores_df = extract_team_quarter_scores(data, GAME_ID)
    pbp_events_df, pbp_quarter_summary_df = extract_pbp_quarter_stats(data, GAME_ID)

    quarter_scores_path = OUT_DIR / f"{GAME_ID}_quarter_scores.csv"
    pbp_events_path = OUT_DIR / f"{GAME_ID}_pbp_events_with_quarters.csv"
    pbp_summary_path = OUT_DIR / f"{GAME_ID}_pbp_quarter_summary.csv"

    quarter_scores_df.to_csv(quarter_scores_path, index=False, encoding="utf-8-sig")

    if not pbp_events_df.empty:
        pbp_events_df.to_csv(pbp_events_path, index=False, encoding="utf-8-sig")

    if not pbp_quarter_summary_df.empty:
        pbp_quarter_summary_df.to_csv(pbp_summary_path, index=False, encoding="utf-8-sig")

    print(f"Saved raw JSON to: {raw_path}")
    print(f"Saved quarter score CSV to: {quarter_scores_path}")

    if not pbp_events_df.empty:
        print(f"Saved PBP quarter event CSV to: {pbp_events_path}")

    if not pbp_quarter_summary_df.empty:
        print(f"Saved PBP quarter summary CSV to: {pbp_summary_path}")

    print("\nQuarter scores preview:")
    print(quarter_scores_df)

    if not pbp_quarter_summary_df.empty:
        print("\nPBP-derived quarter summary preview:")
        print(pbp_quarter_summary_df)


if __name__ == "__main__":
    main()