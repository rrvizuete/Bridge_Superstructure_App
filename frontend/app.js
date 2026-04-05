const fitResultEl = document.getElementById("fitResult");
const profileResultEl = document.getElementById("profileResult");
const profileChartEl = document.getElementById("profileChart");
const pointsFileEl = document.getElementById("pointsFile");
const loadFileEl = document.getElementById("loadFile");
const fileStatusEl = document.getElementById("fileStatus");
const girderSelectEl = document.getElementById("girderSelect");

let importedRows = [];

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parsePointsFromCsv() {
  const raw = document.getElementById("pointsCsv").value.trim();
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);

  const points = lines.map((line, index) => {
    const [stationRaw, deflectionRaw] = line.split(",").map((token) => token.trim());
    const station = Number(stationRaw);
    const deflection = Number(deflectionRaw);

    if (!Number.isFinite(station) || !Number.isFinite(deflection)) {
      throw new Error(`Invalid row ${index + 1}: \"${line}\"`);
    }

    return { station, deflection };
  });

  if (points.length < 3) {
    throw new Error("At least 3 points are required.");
  }

  return points;
}

function getIntervals() {
  const value = Number(document.getElementById("intervals").value);
  if (!Number.isInteger(value) || value < 2 || value > 500) {
    throw new Error("Intervals must be an integer between 2 and 500.");
  }
  return value;
}

function renderPointsToTextbox(points) {
  const csvText = points
    .map((point) => `${point.station},${point.deflection}`)
    .join("\n");
  document.getElementById("pointsCsv").value = csvText;
}

function getGirderValue(row) {
  return row.girder ?? row.girder_id ?? row.beam ?? row.line ?? "";
}

function loadRowsFromWorkbook(workbook) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (rows.length === 0) {
    throw new Error("The selected file has no rows.");
  }

  importedRows = rows.map((row) => {
    const normalized = {};
    Object.keys(row).forEach((key) => {
      normalized[normalizeHeader(key)] = row[key];
    });
    return normalized;
  });

  const girderValues = [...new Set(importedRows.map(getGirderValue).filter(Boolean))];
  girderSelectEl.innerHTML = '<option value="">All / No girder column</option>';

  girderValues.forEach((girder) => {
    const option = document.createElement("option");
    option.value = String(girder);
    option.textContent = String(girder);
    girderSelectEl.appendChild(option);
  });

  girderSelectEl.disabled = girderValues.length === 0;

  fileStatusEl.textContent = `Loaded ${rows.length} rows from ${sheetName}. ${
    girderValues.length > 0 ? `Found ${girderValues.length} girder values.` : "No girder column found."
  }`;
}

async function parseUploadedFile() {
  const [file] = pointsFileEl.files;
  if (!file) {
    throw new Error("Choose a file first.");
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: "string" });
    loadRowsFromWorkbook(workbook);
    return;
  }

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  loadRowsFromWorkbook(workbook);
}

function loadImportedRowsIntoPoints() {
  if (!importedRows.length) {
    throw new Error("Load a file before importing rows.");
  }

  const selectedGirder = girderSelectEl.value;
  const filteredRows = selectedGirder
    ? importedRows.filter((row) => String(getGirderValue(row)) === selectedGirder)
    : importedRows;

  const points = filteredRows
    .map((row) => ({
      station: Number(row.station),
      deflection: Number(row.deflection),
    }))
    .filter((point) => Number.isFinite(point.station) && Number.isFinite(point.deflection))
    .sort((a, b) => a.station - b.station);

  if (points.length < 3) {
    throw new Error(
      "Unable to build points list. Ensure the selected data includes numeric 'station' and 'deflection' columns with at least 3 rows.",
    );
  }

  renderPointsToTextbox(points);
  fileStatusEl.textContent = `Imported ${points.length} points${selectedGirder ? ` for girder ${selectedGirder}` : ""}.`;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed (${response.status}): ${text}`);
  }

  return response.json();
}

pointsFileEl.addEventListener("change", async () => {
  try {
    await parseUploadedFile();
  } catch (error) {
    importedRows = [];
    girderSelectEl.innerHTML = '<option value="">All / No girder column</option>';
    girderSelectEl.disabled = true;
    fileStatusEl.textContent = `Error loading file: ${error.message}`;
  }
});

loadFileEl.addEventListener("click", () => {
  try {
    loadImportedRowsIntoPoints();
  } catch (error) {
    fileStatusEl.textContent = `Error importing rows: ${error.message}`;
  }
});

document.getElementById("runFit").addEventListener("click", async () => {
  try {
    const points = parsePointsFromCsv();
    const data = await postJson("/api/fit-parabola", { points });

    fitResultEl.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    fitResultEl.textContent = `Error: ${error.message}`;
  }
});

document.getElementById("buildProfile").addEventListener("click", async () => {
  try {
    const points = parsePointsFromCsv();
    const intervals = getIntervals();
    const data = await postJson("/api/build-profile", { points, intervals });

    profileResultEl.textContent = JSON.stringify(data, null, 2);

    const x = data.profile.map((item) => item.station);
    const y = data.profile.map((item) => item.deflection);

    Plotly.newPlot(profileChartEl, [{ x, y, mode: "lines+markers", name: "Deflection profile" }], {
      title: "Girder Deflection Profile",
      xaxis: { title: "Station" },
      yaxis: { title: "Deflection" },
      margin: { t: 40 },
    });
  } catch (error) {
    profileResultEl.textContent = `Error: ${error.message}`;
  }
});
