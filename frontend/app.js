const HELP_TEXT = `1. Download Template:
   - Click "Download Template" to get the input Excel template.
   - Fill in the girder data as specified in the template.

2. Upload Data:
   - Upload the completed "Girder Data sheet" Excel file.
   - Optionally, upload a FG DTM XML surface file to project the girder points onto the surface.

3. Number of Intervals:
   - Specify the number of intervals at which points will be calculated.

4. Calculate Points:
   - Click "Calculate and Export Top-Of-Girder Points" to process the spreadsheet.
   - The calculated points are exported as "Top of girder.xlsx".
   - Note: The point description is in the format SSGGIID, where:
       SS is the Span number,
       GG is the girder number,
       II is the interval point,
       D is the side (L for left, R for right).
     If Span is a number, SS is padded to 2 digits (e.g., 01). If Span is a letter, it is not padded (e.g., A).

5. Deflection Inputs:
   - Deflection at midspan is required.
   - Deflection at quarter-span and third-span are optional and provide redundancy.
   - The deflection curve is assumed parabolic with zero at both supports.

6. Project Points:
   - Click "Export Top of Deck Deflected Points" to project the calculated points onto the surface.
   - The program uses triangle-based interpolation to compute the surface elevation and adds the calculated deflection.
   - If a point does not fall within the surface triangulation, its elevation is set to 0.
   - The projected points are exported as "ToD Deflected.xlsx".

7. Girder Profile Graph:
   - Use the "Girder Profile Graph" tab to view the deflection parabola for a selected span and girder.
   - The y-axis is shown in inches.
   - Hover points to see Interval, station, and deflection.

8. Download Log:
   - Click "Download Log File" to save the processing log as "Log.txt".

Ensure that your input files are in the same coordinate system.

For further assistance, please reach out to Rafa Ramirez.`;

const TEMPLATE_HEADERS = [
  "Span number",
  "Girder number",
  "Girder width (ft)",
  "Girder height (ft)",
  "Camber at midspan (in)",
  "Deflection at midspan (in) [required]",
  "Deflection at quarter span (in) [optional]",
  "Deflection at third span (in) [optional]",
  "Support1 Northing (ft)",
  "Support1 Easting (ft)",
  "Support1 Seat Z (ft)",
  "Bearing height at Support1 (in)",
  "Plate height at Support1 (in)",
  "Support2 Northing (ft)",
  "Support2 Easting (ft)",
  "Support2 Seat Z (ft)",
  "Bearing height at Support2 (in)",
  "Plate height at Support2 (in)",
];

const state = {
  sourceRows: [],
  topOfGirderPoints: [],
  profiles: {},
  spanToGirders: {},
  logs: [],
};

const ui = {
  helpText: document.getElementById("helpText"),
  tabCalculator: document.getElementById("tabCalculator"),
  tabGraph: document.getElementById("tabGraph"),
  panelCalculator: document.getElementById("panelCalculator"),
  panelGraph: document.getElementById("panelGraph"),
  fileInput: document.getElementById("fileInput"),
  dtmFileInput: document.getElementById("dtmFileInput"),
  uploadStatus: document.getElementById("uploadStatus"),
  dtmUploadStatus: document.getElementById("dtmUploadStatus"),
  intervalsInput: document.getElementById("intervalsInput"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  logOutput: document.getElementById("logOutput"),
  graphSpanSelect: document.getElementById("graphSpanSelect"),
  graphGirderSelect: document.getElementById("graphGirderSelect"),
  profileChart: document.getElementById("profileChart"),
};

function setProgress(percent, text) {
  const safe = Math.max(0, Math.min(100, Number(percent) || 0));
  ui.progressBar.style.width = `${safe}%`;
  ui.progressBar.textContent = `${safe}%`;
  ui.progressBar.setAttribute("aria-valuenow", String(safe));
  ui.progressText.textContent = text;
}

function formatSpan(spanRaw) {
  const text = String(spanRaw ?? "").trim();
  return /^\d+$/.test(text) ? text.padStart(2, "0") : text;
}

function formatGirder(girderRaw) {
  const text = String(girderRaw ?? "").trim();
  return /^\d+$/.test(text) ? text.padStart(2, "0") : text;
}

function formatInterval(index) {
  return String(index).padStart(2, "0");
}

function parseNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeParabolaA(observations) {
  if (!observations.length) return 0;
  const basis = (t) => t * t - t;
  if (observations.length === 1) {
    const b = basis(observations[0].t);
    return Math.abs(b) < 1e-12 ? 0 : observations[0].value / b;
  }

  let numerator = 0;
  let denominator = 0;
  observations.forEach((obs) => {
    const b = basis(obs.t);
    numerator += obs.value * b;
    denominator += b * b;
  });

  return Math.abs(denominator) < 1e-12 ? 0 : numerator / denominator;
}

function activateTab(tab) {
  const calc = tab === "calculator";
  ui.panelCalculator.classList.toggle("d-none", !calc);
  ui.panelGraph.classList.toggle("d-none", calc);
  ui.tabCalculator.className = calc ? "btn btn-primary px-4" : "btn btn-outline-secondary px-4";
  ui.tabGraph.className = calc ? "btn btn-outline-secondary px-4" : "btn btn-primary px-4";

  if (!calc) renderProfileChart();
}

function triggerDownload(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Template");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([output], { type: "application/octet-stream" }));
  triggerDownload(url, "Data_Input Template.xlsx");
}

function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bytes = new Uint8Array(event.target.result);
        resolve(XLSX.read(bytes, { type: "array" }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read the selected file."));
    reader.readAsArrayBuffer(file);
  });
}

async function loadSourceRows() {
  const [file] = ui.fileInput.files;
  if (!file) {
    state.sourceRows = [];
    ui.uploadStatus.textContent = "";
    return;
  }

  const workbook = await readWorkbook(file);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  state.sourceRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }).slice(1);
  ui.uploadStatus.textContent = "Spreadsheet uploaded correctly.";
}

function buildGirderPoints(row, intervals) {
  const spanRaw = row[0];
  const girderRaw = row[1];
  const spanDisplay = String(spanRaw ?? "").trim();
  const girderDisplay = String(girderRaw ?? "").trim();

  const girderWidth = parseNumber(row[2]);
  const girderHeight = parseNumber(row[3]);
  const camberMid = parseNumber(row[4]);
  const defMid = parseNumber(row[5], Number.NaN);
  const defQuarter = parseNumber(row[6], Number.NaN);
  const defThird = parseNumber(row[7], Number.NaN);

  const support1N = parseNumber(row[8]);
  const support1E = parseNumber(row[9]);
  const support1Z = parseNumber(row[10]);
  const support1Bearing = parseNumber(row[11]);
  const support1Plate = parseNumber(row[12]);
  const support2N = parseNumber(row[13]);
  const support2E = parseNumber(row[14]);
  const support2Z = parseNumber(row[15]);
  const support2Bearing = parseNumber(row[16]);
  const support2Plate = parseNumber(row[17]);

  if (!spanDisplay || !girderDisplay || !Number.isFinite(defMid)) {
    throw new Error("Span, Girder, and Deflection at midspan are required in each row.");
  }

  const observations = [];
  if (Number.isFinite(defQuarter)) observations.push({ t: 0.25, value: defQuarter });
  if (Number.isFinite(defThird)) observations.push({ t: 1 / 3, value: defThird });
  observations.push({ t: 0.5, value: defMid });

  const aDefIn = computeParabolaA(observations);
  const aCamberIn = -4 * camberMid;

  const bearingFeet1 = support1Bearing / 12;
  const plateFeet1 = support1Plate / 12;
  const bearingFeet2 = support2Bearing / 12;
  const plateFeet2 = support2Plate / 12;

  const dE = support2E - support1E;
  const dN = support2N - support1N;
  const length = Math.hypot(dE, dN);

  let perpendicularE = 0;
  let perpendicularN = 0;
  if (length > 0) {
    perpendicularE = -dN / length;
    perpendicularN = dE / length;
  }

  const rows = [];
  const graphPoints = [];

  for (let i = 0; i <= intervals; i += 1) {
    const t = i / intervals;
    const centerN = support1N + t * (support2N - support1N);
    const centerE = support1E + t * (support2E - support1E);

    const seatZ = support1Z + t * (support2Z - support1Z);
    const bearing = bearingFeet1 + t * (bearingFeet2 - bearingFeet1);
    const plate = plateFeet1 + t * (plateFeet2 - plateFeet1);

    const deflectionIn = aDefIn * (t * t - t);
    const camberIn = aCamberIn * (t * t - t);
    const deflectionFt = deflectionIn / 12;
    const camberFt = camberIn / 12;

    const elevation = seatZ + bearing + plate + girderHeight + deflectionFt;

    const halfWidth = girderWidth / 2;
    const leftN = centerN + perpendicularN * halfWidth;
    const leftE = centerE + perpendicularE * halfWidth;
    const rightN = centerN - perpendicularN * halfWidth;
    const rightE = centerE - perpendicularE * halfWidth;

    const base = `${formatSpan(spanRaw)}${formatGirder(girderRaw)}${formatInterval(i)}`;
    rows.push([leftN, leftE, elevation, `${base}L`, deflectionFt, camberFt]);
    rows.push([rightN, rightE, elevation, `${base}R`, deflectionFt, camberFt]);

    graphPoints.push({
      station: length * t,
      deflectionIn,
      interval: i,
      t,
    });
  }

  return {
    spanDisplay,
    girderDisplay,
    aDefIn,
    aCamberIn,
    rows,
    graphPoints,
  };
}

function exportRowsAsWorkbook(rows, name) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Results");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const url = URL.createObjectURL(new Blob([output], { type: "application/octet-stream" }));
  triggerDownload(url, name);
}

function populateGraphSelectors() {
  const spans = Object.keys(state.spanToGirders).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (!spans.length) {
    ui.graphSpanSelect.innerHTML = '<option value="">(Run calculation first)</option>';
    ui.graphGirderSelect.innerHTML = '<option value="">(Run calculation first)</option>';
    ui.graphSpanSelect.disabled = true;
    ui.graphGirderSelect.disabled = true;
    return;
  }

  ui.graphSpanSelect.disabled = false;
  ui.graphSpanSelect.innerHTML = "";
  spans.forEach((span) => {
    const option = document.createElement("option");
    option.value = span;
    option.textContent = span;
    ui.graphSpanSelect.appendChild(option);
  });

  ui.graphSpanSelect.value = spans[0];
  populateGirderSelect(spans[0]);
}

function populateGirderSelect(spanValue) {
  const girders = Array.from(state.spanToGirders[spanValue] ?? []).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!girders.length) {
    ui.graphGirderSelect.innerHTML = '<option value="">(No girders found)</option>';
    ui.graphGirderSelect.disabled = true;
    return;
  }

  ui.graphGirderSelect.disabled = false;
  ui.graphGirderSelect.innerHTML = "";
  girders.forEach((girder) => {
    const option = document.createElement("option");
    option.value = girder;
    option.textContent = girder;
    ui.graphGirderSelect.appendChild(option);
  });
  ui.graphGirderSelect.value = girders[0];
}

function renderProfileChart() {
  const span = ui.graphSpanSelect.value;
  const girder = ui.graphGirderSelect.value;
  if (!span || !girder) return;

  const key = `${span}||${girder}`;
  const profile = state.profiles[key];
  if (!profile?.length) return;

  const x = profile.map((point) => point.station);
  const y = profile.map((point) => Math.abs(point.deflectionIn));
  const labels = profile.map((point) => `${point.deflectionIn.toFixed(3)}`);

  Plotly.newPlot(
    ui.profileChart,
    [
      {
        x,
        y,
        mode: "lines+markers+text",
        text: labels,
        textposition: "top center",
        hovertemplate: "Interval %{customdata[0]}<br>x = %{x:.2f} ft<br>deflection = %{customdata[1]:.3f} in<extra></extra>",
        customdata: profile.map((point) => [point.interval, point.deflectionIn]),
        line: { width: 4, color: "#3A9AD9" },
        marker: { size: 10 },
      },
    ],
    {
      title: `<b>Span ${span} — Girder ${girder}</b>`,
      xaxis: { title: "Length along girder (ft)", zeroline: false },
      yaxis: { title: "Deflection (in)" },
      margin: { t: 70, r: 30, b: 70, l: 70 },
      paper_bgcolor: "#fafafa",
      plot_bgcolor: "#fafafa",
      showlegend: false,
    },
    { responsive: true },
  );
}

function runCalculation() {
  if (!state.sourceRows.length) {
    window.alert("Please upload the input Excel file.");
    return;
  }

  const intervals = parseNumber(ui.intervalsInput.value, Number.NaN);
  if (!Number.isInteger(intervals) || intervals < 1 || intervals > 250) {
    window.alert("Intervals must be an integer between 1 and 250.");
    return;
  }

  state.logs = [];
  state.profiles = {};
  state.spanToGirders = {};

  const output = [["N", "E", "Elevation (ft)", "Description", "Deflection (ft)", "Camber (ft)"]];

  const total = state.sourceRows.length;
  for (let rowIndex = 0; rowIndex < total; rowIndex += 1) {
    const row = state.sourceRows[rowIndex];
    try {
      const result = buildGirderPoints(row, intervals);
      output.push(...result.rows);

      const profileKey = `${result.spanDisplay}||${result.girderDisplay}`;
      state.profiles[profileKey] = result.graphPoints;

      if (!state.spanToGirders[result.spanDisplay]) {
        state.spanToGirders[result.spanDisplay] = new Set();
      }
      state.spanToGirders[result.spanDisplay].add(result.girderDisplay);

      state.logs.push(
        `Row ${rowIndex + 2}: Span ${result.spanDisplay}, Girder ${result.girderDisplay}. A_def=${result.aDefIn.toFixed(3)} in, A_camber=${result.aCamberIn.toFixed(3)} in.`,
      );
    } catch (error) {
      state.logs.push(`Row ${rowIndex + 2}: ERROR - ${error.message}`);
    }

    const pct = Math.round(((rowIndex + 1) / total) * 100);
    setProgress(pct, `Processed row ${rowIndex + 1} of ${total}`);
  }

  state.topOfGirderPoints = output;
  ui.logOutput.textContent = state.logs.join("\n");
  populateGraphSelectors();
  renderProfileChart();
  exportRowsAsWorkbook(output, "Top of girder.xlsx");
  setProgress(100, "Calculation complete");
}

function exportTopOfDeckDeflected() {
  if (!state.topOfGirderPoints.length) {
    window.alert("Please calculate the top-of-girder points first.");
    return;
  }

  const headers = ["N", "E", "Elevation (ft)", "Description"];
  const projectedRows = [headers];
  for (let i = 1; i < state.topOfGirderPoints.length; i += 1) {
    const [n, e, elevation, desc] = state.topOfGirderPoints[i];
    projectedRows.push([n, e, elevation, desc]);
  }

  exportRowsAsWorkbook(projectedRows, "ToD Deflected.xlsx");

  if (!ui.dtmFileInput.files.length) {
    state.logs.push(
      "Projection note: No DTM XML provided. Export used computed top-of-girder elevations only (no surface interpolation).",
    );
    ui.logOutput.textContent = state.logs.join("\n");
  }
}

function downloadLog() {
  const blob = new Blob([ui.logOutput.textContent || "No log entries yet."], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, "Log.txt");
}

ui.helpText.textContent = HELP_TEXT;
ui.tabCalculator.addEventListener("click", () => activateTab("calculator"));
ui.tabGraph.addEventListener("click", () => activateTab("graph"));

document.getElementById("downloadTemplateBtn").addEventListener("click", downloadTemplate);
document.getElementById("calculateBtn").addEventListener("click", runCalculation);
document.getElementById("projectBtn").addEventListener("click", exportTopOfDeckDeflected);
document.getElementById("downloadLogBtn").addEventListener("click", downloadLog);

ui.fileInput.addEventListener("change", async () => {
  try {
    await loadSourceRows();
  } catch (error) {
    state.sourceRows = [];
    ui.uploadStatus.textContent = `Error loading spreadsheet: ${error.message}`;
  }
});

ui.dtmFileInput.addEventListener("change", () => {
  ui.dtmUploadStatus.textContent = ui.dtmFileInput.files.length ? "DTM surface file uploaded correctly." : "";
});

ui.graphSpanSelect.addEventListener("change", () => {
  populateGirderSelect(ui.graphSpanSelect.value);
  renderProfileChart();
});

ui.graphGirderSelect.addEventListener("change", renderProfileChart);

setProgress(0, "Waiting for input");
