const BASE_URL =
  "https://raw.githubusercontent.com/Ztillz/cebl-boxscore-tracker/main/data/processed";

const TEAM_GAMES_URL = `${BASE_URL}/team_games_2026.csv`;
const TEAM_COMPARISON_URL = `${BASE_URL}/team_comparison_2026.csv`;

const TEAM_COLORS = {
    "Montréal Alliance": "#4169E1",
    "Ottawa BlackJacks": "#E5989B",
    "Scarborough Shooting Stars": "#111111",
    "Niagara River Lions": "#7ED957",
    "Brampton Honey Badgers": "#FFD700",
    "Calgary Surge": "#8B0000",
    "Edmonton Stingers": "#DFFF00",
    "Saskatchewan Rattlers": "#F2C230",
    "Saskatoon Mamba": "#FF00FF",
    "Winnipeg Sea Bears": "#00CFC8",
    "Vancouver Bandits": "#FF6A00",
};

const STAT_OPTIONS = [
  "Points From Turnovers",
  "Points In The Paint",
  "Second Chance Points",
  "Fast Break Points",
  "Bench Points",
  "Biggest Lead",
  "Biggest Scoring Run",
  "2P%",
  "3PA",
  "FTA",
  "OReb",
  "Total Rebounds",
  "Stocks"
];

const STAT_COLUMN_MAP = {
  "Points From Turnovers": "points_from_turnovers",
  "Points In The Paint": "points_in_the_paint",
  "Second Chance Points": "second_chance_points",
  "Fast Break Points": "fast_break_points",
  "Bench Points": "bench_points",
  "Biggest Lead": "biggest_lead",
  "Biggest Scoring Run": "biggest_scoring_run",
  "2P%": "two_point_percentage",
  "3PA": "three_point_field_goals_attempted",
  "FTA": "free_throw_attempted",
  "OReb": "offensive_rebounds",
  "Total Rebounds": "rebounds",
  "Stocks": "stocks"
};

let teamGames = [];
let teamComparison = [];

async function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err)
    });
  });
}

function getTeamColumn(row) {
  return row.team || row.team_name || row.Team || row.TEAM;
}

function getGameNumberColumn(row) {
  return row.game_number || row.game_num || row.game_index || row.Game || row.GAME;
}

function createDifferentialRows(rows, statColumn) {
  return rows.map(row => {
    const teamValue = Number(row[statColumn]);

    const opponentValue =
      Number(row[`opp_${statColumn}`]) ||
      Number(row[`opponent_${statColumn}`]) ||
      null;

    return {
      ...row,
      differential_value:
        opponentValue === null || Number.isNaN(opponentValue)
          ? null
          : teamValue - opponentValue
    };
  });
}

function makeTraces(rows, statName, mode) {
  const statColumn = STAT_COLUMN_MAP[statName];

  const plotRows =
    mode === "Differential"
      ? createDifferentialRows(rows, statColumn)
      : rows;

  const teams = [...new Set(plotRows.map(getTeamColumn).filter(Boolean))];

  return teams.map(team => {
    const teamRows = plotRows
      .filter(row => getTeamColumn(row) === team)
      .sort((a, b) => Number(getGameNumberColumn(a)) - Number(getGameNumberColumn(b)));

    const yValues =
      mode === "Differential"
        ? teamRows.map(row => row.differential_value)
        : teamRows.map(row => Number(row[statColumn]));

    return {
      x: teamRows.map(getGameNumberColumn),
      y: yValues,
      type: "scatter",
      mode: "lines+markers",
      name: team,
      line: {
        color: TEAM_COLORS[team] || "#6b7280",
        width: 3
      },
      marker: {
        size: 7
      },
      hovertemplate:
        `<b>${team}</b><br>` +
        `Game: %{x}<br>` +
        `${statName} ${mode}: %{y}<extra></extra>`
    };
  });
}

function renderChart(statName, mode = "Differential") {
  const traces = makeTraces(teamGames, statName, mode);

  const layout = {
    title: `${statName} - ${mode}`,
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    hovermode: "closest",
    xaxis: {
      title: "Game Number",
      dtick: 1,
      tick0: 1
    },
    yaxis: {
      title: mode
    },
    updatemenus: [
      {
        type: "buttons",
        direction: "right",
        x: 0,
        y: 1.15,
        buttons: [
          {
            label: "Differential",
            method: "update",
            args: [
              {
                y: makeTraces(teamGames, statName, "Differential").map(trace => trace.y)
              },
              {
                title: `${statName} - Differential`,
                "yaxis.title.text": "Differential"
              }
            ]
          },
          {
            label: "Total",
            method: "update",
            args: [
              {
                y: makeTraces(teamGames, statName, "Total").map(trace => trace.y)
              },
              {
                title: `${statName} - Total`,
                "yaxis.title.text": "Total"
              }
            ]
          }
        ]
      }
    ],
    legend: {
      orientation: "h",
      y: -0.25
    },
    margin: {
      t: 90,
      r: 30,
      b: 110,
      l: 70
    }
  };

  Plotly.newPlot("teamTrendChart", traces, layout, {
    responsive: true,
    displayModeBar: true
  });
}

function populateStatDropdown() {
  const select = document.getElementById("statSelect");

  STAT_OPTIONS.forEach(stat => {
    const option = document.createElement("option");
    option.value = stat;
    option.textContent = stat;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    renderChart(select.value, "Differential");
  });
}

async function initDashboard() {
  try {
    teamGames = await loadCSV(TEAM_GAMES_URL);
    teamComparison = await loadCSV(TEAM_COMPARISON_URL);

    populateStatDropdown();
    renderChart(STAT_OPTIONS[0], "Differential");
  } catch (error) {
    console.error("Dashboard failed to load:", error);
    document.body.innerHTML += `
      <p style="color:red; padding: 40px;">
        Failed to load dashboard data. Check CSV URLs or column names.
      </p>
    `;
  }
}

initDashboard();