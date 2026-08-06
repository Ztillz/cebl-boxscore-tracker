const PAYROLL_DATA_URL =
  "./data/opponent_payroll_faced_2026.csv";

const TEAM_SUMMARY_URL =
  "./data/team_payroll_summary_2026.csv";


let payrollRows = [];
let teamSummaryRows = [];


// ============================================================
// DATA LOADING
// ============================================================

function loadCSV(url) {
  return new Promise((resolve, reject) => {

    Papa.parse(url, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,

      complete: results => {
        resolve(results.data);
      },

      error: error => {
        reject(error);
      },
    });

  });
}


// ============================================================
// BASIC HELPERS
// ============================================================

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function formatCurrency(value) {
  const number = numberOrNull(value);

  if (number === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-CA",
    {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }
  ).format(number);
}


function formatCompactCurrency(value) {
  const number = numberOrNull(value);

  if (number === null) {
    return "—";
  }

  if (Math.abs(number) >= 1000) {
    return `$${(number / 1000).toFixed(1)}K`;
  }

  return `$${number.toFixed(0)}`;
}


function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-CA",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  );
}


function clamp(
  value,
  minimum,
  maximum
) {
  return Math.min(
    Math.max(
      value,
      minimum
    ),
    maximum
  );
}


// ============================================================
// COLOR SCALE
// ============================================================

function interpolateRGB(
  start,
  end,
  amount
) {
  return {
    r: Math.round(
      start.r +
      (
        end.r - start.r
      ) * amount
    ),

    g: Math.round(
      start.g +
      (
        end.g - start.g
      ) * amount
    ),

    b: Math.round(
      start.b +
      (
        end.b - start.b
      ) * amount
    ),
  };
}


function getPayrollColor(
  value,
  leagueAverage,
  minPayroll,
  maxPayroll
) {

  const yellow = {
    r: 255,
    g: 230,
    b: 109,
  };

  const orange = {
    r: 245,
    g: 158,
    b: 11,
  };

  const red = {
    r: 220,
    g: 38,
    b: 38,
  };


  let rgb;


  // ==========================================================
  // BELOW AVERAGE
  //
  // Minimum = yellow
  // Average = orange
  // ==========================================================

  if (value <= leagueAverage) {

    const range = Math.max(
      leagueAverage - minPayroll,
      1
    );

    const amount = clamp(
      (
        value - minPayroll
      ) / range,
      0,
      1
    );

    rgb = interpolateRGB(
      yellow,
      orange,
      amount
    );
  }


  // ==========================================================
  // ABOVE AVERAGE
  //
  // Average = orange
  // Maximum = red
  // ==========================================================

  else {

    const range = Math.max(
      maxPayroll - leagueAverage,
      1
    );

    const amount = clamp(
      (
        value - leagueAverage
      ) / range,
      0,
      1
    );

    rgb = interpolateRGB(
      orange,
      red,
      amount
    );
  }


  return rgb;
}


function rgbToCSS(rgb) {
  return (
    `rgb(` +
    `${rgb.r}, ` +
    `${rgb.g}, ` +
    `${rgb.b}` +
    `)`
  );
}


function getReadableTextColor(rgb) {

  const brightness =
    (
      rgb.r * 299 +
      rgb.g * 587 +
      rgb.b * 114
    ) / 1000;

  return brightness > 145
    ? "#111827"
    : "#ffffff";
}


// ============================================================
// TEAM ORDER
// ============================================================

function getTeams(rows) {
  return [
    ...new Set(
      rows
        .map(row => row.team_name)
        .filter(Boolean)
    )
  ].sort();
}


// ============================================================
// LEAGUE AVERAGE
// ============================================================

function getLeagueAverage(rows) {

  const values = rows
    .map(
      row =>
        numberOrNull(
          row.opponent_payroll_faced
        )
    )
    .filter(
      value =>
        value !== null
    );


  if (values.length === 0) {
    return 0;
  }


  return (
    values.reduce(
      (total, value) =>
        total + value,
      0
    ) / values.length
  );
}


// ============================================================
// SUMMARY CARDS
// ============================================================

function renderSummary(rows) {

  const values = rows
    .map(
      row =>
        numberOrNull(
          row.opponent_payroll_faced
        )
    )
    .filter(
      value =>
        value !== null
    );


  if (values.length === 0) {
    return;
  }


  const average =
    getLeagueAverage(rows);


  const highest =
    Math.max(...values);


  const lowest =
    Math.min(...values);


  document.getElementById(
    "leagueAverage"
  ).textContent =
    formatCurrency(average);


  document.getElementById(
    "highestPayroll"
  ).textContent =
    formatCurrency(highest);


  document.getElementById(
    "lowestPayroll"
  ).textContent =
    formatCurrency(lowest);
}


// ============================================================
// TOOLTIP
// ============================================================

function showTooltip(
  event,
  row,
  leagueAverage
) {

  const tooltip =
    document.getElementById(
      "heatmapTooltip"
    );


  const payroll =
    numberOrNull(
      row.opponent_payroll_faced
    ) || 0;


  const difference =
    payroll - leagueAverage;


  const differenceText =
    difference >= 0
      ? `+${formatCurrency(difference)}`
      : `-${formatCurrency(Math.abs(difference))}`;


  const missingCount =
    numberOrNull(
      row.opponent_players_missing_salary
    ) || 0;


  tooltip.innerHTML = `
    <div class="tooltip-team">
      ${row.team_name}
    </div>

    <div class="tooltip-muted">
      Game ${row.game_number}
    </div>

    <div>
      vs ${row.actual_opponent_team || row.opponent_name || "—"}
    </div>

    <div>
      ${formatDate(row.game_date)}
    </div>

    <div class="tooltip-value">
      ${formatCurrency(payroll)}
    </div>

    <div class="tooltip-muted">
      League average:
      ${formatCurrency(leagueAverage)}
    </div>

    <div class="tooltip-muted">
      Difference:
      ${differenceText}
    </div>

    ${
      missingCount > 0
        ? `
          <div class="tooltip-zero-note">
            ${missingCount}
            unmatched player${missingCount === 1 ? "" : "s"}
            counted as $0
          </div>
        `
        : ""
    }
  `;


  tooltip.style.display =
    "block";


  moveTooltip(event);
}


function moveTooltip(event) {

  const tooltip =
    document.getElementById(
      "heatmapTooltip"
    );


  const offset = 16;


  let x =
    event.clientX + offset;


  let y =
    event.clientY + offset;


  const rect =
    tooltip.getBoundingClientRect();


  if (
    x + rect.width >
    window.innerWidth
  ) {

    x =
      event.clientX -
      rect.width -
      offset;

  }


  if (
    y + rect.height >
    window.innerHeight
  ) {

    y =
      event.clientY -
      rect.height -
      offset;

  }


  tooltip.style.left =
    `${x}px`;


  tooltip.style.top =
    `${y}px`;
}


function hideTooltip() {

  const tooltip =
    document.getElementById(
      "heatmapTooltip"
    );


  tooltip.style.display =
    "none";
}


// ============================================================
// HEATMAP
// ============================================================

function renderHeatmap(rows) {

  const container =
    document.getElementById(
      "payrollHeatmap"
    );


  container.innerHTML = "";


  const teams =
    getTeams(rows);


  const leagueAverage =
    getLeagueAverage(rows);


  const values = rows
    .map(
      row =>
        numberOrNull(
          row.opponent_payroll_faced
        )
    )
    .filter(
      value =>
        value !== null
    );


  if (values.length === 0) {
    return;
  }


  const minPayroll =
    Math.min(...values);


  const maxPayroll =
    Math.max(...values);


  const gameNumbers = rows
    .map(
      row =>
        Number(
          row.game_number
        )
    )
    .filter(
      value =>
        Number.isFinite(value)
    );


  if (gameNumbers.length === 0) {
    return;
  }


  const maxGameNumber =
    Math.max(...gameNumbers);


  container.style.gridTemplateColumns =
    `90px repeat(${teams.length}, 105px)`;


  // ==========================================================
  // CORNER
  // ==========================================================

  const corner =
    document.createElement(
      "div"
    );


  corner.className =
    "heatmap-corner";


  container.appendChild(
    corner
  );


  // ==========================================================
  // TEAM HEADERS
  // ==========================================================

  teams.forEach(team => {

    const header =
      document.createElement(
        "div"
      );


    header.className =
      "heatmap-team-header";


    header.textContent =
      team;


    container.appendChild(
      header
    );

  });


  // ==========================================================
  // LOOKUP
  // ==========================================================

  const lookup =
    new Map();


  rows.forEach(row => {

    const key =
      `${row.team_name}__${row.game_number}`;


    lookup.set(
      key,
      row
    );

  });


  // ==========================================================
  // GAME ROWS
  // ==========================================================

  for (
    let gameNumber = 1;
    gameNumber <= maxGameNumber;
    gameNumber++
  ) {

    const label =
      document.createElement(
        "div"
      );


    label.className =
      "heatmap-game-label";


    label.textContent =
      `Game ${gameNumber}`;


    container.appendChild(
      label
    );


    teams.forEach(team => {

      const key =
        `${team}__${gameNumber}`;


      const row =
        lookup.get(key);


      if (!row) {

        const empty =
          document.createElement(
            "div"
          );


        empty.className =
          "payroll-cell-empty";


        container.appendChild(
          empty
        );


        return;
      }


      const payroll =
        numberOrNull(
          row.opponent_payroll_faced
        ) || 0;


      const rgb =
        getPayrollColor(
          payroll,
          leagueAverage,
          minPayroll,
          maxPayroll
        );


      const cell =
        document.createElement(
          "div"
        );


      cell.className =
        "payroll-cell";


      cell.style.background =
        rgbToCSS(rgb);


      cell.style.color =
        getReadableTextColor(rgb);


      cell.textContent =
        formatCompactCurrency(
          payroll
        );


      cell.addEventListener(
        "mouseenter",
        event => {
          showTooltip(
            event,
            row,
            leagueAverage
          );
        }
      );


      cell.addEventListener(
        "mousemove",
        moveTooltip
      );


      cell.addEventListener(
        "mouseleave",
        hideTooltip
      );


      container.appendChild(
        cell
      );

    });

  }
}


// ============================================================
// TEAM METRIC TABLE
// ============================================================

// ============================================================
// TEAM METRIC TABLE
// ============================================================

let teamMetricsSortKey = "money_faced_rank";
let teamMetricsSortDirection = "asc";


function getTeamMetricSortValue(row, key, type) {

  if (type === "text") {
    return String(row[key] || "").toLowerCase();
  }

  const value = Number(row[key]);

  return Number.isFinite(value)
    ? value
    : 0;
}


function renderTeamMetrics(rows) {

  const body =
    document.getElementById(
      "teamMetricsBody"
    );


  body.innerHTML = "";


  const activeHeader =
    document.querySelector(
      `.sortable-header[data-sort-key="${teamMetricsSortKey}"]`
    );


  const sortType =
    activeHeader?.dataset.sortType ||
    "number";


  const sortedRows = [...rows].sort(
    (a, b) => {

      const aValue =
        getTeamMetricSortValue(
          a,
          teamMetricsSortKey,
          sortType
        );

      const bValue =
        getTeamMetricSortValue(
          b,
          teamMetricsSortKey,
          sortType
        );


      let comparison = 0;


      if (sortType === "text") {

        comparison =
          aValue.localeCompare(
            bValue
          );

      }

      else {

        comparison =
          aValue - bValue;

      }


      return teamMetricsSortDirection === "asc"
        ? comparison
        : -comparison;

    }
  );


  body.innerHTML =
    sortedRows.map(row => {

      const rank =
        Number(
          row.money_faced_rank
        );


      const wins =
        Number(
          row.wins || 0
        );


      const losses =
        Number(
          row.losses || 0
        );


      let rankClass = "";

      if (rank === 1) {
        rankClass = "rank-first";
      }

      else if (rank === 2) {
        rankClass = "rank-second";
      }

      else if (rank === 3) {
        rankClass = "rank-third";
      }


      return `
        <tr>

          <td>

            <span
              class="rank-number ${rankClass}"
            >
              ${rank}
            </span>

          </td>


          <td class="ranking-team">
            ${row.team_name}
          </td>


          <td>
            ${wins}-${losses}
          </td>


          <td>
            ${formatCurrency(
              row.game_spending_in_wins
            )}
          </td>


          <td>
            ${formatCurrency(
              row.game_spending_in_losses
            )}
          </td>


          <td class="spend-per-win">
            ${formatCurrency(
              row.total_spending_per_season_win
            )}
          </td>


          <td>
            ${formatCurrency(
              row.average_money_faced
            )}
          </td>


          <td>
            ${formatCurrency(
              row.total_money_faced
            )}
          </td>

        </tr>
      `;

    }).join("");


  updateTeamMetricSortIndicators();

}


function updateTeamMetricSortIndicators() {

  document
    .querySelectorAll(
      ".sortable-header"
    )
    .forEach(header => {

      const indicator =
        header.querySelector(
          ".sort-indicator"
        );


      if (!indicator) {
        return;
      }


      if (
        header.dataset.sortKey ===
        teamMetricsSortKey
      ) {

        indicator.textContent =
          teamMetricsSortDirection === "asc"
            ? " ▲"
            : " ▼";

      }

      else {

        indicator.textContent = "";

      }

    });

}


function setupTeamMetricSorting() {

  const headers =
    document.querySelectorAll(
      ".sortable-header"
    );


  headers.forEach(header => {

    header.addEventListener(
      "click",
      () => {

        const sortKey =
          header.dataset.sortKey;


        if (
          teamMetricsSortKey ===
          sortKey
        ) {

          teamMetricsSortDirection =
            teamMetricsSortDirection === "asc"
              ? "desc"
              : "asc";

        }

        else {

          teamMetricsSortKey =
            sortKey;


          teamMetricsSortDirection =
            header.dataset.sortType === "text"
              ? "asc"
              : "desc";

        }


        renderTeamMetrics(
          teamSummaryRows
        );

      }
    );

  });


  updateTeamMetricSortIndicators();

}


// ============================================================
// INIT
// ============================================================

async function init() {

  try {

    const [
      loadedPayrollRows,
      loadedTeamSummaryRows
    ] = await Promise.all([

      loadCSV(
        PAYROLL_DATA_URL
      ),

      loadCSV(
        TEAM_SUMMARY_URL
      ),

    ]);


    payrollRows =
      loadedPayrollRows.filter(
        row =>
          row.team_name &&
          numberOrNull(
            row.game_number
          ) !== null
      );


    teamSummaryRows =
      loadedTeamSummaryRows.filter(
        row =>
          row.team_name
      );


    renderSummary(
      payrollRows
    );


    renderHeatmap(
      payrollRows
    );


    renderTeamMetrics(
      teamSummaryRows
    );
    setupTeamMetricSorting();

  }

  catch (error) {

    console.error(
      "Payroll dashboard failed:",
      error
    );

  }

}


init();