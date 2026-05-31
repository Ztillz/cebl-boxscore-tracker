const BASE_URL =
  "https://raw.githubusercontent.com/Ztillz/cebl-boxscore-tracker/main/data/processed";

const CSV_URLS = {
  team_games: `${BASE_URL}/team_games_2026.csv`,
  player_games: `${BASE_URL}/player_games_2026.csv`,
};

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

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function numberOrZero(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function initGamePage() {
  const gameId = getParam("game_id");

  if (!gameId) {
    document.getElementById("gameTitle").textContent = "No game selected";
    return;
  }

  const [teamGames, playerGames] = await Promise.all([
    loadCSV(CSV_URLS.team_games),
    loadCSV(CSV_URLS.player_games),
  ]);

  const gameTeams = teamGames.filter(row => String(row.game_id) === String(gameId));
  const gamePlayers = playerGames.filter(row => String(row.game_id) === String(gameId));

  if (gameTeams.length === 0) {
    document.getElementById("gameTitle").textContent = "Game not found";
    return;
  }

  const gameDate = gameTeams[0].game_date;
  const matchup = gameTeams.map(row => row.team_name).join(" vs ");

  document.getElementById("gameTitle").textContent = matchup;
  document.getElementById("gameSubtitle").textContent = `${gameDate} | Game ID: ${gameId}`;

  renderTeamComparison(gameTeams);
  renderPlayerScoring(gamePlayers);
}

function renderTeamComparison(gameTeams) {
  const stats = [
    { label: "Points", col: "team_score" },
    { label: "Rebounds", col: "rebounds" },
    { label: "Assists", col: "assists" },
    { label: "Turnovers", col: "turnovers" },
    { label: "Steals", col: "steals" },
    { label: "Blocks", col: "blocks" },
    { label: "3PA", col: "three_point_field_goals_attempted" },
    { label: "FTA", col: "free_throws_attempted" },
  ];

  const traces = gameTeams.map(team => ({
    x: stats.map(stat => stat.label),
    y: stats.map(stat => numberOrZero(team[stat.col])),
    type: "bar",
    name: team.team_name,
  }));

  Plotly.newPlot("gameTeamChart", traces, {
    barmode: "group",
    height: 500,
    template: "plotly_white",
    yaxis: { title: "Total" },
  }, {
    responsive: true,
  });
}

function renderPlayerScoring(gamePlayers) {
    
  const chartContainer = document.getElementById("gamePlayerChart");

  const uniqueTeams = [...new Set(gamePlayers.map(p => p.team_name))];
  const teamColors = [
  "#1e6bd6",
  "#d64b1e",
    ];

  if (uniqueTeams.length === 0) return;

  let currentTeamIndex = 0;

  chartContainer.innerHTML = `
    <div class="game-player-controls">
      <button id="togglePlayerTeamBtn">
        Show ${uniqueTeams[0]}
      </button>
    </div>

    <div id="playerScoringPlot"></div>
  `;

  const button = document.getElementById("togglePlayerTeamBtn");

  function renderTeamChart(teamName) {
    const filteredPlayers = gamePlayers
      .filter(player => player.team_name === teamName)
      .filter(player => numberOrZero(player.points) > 0)
      .sort((a, b) => numberOrZero(b.points) - numberOrZero(a.points));

    const trace = {
        x: filteredPlayers.map(player => player.player_name),
        y: filteredPlayers.map(player => numberOrZero(player.points)),
        type: "bar",
        marker: {
        color: teamColors[currentTeamIndex % teamColors.length],
     },
      hovertemplate:
        "<b>%{x}</b><br>" +
        "Points: %{y}<extra></extra>",
    };

    Plotly.newPlot(
      "playerScoringPlot",
      [trace],
      {
        title: `${teamName} Player Scoring`,
        height: 600,
        template: "plotly_white",
        xaxis: {
          title: "Player",
          tickangle: -45,
        },
        yaxis: {
          title: "Points",
        },
        margin: {
          b: 150,
        },
      },
      {
        responsive: true,
      }
    );
  }

  renderTeamChart(uniqueTeams[currentTeamIndex]);

  function updateButtonStyle(teamIndex) {
  button.style.backgroundColor =
    teamColors[teamIndex % teamColors.length];
}

updateButtonStyle(currentTeamIndex);

button.addEventListener("click", () => {
  currentTeamIndex =
    (currentTeamIndex + 1) % uniqueTeams.length;

  const currentTeam = uniqueTeams[currentTeamIndex];

  button.textContent = `Show ${currentTeam}`;

  updateButtonStyle(currentTeamIndex);

  renderTeamChart(currentTeam);
});
}

initGamePage();