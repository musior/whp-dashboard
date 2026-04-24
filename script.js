const TARGET = 85;

const TME_COLS = [
  "TME_PICK_R_PROD",
  "TME_PICK_A_PROD",
  "TME_MISSIONS_PROD",
  "TME_EXPORTS_PROD",
  "TME_FOIL_PROD",
  "TME_LOADING_PROD",
  "TME_UNLOADING_PROD",
  "TME_FPALLETS_PROD",
  "TME_SORT_PROD",
  "TME_MEZZ_PROD",
  "TME_XDOCK_PROD",
  "TME_CONTROL_PROD",
  "TME_VAS_PROD",
];
const SOL_COLS = [
  "SOL_PICK_R_PROD",
  "SOL_PICK_A_PROD",
  "SOL_MISSIONS_PROD",
  "SOL_EXPORTS_PROD",
  "SOL_FOIL_PROD",
  "SOL_LOADING_PROD",
  "SOL_UNLOADING_PROD",
  "SOL_FPALLETS_PROD",
  "SOL_SORT_PROD",
  "SOL_MEZZ_PROD",
  "SOL_XDOCK_PROD",
  "SOL_CONTROL_PROD",
  "SOL_VAS_PROD",
];

const PROC_LABEL = {
  TME_PICK_R_PROD: "Picking regały",
  TME_PICK_A_PROD: "Picking antresola",
  TME_MISSIONS_PROD: "Misje",
  TME_EXPORTS_PROD: "Kontrola exportów",
  TME_FOIL_PROD: "Foliowanie",
  TME_LOADING_PROD: "Załadunki",
  TME_UNLOADING_PROD: "Rozładunki",
  TME_FPALLETS_PROD: "Wstawianie palet",
  TME_SORT_PROD: "Sortowanie",
  TME_MEZZ_PROD: "Wstawianie drobnica",
  TME_XDOCK_PROD: "XDOCK",
  TME_CONTROL_PROD: "Check&Pack",
  TME_VAS_PROD: "VAS",
  SOL_PICK_R_PROD: "Picking regały",
  SOL_PICK_A_PROD: "Picking antresola",
  SOL_MISSIONS_PROD: "Misje",
  SOL_EXPORTS_PROD: "Kontrola exportów",
  SOL_FOIL_PROD: "Foliowanie",
  SOL_LOADING_PROD: "Załadunki",
  SOL_UNLOADING_PROD: "Rozładunki",
  SOL_FPALLETS_PROD: "Wstawianie palet",
  SOL_SORT_PROD: "Sortowanie",
  SOL_MEZZ_PROD: "Wstawianie drobnica",
  SOL_XDOCK_PROD: "XDOCK",
  SOL_CONTROL_PROD: "Check&Pack",
  SOL_VAS_PROD: "VAS",
};

const MONTHS_PL = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];
const MONTHS_GEN = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

let appData = null;
let mainChart = null,
  dayChart = null;
let selectedDay = null;
let activeSegment = "TME"; // 'TME' | 'SOL'

// ── Parser wartości (przecinek decimal, Infinity/0 → null) ──
function pv(raw) {
  const s = String(raw === undefined || raw === null ? "" : raw).trim();
  if (!s || s === "Infinity" || s === "-Infinity") return null;
  const v = parseFloat(s.replace(",", "."));
  return !isNaN(v) && v > 0 ? v : null;
}

// ── Parser CSV ──
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("Plik jest pusty.");
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0]
    .split(sep)
    .map((h) => h.trim().replace(/^"|"$/g, ""));

  for (const r of [
    "DATE",
    "TYPE",
    ...TME_COLS,
    ...SOL_COLS,
    "TME_PROD",
    "SOL_PROD",
    "TOTAL_PROD",
  ]) {
    if (!headers.includes(r)) throw new Error(`Brak kolumny: ${r}`);
  }

  const rows = lines
    .slice(1)
    .map((l) => {
      const parts = l.split(sep);
      const o = {};
      headers.forEach(
        (h, i) => (o[h] = (parts[i] || "").trim().replace(/^"|"$/g, "")),
      );
      return o;
    })
    .filter((r) => r.TYPE === "MONTH_TOTAL" || r.TYPE === "TOTAL");

  const monthRow = rows.find((r) => r.TYPE === "MONTH_TOTAL");
  const dailyRows = rows.filter((r) => r.TYPE === "TOTAL");
  if (!monthRow) throw new Error("Brak wiersza TYPE=MONTH_TOTAL.");
  if (!dailyRows.length) throw new Error("Brak wierszy TYPE=TOTAL.");

  const dateStr = monthRow.DATE || dailyRows[0].DATE || "";
  const dm = dateStr.match(/^(\d{4})-(\d{2})/);
  if (!dm) throw new Error("Nieznany format daty: " + dateStr);
  const year = +dm[1],
    month = +dm[2];
  const monthLabel = `${MONTHS_PL[month - 1]} ${year}`;

  // Wartości miesięczne
  const monthValues = { TME: {}, SOL: {} };
  TME_COLS.forEach((c) => (monthValues.TME[c] = pv(monthRow[c])));
  SOL_COLS.forEach((c) => (monthValues.SOL[c] = pv(monthRow[c])));
  const tmeProdMonth = pv(monthRow["TME_PROD"]);
  const solProdMonth = pv(monthRow["SOL_PROD"]);

  // Wartości dzienne
  const dailyValues = { TME: {}, SOL: {} };
  const dailyTotals = {},
    dailyTmeProd = {},
    dailySolProd = {};
  dailyRows.forEach((r) => {
    const m = r.DATE.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (!m) return;
    const date = m[1];
    dailyValues.TME[date] = {};
    dailyValues.SOL[date] = {};
    TME_COLS.forEach((c) => (dailyValues.TME[date][c] = pv(r[c])));
    SOL_COLS.forEach((c) => (dailyValues.SOL[date][c] = pv(r[c])));
    dailyTotals[date] = pv(r.TOTAL_PROD);
    dailyTmeProd[date] = pv(r.TME_PROD);
    dailySolProd[date] = pv(r.SOL_PROD);
  });

  const activeDays = Object.keys(dailyValues.TME).sort();

  // Prekalkuluj maksima osi Y (górny wykres: max wartości procesów; dolny: max daily prod)
  function calcYMax(vals) {
    const clean = vals.filter((v) => v !== null);
    if (!clean.length) return 110;
    const raw = Math.max(...clean);
    return Math.ceil(Math.min(raw * 1.12, raw + 50) / 10) * 10;
  }

  const tmeMonthMax = calcYMax(TME_COLS.map((c) => monthValues.TME[c]));
  const solMonthMax = calcYMax(SOL_COLS.map((c) => monthValues.SOL[c]));
  const tmeDailyMax = calcYMax(activeDays.map((dt) => dailyTmeProd[dt]));
  const solDailyMax = calcYMax(activeDays.map((dt) => dailySolProd[dt]));

  // Max per dzień (dla górnego wykresu przy filtrowaniu)
  const tmeDayMax = {},
    solDayMax = {};
  activeDays.forEach((dt) => {
    tmeDayMax[dt] = calcYMax(TME_COLS.map((c) => dailyValues.TME[dt][c]));
    solDayMax[dt] = calcYMax(SOL_COLS.map((c) => dailyValues.SOL[dt][c]));
  });

  return {
    year,
    month,
    monthLabel,
    monthValues,
    tmeProdMonth,
    solProdMonth,
    dailyValues,
    dailyTotals,
    dailyTmeProd,
    dailySolProd,
    activeDays,
    yMax: {
      tmeMonth: tmeMonthMax,
      solMonth: solMonthMax,
      tmeDaily: tmeDailyMax,
      solDaily: solDailyMax,
      tmeDayProc: tmeDayMax,
      solDayProc: solDayMax,
    },
  };
}

// ── Formatowanie daty ──
function fmtDate(s) {
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MONTHS_GEN[+m[2] - 1]} ${m[1]}` : s;
}

// ── Kolory ──
function bgColor(v, a) {
  if (v === null) return `rgba(74,80,104,${a || 0.45})`;
  return v >= TARGET
    ? `rgba(79,142,247,${a || 0.75})`
    : `rgba(248,113,113,${a || 0.75})`;
}
function bdColor(v) {
  if (v === null) return "rgba(74,80,104,0.55)";
  return v >= TARGET ? "#4f8ef7" : "#f87171";
}

// ── Drop zone ──
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const dropError = document.getElementById("dropError");

document.getElementById("browseBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) readFile(e.target.files[0]);
});
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("drag-over"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
});
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => {
  e.preventDefault();
  if (
    !document.getElementById("dropScreen").classList.contains("hidden") &&
    e.dataTransfer.files[0]
  )
    readFile(e.dataTransfer.files[0]);
});

function showErr(msg) {
  dropError.textContent = msg;
  dropError.classList.add("visible");
}

function readFile(file) {
  dropError.classList.remove("visible");
  if (!/\.(csv|txt)$/i.test(file.name)) {
    showErr(
      "Obsługiwany format: .csv — pobierz plik z SharePointa i przeciągnij tutaj.",
    );
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      appData = parseCSV(e.target.result);
      initDashboard();
    } catch (err) {
      showErr("Błąd: " + err.message);
    }
  };
  reader.readAsText(file, "UTF-8");
}

function resetToDrop() {
  document.getElementById("dropScreen").classList.remove("hidden");
  document.getElementById("dashboard").classList.remove("visible");
  fileInput.value = "";
  dropError.classList.remove("visible");
  if (mainChart) {
    mainChart.destroy();
    mainChart = null;
  }
  if (dayChart) {
    dayChart.destroy();
    dayChart = null;
  }
  appData = null;
  selectedDay = null;
}

// ── Init dashboard ──
function initDashboard() {
  document.getElementById("dropScreen").classList.add("hidden");
  document.getElementById("dashboard").classList.add("visible");
  selectedDay = null;
  activeSegment = "TME";
  document.getElementById("btnTME").classList.add("active");
  document.getElementById("btnSOL").classList.remove("active");

  document.getElementById("monthLabel").textContent = appData.monthLabel;
  document.getElementById("headerMeta").textContent =
    `Centrum Dystrybucyjne · ${appData.monthLabel}`;

  const dayLabels = appData.activeDays.map((dt) => dt.slice(8));
  const seg = activeSegment;
  const cols = seg === "TME" ? TME_COLS : SOL_COLS;
  const mVals = cols.map((c) => appData.monthValues[seg][c]);
  const yMaxMain = appData.yMax[seg === "TME" ? "tmeMonth" : "solMonth"];
  const dayProd = appData.activeDays.map((dt) =>
    seg === "TME" ? appData.dailyTmeProd[dt] : appData.dailySolProd[dt],
  );
  const yMaxDay = appData.yMax[seg === "TME" ? "tmeDaily" : "solDaily"];

  // MAIN CHART
  const mc = document.getElementById("mainChart").getContext("2d");
  if (mainChart) mainChart.destroy();
  mainChart = new Chart(mc, {
    type: "bar",
    data: {
      labels: cols.map((c) => PROC_LABEL[c]),
      datasets: [
        {
          label: "Produktywność (%)",
          data: mVals,
          backgroundColor: mVals.map((v) => bgColor(v, 0.75)),
          borderColor: mVals.map((v) => bdColor(v)),
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: "Cel",
          data: new Array(cols.length).fill(TARGET),
          type: "line",
          borderColor: "#f59e0b",
          borderDash: [5, 4],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350, easing: "easeInOutQuart" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2535",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleColor: "#e8eaf2",
          bodyColor: "#7b82a0",
          padding: 10,
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 1) return null;
              const v = ctx.parsed.y;
              return v != null
                ? ` ${v >= TARGET ? "✓" : "✗"} ${v.toFixed(1)}%`
                : " Brak danych";
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#7b82a0",
            font: { size: 11, family: "'DM Mono'" },
            autoSkip: false,
          },
          border: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          min: 0,
          max: yMaxMain,
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#7b82a0",
            font: { size: 11 },
            callback: (v) => v + "%",
          },
          border: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });

  // DAY CHART
  const dc = document.getElementById("dayChart").getContext("2d");
  if (dayChart) dayChart.destroy();
  dayChart = new Chart(dc, {
    type: "bar",
    data: {
      labels: dayLabels,
      datasets: [
        {
          label: `${seg}_PROD (%)`,
          data: dayProd,
          backgroundColor: dayProd.map((v) => bgColor(v, 0.7)),
          borderColor: dayProd.map((v) => bdColor(v)),
          borderWidth: 1,
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: "Cel",
          data: new Array(dayLabels.length).fill(TARGET),
          type: "line",
          borderColor: "#f59e0b",
          borderDash: [4, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      onClick: (evt, els) => {
        if (!els.length) return;
        const date = appData.activeDays[els[0].index];
        if (selectedDay === date) clearFilter();
        else selectDay(date);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e2535",
          borderColor: "rgba(255,255,255,0.1)",
          borderWidth: 1,
          titleColor: "#e8eaf2",
          bodyColor: "#7b82a0",
          padding: 10,
          callbacks: {
            title: (ctx) => fmtDate(appData.activeDays[ctx[0].dataIndex]),
            label: (ctx) => {
              if (ctx.datasetIndex === 1) return null;
              const v = ctx.parsed.y;
              return v != null
                ? ` ${activeSegment}_PROD: ${v.toFixed(1)}%`
                : " Brak danych";
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#4a5068",
            font: { size: 10, family: "'DM Mono'" },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 16,
          },
          border: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          min: 0,
          max: yMaxDay,
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#4a5068",
            font: { size: 10 },
            callback: (v) => v + "%",
          },
          border: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });

  updateLabels();
  updateMetrics(null);
  renderTable(null);
  setChartHeights();
}

// ── Przełącznik segmentu TME / SOL ──
function setSegment(seg) {
  if (seg === activeSegment) return;
  activeSegment = seg;
  selectedDay = null;

  document.getElementById("btnTME").classList.toggle("active", seg === "TME");
  document.getElementById("btnSOL").classList.toggle("active", seg === "SOL");
  document.getElementById("filterTag").classList.remove("visible");
  document.getElementById("nodataTag").classList.remove("visible");

  const cols = seg === "TME" ? TME_COLS : SOL_COLS;
  const mVals = cols.map((c) => appData.monthValues[seg][c]);
  const yMaxMain = appData.yMax[seg === "TME" ? "tmeMonth" : "solMonth"];
  const dayProd = appData.activeDays.map((dt) =>
    seg === "TME" ? appData.dailyTmeProd[dt] : appData.dailySolProd[dt],
  );
  const yMaxDay = appData.yMax[seg === "TME" ? "tmeDaily" : "solDaily"];

  mainChart.data.labels = cols.map((c) => PROC_LABEL[c]);
  mainChart.data.datasets[0].data = mVals;
  mainChart.data.datasets[0].backgroundColor = mVals.map((v) =>
    bgColor(v, 0.75),
  );
  mainChart.data.datasets[0].borderColor = mVals.map((v) => bdColor(v));
  mainChart.data.datasets[1].data = new Array(cols.length).fill(TARGET);
  mainChart.options.scales.y.max = yMaxMain;
  mainChart.update();

  dayChart.data.datasets[0].data = dayProd;
  dayChart.data.datasets[0].backgroundColor = dayProd.map((v) =>
    bgColor(v, 0.7),
  );
  dayChart.data.datasets[0].borderColor = dayProd.map((v) => bdColor(v));
  dayChart.options.scales.y.max = yMaxDay;
  dayChart.update();

  updateLabels();
  updateMetrics(null);
  renderTable(null);
}

// ── Aktualizacja etykiet tekstowych ──
function updateLabels() {
  const seg = activeSegment;
  const titleSuffix = selectedDay
    ? `— ${fmtDate(selectedDay)}`
    : "— cały miesiąc";
  document.getElementById("mainChartTitle").textContent =
    `Produktywność per proces ${titleSuffix}`;
  document.getElementById("chartSubtitle").textContent =
    `Wartości [%] · Cel: 85% · procesy ${seg}`;
  document.getElementById("dayChartLabel").textContent =
    `Dzienna produktywność magazynu (${seg}_PROD)`;
  document.getElementById("prodMetricLabel").textContent =
    `Produktywność ${seg}`;
}

// ── Filtrowanie dnia ──
function selectDay(date) {
  selectedDay = date;
  const seg = activeSegment;
  const cols = seg === "TME" ? TME_COLS : SOL_COLS;
  const vals = cols.map(
    (c) => (appData.dailyValues[seg][date] || {})[c] || null,
  );
  const hasAny = vals.some((v) => v !== null);
  const yMaxProc =
    appData.yMax[seg === "TME" ? "tmeDayProc" : "solDayProc"][date] || 110;

  mainChart.data.datasets[0].data = vals;
  mainChart.data.datasets[0].backgroundColor = vals.map((v) =>
    bgColor(v, 0.75),
  );
  mainChart.data.datasets[0].borderColor = vals.map((v) => bdColor(v));
  mainChart.options.scales.y.max = yMaxProc;
  mainChart.update();

  const selIdx = appData.activeDays.indexOf(date);
  const dayProd = appData.activeDays.map((dt) =>
    seg === "TME" ? appData.dailyTmeProd[dt] : appData.dailySolProd[dt],
  );
  dayChart.data.datasets[0].backgroundColor = appData.activeDays.map((dt, i) =>
    i === selIdx ? "#4f8ef7" : bgColor(dayProd[i], 0.18),
  );
  dayChart.data.datasets[0].borderColor = appData.activeDays.map((dt, i) =>
    i === selIdx ? "#4f8ef7" : bgColor(dayProd[i], 0.4),
  );
  dayChart.update();

  document.getElementById("filterTag").classList.add("visible");
  document.getElementById("filterLabel").textContent = fmtDate(date);
  document.getElementById("nodataTag").classList.toggle("visible", !hasAny);
  updateLabels();
  updateMetrics(date);
  renderTable(date);
}

function clearFilter() {
  selectedDay = null;
  const seg = activeSegment;
  const cols = seg === "TME" ? TME_COLS : SOL_COLS;
  const mVals = cols.map((c) => appData.monthValues[seg][c]);
  const yMaxMain = appData.yMax[seg === "TME" ? "tmeMonth" : "solMonth"];
  const dayProd = appData.activeDays.map((dt) =>
    seg === "TME" ? appData.dailyTmeProd[dt] : appData.dailySolProd[dt],
  );
  const yMaxDay = appData.yMax[seg === "TME" ? "tmeDaily" : "solDaily"];

  mainChart.data.datasets[0].data = mVals;
  mainChart.data.datasets[0].backgroundColor = mVals.map((v) =>
    bgColor(v, 0.75),
  );
  mainChart.data.datasets[0].borderColor = mVals.map((v) => bdColor(v));
  mainChart.options.scales.y.max = yMaxMain;
  mainChart.update();

  dayChart.data.datasets[0].backgroundColor = dayProd.map((v) =>
    bgColor(v, 0.7),
  );
  dayChart.data.datasets[0].borderColor = dayProd.map((v) => bdColor(v));
  dayChart.options.scales.y.max = yMaxDay;
  dayChart.update();

  document.getElementById("filterTag").classList.remove("visible");
  document.getElementById("nodataTag").classList.remove("visible");
  updateLabels();
  updateMetrics(null);
  renderTable(null);
}

// ── Metryki ──
function updateMetrics(day) {
  const seg = activeSegment;
  const cols = seg === "TME" ? TME_COLS : SOL_COLS;
  let vals;
  if (day === null) vals = cols.map((c) => appData.monthValues[seg][c]);
  else vals = cols.map((c) => (appData.dailyValues[seg][day] || {})[c] || null);

  const active = vals.filter((v) => v !== null);
  const below = active.filter((v) => v < TARGET).length;
  const best = active.length ? Math.max(...active) : null;
  const bestIdx = best !== null ? vals.indexOf(best) : -1;

  const prod =
    day === null
      ? seg === "TME"
        ? appData.tmeProdMonth
        : appData.solProdMonth
      : (seg === "TME"
          ? appData.dailyTmeProd[day]
          : appData.dailySolProd[day]) || null;

  document.getElementById("avgMetric").textContent =
    prod != null ? prod.toFixed(1) + "%" : "—";
  document.getElementById("avgMetric").className =
    "metric-value " +
    (prod == null ? "neutral" : prod >= TARGET ? "good" : "bad");
  document.getElementById("avgDelta").textContent = day
    ? fmtDate(day)
    : `${seg}_PROD (miesiąc)`;
  document.getElementById("belowMetric").textContent = active.length
    ? below
    : "—";
  document.getElementById("bestMetric").textContent =
    bestIdx >= 0 ? PROC_LABEL[cols[bestIdx]] : "—";
  document.getElementById("bestVal").textContent =
    best != null ? best.toFixed(1) + "%" : "—";

  if (day === null) {
    const dwd = appData.activeDays.filter(
      (dt) =>
        (seg === "TME"
          ? appData.dailyTmeProd[dt]
          : appData.dailySolProd[dt]) !== null,
    ).length;
    document.getElementById("daysMetric").textContent = dwd;
    document.getElementById("daysSub").textContent =
      `z ${appData.activeDays.length} dni`;
  } else {
    document.getElementById("daysMetric").textContent = active.length;
    document.getElementById("daysSub").textContent = "aktywnych procesów";
  }
}

// ── Tabela ──
function renderTable(day) {
  const seg = activeSegment;
  const cols = seg === "TME" ? TME_COLS : SOL_COLS;
  const tbody = document.getElementById("reasonBody");
  let rows = [];

  if (day === null) {
    // Wszystkie dni — szukamy w dailyValues
    appData.activeDays.forEach((dt) => {
      const dv = appData.dailyValues[seg][dt] || {};
      cols.forEach((col) => {
        const v = dv[col];
        if (v !== null && v !== undefined && v < TARGET)
          rows.push({ date: fmtDate(dt), wc: PROC_LABEL[col], val: v });
      });
    });
  } else {
    // Konkretny dzień
    const dv = appData.dailyValues[seg][day] || {};
    cols.forEach((col) => {
      const v = dv[col];
      if (v !== null && v !== undefined && v < TARGET)
        rows.push({ date: fmtDate(day), wc: PROC_LABEL[col], val: v });
    });
  }

  document.getElementById("belowBadge").textContent =
    rows.length + " poniżej celu";

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">✓</div>Brak procesów poniżej normy</div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${r.date}</td>
      <td><span class="wc-tag">${r.wc}</span> <span class="val-tag">${r.val.toFixed(1)}%</span></td>
      <td><span class="pending-tag">oczekuje na dane z SharePointa</span></td>
    </tr>
  `,
    )
    .join("");
}

// ── Wysokości wykresów ──
function setChartHeights() {
  if (!mainChart || !dayChart) return;
  const hdrH = (document.querySelector(".header") || { offsetHeight: 53 })
    .offsetHeight;
  const totalH = window.innerHeight - hdrH;
  const mainH = Math.floor(totalH * 0.6);
  const botH = totalH - mainH;
  const mhdrH = (
    document.querySelector(".chart-header") || { offsetHeight: 44 }
  ).offsetHeight;
  const mainCanH = Math.max(mainH - mhdrH - 56, 80);
  const botCanH = Math.max(botH - 56, 60);

  document.querySelector(".main-chart-area").style.height = mainH + "px";
  document.querySelector(".chart-wrap").style.height = mainCanH + "px";
  document.querySelector(".bottom-left").style.height = botH + "px";
  document.querySelector(".bottom-left-chart-wrap").style.height =
    botCanH + "px";

  mainChart.resize();
  dayChart.resize();
}

window.addEventListener("resize", setChartHeights);
