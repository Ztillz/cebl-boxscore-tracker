const BASE_URL =
  "https://raw.githubusercontent.com/Ztillz/cebl-boxscore-tracker/main/data/processed";

const CSV_URLS = {
  team_games: `${BASE_URL}/team_games_2026.csv`,
  team_comparison: `${BASE_URL}/team_comparison_2026.csv`,
  player_games: `${BASE_URL}/player_games_2026.csv`,
  charting_metrics: `${BASE_URL}/charting_metrics_2026.csv`,
};

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

const BOXSCORE_DIFF_STATS = {
  "Points From Turnovers": "points_from_turnovers",
  "Points In The Paint": "points_in_the_paint",
  "Second Chance Points": "second_chance_points",
  "Fast Break Points": "fast_break_points",
  "Bench Points": "bench_points",
  "Biggest Lead": "biggest_lead",
  "Biggest Scoring Run": "biggest_scoring_run",
};

const STANDARD_BOXSCORE_STATS = {
  "2P%": "two_point_percentage",
  "3P%": "three_point_percentage",
  "3PA": "three_point_field_goals_attempted",
  "FTA": "free_throws_attempted",
  "TO": "turnovers",
  "OReb": "offensive_rebounds",
  "Total Rebounds": "rebounds",
  "Stocks": "stocks",
};

const ALL_STATS = {
  ...BOXSCORE_DIFF_STATS,
  ...STANDARD_BOXSCORE_STATS,
};

let teamGames = [];
let teamDiffRows = [];
let teamOrder = [];
let queryConditions = [];
let teamComparisonRows = [];

async function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: error => reject(error),
    });
  });
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num = Number(value);

  return Number.isFinite(num) ? num : null;
}

function getAvailableStats(rows, statsDict) {
  const firstRow = rows[0] || {};
  const available = {};

  Object.entries(statsDict).forEach(([label, col]) => {
    if (Object.prototype.hasOwnProperty.call(firstRow, col)) {
      available[label] = col;
    }
  });

  return available;
}

function getAllNumericQueryStats(rows) {
  const firstRow = rows[0] || {};

  const excludedCols = new Set([
    "game_id",
    "fiba_id",
    "season",
    "game_number",
  ]);

  const queryStats = {};

  Object.keys(firstRow).forEach(col => {
    if (excludedCols.has(col)) return;

    const hasNumericValue = rows.some(row => {
      const value = numberOrNull(row[col]);
      return value !== null;
    });

    if (!hasNumericValue) return;

    const label = col
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());

    queryStats[label] = col;
  });

  return queryStats;
}

function createTeamGameDifferentials(rows, statsDict) {
  const useStats = Object.values(statsDict);

  const gameLookup = {};

  rows.forEach(row => {
    if (!gameLookup[row.game_id]) {
      gameLookup[row.game_id] = [];
    }
    gameLookup[row.game_id].push(row);
  });

  const mergedRows = [];

  rows.forEach(row => {
    const gameRows = gameLookup[row.game_id] || [];

    const opponentRow = gameRows.find(
      other => other.team_name !== row.team_name
    );

    if (!opponentRow) return;

    const newRow = {
      game_id: row.game_id,
      season: row.season,
      game_date: row.game_date,
      game_number: row.game_number,
      team_name: row.team_name,
      short_name: row.short_name,
      opponent_name: row.opponent_name,
      matched_opponent_team_name: opponentRow.team_name,
      matched_opponent_short_name: opponentRow.short_name,
    };

    useStats.forEach(col => {
      const teamValue = numberOrNull(row[col]);
      const opponentValue = numberOrNull(opponentRow[col]);

      newRow[col] = teamValue;
      newRow[`opp_${col}`] = opponentValue;
      newRow[`${col}_diff`] =
        teamValue === null || opponentValue === null
          ? null
          : teamValue - opponentValue;
    });

    mergedRows.push(newRow);
  });

  return mergedRows;
}

function populateStatDropdown(availableStats) {
  const select = document.getElementById("statSelect");
  select.innerHTML = "";

  Object.keys(availableStats).forEach(label => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    const statLabel = select.value;
    renderTeamStatChart(statLabel, availableStats[statLabel], "Differential");
  });
}

function sortTeamRows(rows) {
  return rows.sort((a, b) => {
    const dateCompare = new Date(a.game_date) - new Date(b.game_date);
    if (dateCompare !== 0) return dateCompare;
    return Number(a.game_number) - Number(b.game_number);
  });
}

function buildTrace(team, statLabel, statCol, mode) {
  const isPercentage = statLabel.includes("%");
  const diffCol = `${statCol}_diff`;

  const teamRows = sortTeamRows(
    teamDiffRows.filter(row => row.team_name === team)
  );

  const yValues =
    mode === "Differential"
      ? teamRows.map(row => row[diffCol])
      : teamRows.map(row => row[statCol]);

  const validValues = yValues
    .map(value => numberOrNull(value))
    .filter(value => value !== null);

  const average =
    validValues.length > 0
      ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length
      : null;

  const averageLabel =
    average === null
      ? "N/A"
      : mode === "Differential"
        ? `${average >= 0 ? "+" : ""}${average.toFixed(1)}`
        : average.toFixed(1);

  const customData = teamRows.map(row => [
    row.game_date,
    row.opponent_name,
    row[statCol],
    row[`opp_${statCol}`],
  ]);

  const numFormat = isPercentage ? ".1f" : "";

  const hoverTemplate =
    mode === "Differential"
      ? `<b>${team}</b><br>` +
        `Game: %{x}<br>` +
        `Date: %{customdata[0]}<br>` +
        `Opponent: %{customdata[1]}<br>` +
        `Differential: %{y:${numFormat}}<br>` +
        `Team total: %{customdata[2]:${numFormat}}<br>` +
        `Opponent total: %{customdata[3]:${numFormat}}` +
        `<extra></extra>`
      : `<b>${team}</b><br>` +
        `Game: %{x}<br>` +
        `Date: %{customdata[0]}<br>` +
        `Opponent: %{customdata[1]}<br>` +
        `Team total: %{y:${numFormat}}` +
        `<extra></extra>`;

  return {
    x: teamRows.map(row => row.game_number),
    y: yValues,
    customdata: customData,
    type: "scatter",
    mode: "lines+markers",
    name: `${team} (${averageLabel})`,
    line: {
      color: TEAM_COLORS[team] || "#999999",
      width: 3,
    },
    marker: {
      size: 8,
      color: TEAM_COLORS[team] || "#999999",
    },
    hovertemplate: hoverTemplate,
  };
}

function buildTraces(statLabel, statCol, mode) {
  return teamOrder.map(team => buildTrace(team, statLabel, statCol, mode));
}

function getYAxisTitle(statLabel, mode) {
  const isPercentage = statLabel.includes("%");

  if (mode === "Differential" && isPercentage) {
    return `${statLabel} Differential (percentage points)`;
  }

  if (mode === "Total" && isPercentage) {
    return `${statLabel} Total (%)`;
  }

  return `${statLabel} ${mode}`;
}

function getZeroLineShape(mode) {
  if (mode !== "Differential") return [];

  return [
    {
      type: "line",
      xref: "paper",
      x0: 0,
      x1: 1,
      y0: 0,
      y1: 0,
      line: {
        color: "gray",
        width: 1,
        dash: "dash",
      },
      opacity: 0.7,
    },
  ];
}

function renderTeamStatChart(statLabel, statCol, mode = "Differential") {
  const traces = buildTraces(statLabel, statCol, mode);

  const layout = {
    title: {
      text: `${statLabel} ${mode} by Game`,
      x: 0.5,
      font: { size: 24 },
    },
    height: 725,
    template: "plotly_white",
    hovermode: "closest",
    xaxis: {
      title: "Team Game Number",
      tickmode: "linear",
      tick0: 1,
      dtick: 1,
      showgrid: true,
    },
    yaxis: {
      title: getYAxisTitle(statLabel, mode),
      showgrid: true,
      zeroline: true,
    },
    legend: {
      title: { text: "Team" },
      orientation: "v",
      yanchor: "top",
      y: 1,
      xanchor: "left",
      x: 1.02,
    },
    margin: {
      l: 70,
      r: 220,
      t: 120,
      b: 70,
    },
    shapes: getZeroLineShape(mode),
     updatemenus: [
      {
        type: "buttons",
        direction: "right",
        x: 0.02,
        y: 1.18,
        xanchor: "left",
        yanchor: "top",
        buttons: [
          {
            label: "Differential",
            method: "update",
            args: [
              {
                y: buildTraces(statLabel, statCol, "Differential").map(
                  trace => trace.y
                ),
                name: buildTraces(statLabel, statCol, "Differential").map(
                  trace => trace.name
                ),
                customdata: buildTraces(statLabel, statCol, "Differential").map(
                  trace => trace.customdata
                ),
                hovertemplate: buildTraces(
                  statLabel,
                  statCol,
                  "Differential"
                ).map(trace => trace.hovertemplate),
              },
              {
                title: `${statLabel} Differential by Game`,
                "yaxis.title.text": getYAxisTitle(statLabel, "Differential"),
                shapes: getZeroLineShape("Differential"),
              },
            ],
          },
          {
            label: "Total",
            method: "update",
            args: [
              {
                y: buildTraces(statLabel, statCol, "Total").map(
                  trace => trace.y
                ),
                name: buildTraces(statLabel, statCol, "Total").map(
                  trace => trace.name
                ),
                customdata: buildTraces(statLabel, statCol, "Total").map(
                  trace => trace.customdata
                ),
                hovertemplate: buildTraces(statLabel, statCol, "Total").map(
                  trace => trace.hovertemplate
                ),
              },
              {
                title: `${statLabel} Total by Game`,
                "yaxis.title.text": getYAxisTitle(statLabel, "Total"),
                shapes: getZeroLineShape("Total"),
              },
            ],
          },
        ],
      },
    ],
  };

  Plotly.newPlot("teamTrendChart", traces, layout, {
    responsive: true,
    displayModeBar: true,
  });
}

function renderDataSummary(availableStats) {
  const status = document.getElementById("statusMessage");
  if (!status) return;

  const teams = [...new Set(teamGames.map(row => row.team_name).filter(Boolean))];
  const games = [...new Set(teamGames.map(row => row.game_id).filter(Boolean))];

  status.textContent = `Loaded ${teamGames.length} team-game rows, ${games.length} games, ${teams.length} teams, ${Object.keys(availableStats).length} available stats.`;
}

function compareValues(actual, operator, target) {
  if (actual === null || Number.isNaN(actual)) return false;

  if (operator === "<") return actual < target;
  if (operator === "<=") return actual <= target;
  if (operator === ">") return actual > target;
  if (operator === ">=") return actual >= target;
  if (operator === "==") return actual === target;

  return false;
}

function getTeamResult(row) {
  const teamScore = numberOrNull(row.team_score);

  const opponentRow = teamGames.find(
    other =>
      other.game_id === row.game_id &&
      other.team_name !== row.team_name
  );

  const opponentScore = opponentRow
    ? numberOrNull(opponentRow.team_score)
    : null;

  if (teamScore === null || opponentScore === null) return null;

  return teamScore > opponentScore ? "W" : "L";
}
function populateQueryControls() {
  const teamSelect = document.getElementById("queryTeamSelect");
  const statTypeSelect = document.getElementById("queryStatTypeSelect");

  if (!teamSelect || !statTypeSelect) return;

  teamSelect.innerHTML = `<option value="ALL">All Teams</option>`;

  const queryTeams = [...new Set(teamComparisonRows.map(row => row.team_name))]
    .filter(Boolean)
    .sort();

  queryTeams.forEach(team => {
    const option = document.createElement("option");
    option.value = team;
    option.textContent = team;
    teamSelect.appendChild(option);
  });

  statTypeSelect.innerHTML = `
    <option value="self">Team Stats</option>
    <option value="opp">Opponent Stats</option>
  `;

  updateQueryStatDropdown();
}

function updateQueryStatDropdown() {
  const statTypeSelect = document.getElementById("queryStatTypeSelect");
  const statSelect = document.getElementById("queryStatSelect");

  if (!statTypeSelect || !statSelect) return;

  const statType = statTypeSelect.value;
  const firstRow = teamComparisonRows[0] || {};

  statSelect.innerHTML = "";

  Object.keys(firstRow).forEach(col => {
    if (statType === "self" && !col.startsWith("self_")) return;
    if (statType === "opp" && !col.startsWith("opp_")) return;

    const hasNumericValue = teamComparisonRows.some(row => {
      const value = numberOrNull(row[col]);
      return value !== null;
    });

    if (!hasNumericValue) return;

    const label = col
      .replace("self_", "")
      .replace("opp_", "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, char => char.toUpperCase());

    const option = document.createElement("option");
    option.value = col;
    option.textContent = label;

    statSelect.appendChild(option);
  });
}

function renderActiveConditions() {
  const box = document.getElementById("activeConditions");
  if (!box) return;

  if (queryConditions.length === 0) {
    box.textContent = "No active conditions.";
    return;
  }

  box.innerHTML = queryConditions
    .map(condition => {
      const sideLabel =
        condition.statSide === "opp" ? "Opponent" : "Team";

      return `<span>${sideLabel} ${condition.label} ${condition.operator} ${condition.value}</span>`;
    })
    .join(" AND ");
}

function addQueryCondition() {
  const statTypeSelect = document.getElementById("queryStatTypeSelect");
  const statSelect = document.getElementById("queryStatSelect");
  const operatorSelect = document.getElementById("queryOperatorSelect");
  const valueInput = document.getElementById("queryValueInput");

  if (!statTypeSelect || !statSelect || !operatorSelect || !valueInput) return;

  if (valueInput.value === "") {
    alert("Enter a value before adding the condition.");
    return;
  }

  const selectedOption = statSelect.options[statSelect.selectedIndex];

  queryConditions.push({
    statSide: statTypeSelect.value,
    label: selectedOption.textContent,
    col: statSelect.value,
    operator: operatorSelect.value,
    value: Number(valueInput.value),
  });

  valueInput.value = "";
  renderActiveConditions();
}

function getTeamResultFromComparison(row) {
  const teamScore = numberOrNull(row.self_team_score);
  const opponentScore = numberOrNull(row.opp_team_score);

  if (teamScore === null || opponentScore === null) return "-";

  return teamScore > opponentScore ? "W" : "L";
}

function runTeamQuery() {
  const teamSelect = document.getElementById("queryTeamSelect");
  const resultsBox = document.getElementById("queryResults");

  if (!teamSelect || !resultsBox) return;

  const selectedTeam = teamSelect.value;

  if (queryConditions.length === 0) {
    resultsBox.innerHTML = `<p>Add at least one condition before running the query.</p>`;
    return;
  }

  let filteredRows = teamComparisonRows.filter(row => {
    if (selectedTeam !== "ALL" && row.team_name !== selectedTeam) {
      return false;
    }

    return queryConditions.every(condition => {
      const actual = numberOrNull(row[condition.col]);
      return compareValues(actual, condition.operator, condition.value);
    });
  });

  const grouped = {};

  filteredRows.forEach(row => {
    const team = row.team_name;
    const result = getTeamResultFromComparison(row);

    if (!grouped[team]) {
      grouped[team] = {
        team,
        games: [],
        wins: 0,
        losses: 0,
      };
    }

    grouped[team].games.push(row);

    if (result === "W") grouped[team].wins += 1;
    if (result === "L") grouped[team].losses += 1;
  });

  const summaryRows = Object.values(grouped)
    .map(row => ({
      ...row,
      gameCount: row.games.length,
      winPct: row.games.length > 0 ? row.wins / row.games.length : 0,
    }))
    .sort((a, b) => b.winPct - a.winPct);

  if (summaryRows.length === 0) {
    resultsBox.innerHTML = `<p>No games matched this query.</p>`;
    return;
  }

  resultsBox.innerHTML = `
    <div class="query-results-card">
      <table class="query-results-table">
        <thead>
          <tr>
            <th></th>
            <th>Team</th>
            <th>Games</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win %</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows.map(row => {
            const safeId = row.team.replaceAll(" ", "-").replaceAll("'", "");
            const teamGamesForQuery = sortTeamRows(row.games);

            return `
              <tr class="query-team-row" onclick="toggleQueryGames('${row.team.replaceAll("'", "\\'")}')">
                <td class="expand-arrow">▶</td>
                <td><span class="query-team-name">${row.team}</span></td>
                <td>${row.gameCount}</td>
                <td>${row.wins}</td>
                <td>${row.losses}</td>
                <td>${(row.winPct * 100).toFixed(1)}%</td>
              </tr>

              <tr class="query-games-row" id="query-games-${safeId}" style="display: none;">
                <td colspan="6">
                  <table class="query-games-inner">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Game #</th>
                        <th>Opponent</th>
                        <th>Result</th>
                        <th>Team Score</th>
                        <th>Opponent Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${teamGamesForQuery.map(game => `
                        <tr>
                          <td>
                            <a
                              class="game-detail-link"
                              href="./game.html?game_id=${encodeURIComponent(game.game_id)}"
                              target="_blank"
                            >
                              ${game.game_date || ""} — Game ${game.game_number || ""}
                            </a>
                          </td>
                          <td>${game.game_number || ""}</td>
                          <td>${game.opponent_name || ""}</td>
                          <td>${getTeamResultFromComparison(game)}</td>
                          <td>${game.self_team_score ?? ""}</td>
                          <td>${game.opp_team_score ?? ""}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function toggleQueryGames(teamName) {
  const safeId = teamName.replaceAll(" ", "-").replaceAll("'", "");
  const row = document.getElementById(`query-games-${safeId}`);

  if (!row) return;

  const isHidden = row.style.display === "none";

  row.style.display = isHidden ? "table-row" : "none";

  const triggerRow = row.previousElementSibling;
  const arrow = triggerRow.querySelector(".expand-arrow");

  if (arrow) {
    arrow.textContent = isHidden ? "▼" : "▶";
  }
}

function clearQuery() {
  queryConditions = [];
  renderActiveConditions();

  const resultsBox = document.getElementById("queryResults");
  if (resultsBox) resultsBox.innerHTML = "";
}

function setupQueryButtons() {
  document
    .getElementById("addConditionBtn")
    ?.addEventListener("click", addQueryCondition);

  document
    .getElementById("runQueryBtn")
    ?.addEventListener("click", runTeamQuery);

  document
    .getElementById("clearQueryBtn")
    ?.addEventListener("click", clearQuery);
}

async function initDashboard() {
  const status = document.getElementById("statusMessage");

  try {
    // For charting (original team data)
    teamGames = await loadCSV(CSV_URLS.team_games);

    // For queries (self + opponent stats)
    teamComparisonRows = await loadCSV(CSV_URLS.team_comparison);

    const availableStats = getAvailableStats(teamGames, ALL_STATS);

    if (Object.keys(availableStats).length === 0) {
      throw new Error("No stat columns matched. Check ALL_STATS column names.");
    }

    teamDiffRows = createTeamGameDifferentials(teamGames, availableStats);

    teamOrder = [...new Set(teamDiffRows.map(row => row.team_name))]
      .filter(Boolean)
      .sort();

    populateStatDropdown(availableStats); // charts
    populateQueryControls();             // query dropdowns
    setupQueryButtons();                 // query buttons
    renderActiveConditions();            // show active conditions

    const firstStatLabel = Object.keys(availableStats)[0];
    renderTeamStatChart(firstStatLabel, availableStats[firstStatLabel]);

    renderDataSummary(availableStats);
  } catch (error) {
    console.error("Dashboard failed to load:", error);

    if (status) {
      status.textContent = "Dashboard failed to load. Check browser console.";
      status.classList.add("error");
    }
  }
}

initDashboard();