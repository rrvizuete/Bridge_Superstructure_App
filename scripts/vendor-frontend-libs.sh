#!/usr/bin/env bash
# Copies the prebuilt dist files for the frontend's third-party libraries
# (installed via `npm install`) into frontend/vendor/, so the app has no
# runtime dependency on any CDN. Re-run after bumping a version in
# package.json.
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p frontend/vendor/bootstrap frontend/vendor/plotly frontend/vendor/xlsx

cp node_modules/bootstrap/dist/css/bootstrap.min.css frontend/vendor/bootstrap/
cp node_modules/bootstrap/dist/css/bootstrap.min.css.map frontend/vendor/bootstrap/
cp node_modules/bootstrap/dist/js/bootstrap.bundle.min.js frontend/vendor/bootstrap/
cp node_modules/bootstrap/dist/js/bootstrap.bundle.min.js.map frontend/vendor/bootstrap/

cp node_modules/plotly.js-dist-min/plotly.min.js frontend/vendor/plotly/

cp node_modules/xlsx/dist/xlsx.full.min.js frontend/vendor/xlsx/

echo "Vendored bootstrap, plotly, and xlsx into frontend/vendor/"
