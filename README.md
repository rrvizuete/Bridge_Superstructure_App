# Bridge Superstructure App

Professional scaffolding for girder/top-of-deck deflection workflows.

## Why this architecture

- **Backend:** FastAPI (Python) for numerical workflows (least-squares parabola fitting with NumPy), file I/O, and future geometry/DTM processing.
- **Frontend:** Tabbed Bootstrap UI + Plotly charts for clear workflow steps and quick iteration.
- **Reasoning:** This gives a maintainable split between engineering calculations and UX, while staying easy to extend into plan-view rendering and exports.

## Current scaffold tabs

1. **Input & Setup** - point input, Excel/CSV import (with optional girder filtering), and interval configuration.
2. **Parabola Fit** - calls backend least-squares endpoint (`y = ax² + bx + c`).
3. **Girder Profile** - generates profile points and renders a chart.
4. **Plan View (Future)** - reserved for next iteration.

## Run locally (Codespaces-friendly)

From repo root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python app.py
```

Open: `http://127.0.0.1:8000`


## Other ways to run/test your branch

### Option 1: Run with uvicorn directly

```bash
source .venv/bin/activate
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 2: Quick API check from terminal

With the server running in one terminal:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"status":"ok"}
```

## API endpoints

- `GET /api/health`
- `POST /api/fit-parabola`
- `POST /api/build-profile`
