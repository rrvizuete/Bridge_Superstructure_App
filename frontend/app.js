const fitResultEl = document.getElementById("fitResult");
const profileResultEl = document.getElementById("profileResult");
const profileChartEl = document.getElementById("profileChart");

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
