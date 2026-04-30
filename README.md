# neto
A private, zero-cost portfolio tracker PWA. All data stays on your device.
## Setup
1. Ensure Docker Desktop is running.
2. Build the dev image:
   ```bash
   docker build -t neto-dev .
   ```
3. Install dependencies:
   ```bash
   docker run -it --rm -v $(pwd):/app neto-dev npm install
   ```
4. Start dev server:
   ```bash
   docker run -it --rm -v $(pwd):/app -p 5173:5173 neto-dev npm run dev -- --host
   ```
5. Open http://localhost:5173 in your browser.
## Production Build
```bash
docker run -it --rm -v $(pwd):/app neto-dev npm run build
```
The `dist/` folder will be created on your host. Serve these static files with any web server or upload to GitHub Pages.
## Data Attribution
Market data provided by data912.com (https://data912.com).
## Export / Import
Use the Settings page to export your data as JSON or CSV, or import a previously exported JSON file to restore your portfolio.
