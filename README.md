# Bridge Superstructure App

Professional scaffolding for girder/top-of-deck deflection workflows.

## Why this architecture

- **Backend:** FastAPI (Python) for numerical workflows (least-squares parabola fitting with NumPy), file I/O, and future geometry/DTM processing.
- **Frontend:** Tabbed Bootstrap UI + Plotly charts for clear workflow steps and quick iteration.
- **Reasoning:** This gives a maintainable split between engineering calculations and UX, while staying easy to extend into plan-view rendering and exports.

## Current scaffold tabs

1. **Input & Setup** - point input and interval configuration.
2. **Parabola Fit** - calls backend least-squares endpoint (`y = ax² + bx + c`).
3. **Girder Profile** - generates profile points and renders a chart.
4. **Plan View (Future)** - reserved for next iteration.

## Run locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open: `http://127.0.0.1:8000`

## API endpoints

- `GET /api/health`
- `POST /api/fit-parabola`
- `POST /api/build-profile`
