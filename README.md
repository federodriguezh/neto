# neto

> A private, zero-cost portfolio tracker PWA for Argentine capital markets.  
> All data stays on your device. No backend. No tracking. No cost.

## What is neto?

neto is a client-side portfolio tracker built for investors in Argentine capital markets (BYMA stocks, CEDEARs, and bonds). It runs entirely in the browser as a Progressive Web App (PWA), stores all data locally via IndexedDB, and never sends portfolio information to any server unless you explicitly opt into encrypted cloud sync.

### Key features

- **Real-time prices** for BYMA stocks, CEDEARs, and Argentine bonds via [data912.com](https://data912.com)
- **Portfolio value history** computed by replaying all transactions day-by-day from the first trade to today
- **Multi-currency display** (ARS, USD MEP, USD CCL) with automatic historical exchange-rate conversion
- **Cross-device sync** via encrypted GitHub Gist (AES-256-GCM, PBKDF2 passphrase, opt-in)
- **CSV import** with automatic account creation and validation
- **PWA installable** on mobile and desktop — works offline after first load
- **Bilingual UI** (English / Español) via a lightweight custom i18n system

## Architecture

| Layer | Technology |
|-------|------------|
| Framework | React 19 + Vite 6 + TypeScript 5 (strict, `noUnusedLocals`, `noUnusedParameters`) |
| Styling | Tailwind CSS v3 (`tailwind.config.js` + `postcss.config.js`, not v4) |
| Database | Dexie.js (IndexedDB wrapper). Schema v4 with UUID string keys |
| Charts | Recharts |
| Icons | Lucide React |
| PWA | `vite-plugin-pwa` with custom `public/manifest.json` |
| Crypto | Web Crypto API (`crypto.subtle`) — AES-256-GCM + PBKDF2 |

**No backend.** Everything is client-side. The only outbound requests are:
- Price queries to `data912.com`
- Exchange-rate queries to `dolarapi.com` / `argentinadatos.com`
- Optional encrypted sync to GitHub Gist API

## Data Flow

1. **User input** → Accounts and transactions stored in IndexedDB via `src/db/index.ts`
2. **Live prices** → Fetched from data912.com with a 500ms in-memory request queue and 60s client-side cache
3. **Historical prices** → Loaded from same-origin static JSON (`public/data/cedears/`, `public/data/spy/`) at build time; falls back to data912 API for missing symbols
4. **Portfolio computation** → `usePortfolioValueHistory` replays all transactions daily, merges transaction prices as fallback anchors, and uses backward-fill for missing price days. Results cached in `portfolioHistory`
5. **Optional sync** → Every hour, enabled devices encrypt accounts/transactions/preferences and push/pull from a private GitHub Gist. Merge is UUID deduplication + last-write-wins by `updatedAt`

## Project Structure

```
src/
  api/            # data912 client, exchange rates, static CEDEAR/SPY loaders
  components/     # Reusable UI (charts, forms, tables, import/export)
  db/             # Dexie schema v4 + CRUD helpers + upgrade migrations
  hooks/          # Data fetching, portfolio computation, sync orchestration
  i18n/           # Custom translation hook + EN/ES dictionaries
  pages/          # Dashboard, Transactions, Settings, Onboarding
  sync/           # GitHub Gist client, encryption, merge engine
  utils/          # CSV import, currency formatting, realized P&L, fee calc
  types/          # Shared TypeScript interfaces
```

## Development Setup

> **Critical:** All npm commands run inside Docker only. The host must never execute `node_modules/` code.

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

The `dist/` folder is created on your host. Serve these static files with any web server or upload to GitHub Pages.

## Deploy

A GitHub Actions workflow (`.github/workflows/deploy.yml`) is included. It:
- Runs on every push to `main`
- Runs on a daily cron at `04:00 UTC` to refresh static CEDEAR/SPY historical data
- Builds inside Docker
- Deploys `dist/` to GitHub Pages

The `vite.config.ts` sets `base: '/neto/'` because GitHub Pages project repos deploy to a subdirectory.

## Python Data Scripts

Historical CEDEAR and SPY prices are generated at build time by the deploy workflow:

```bash
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/fetch_cedear_history.py
.venv/bin/python scripts/fetch_spy_history.py
```

These fetch live symbol lists and download max history via `yfinance` into `public/data/cedears/{symbol}.json` and `public/data/spy/{symbol}.json`. These files are **not committed** — they are generated fresh on the runner and bundled into the production build.

## Data Sources

- **Live & historical prices:** [data912.com](https://data912.com)
- **Exchange rates (MEP/CCL):** dolarapi.com + argentinadatos.com
- **CEDEAR/SPY static history:** generated at build time via Python scripts above

## Privacy & Security

- No analytics, no tracking pixels, no external scripts
- Portfolio data never leaves the device except:
  - Price queries to data912.com
  - Optional encrypted sync to GitHub Gist
- Sync uses AES-256-GCM encryption via Web Crypto API; the passphrase is derived with PBKDF2 (100k iterations). GitHub only stores an opaque encrypted blob.

## Contributing

This is a personal project. Contributions are welcome via pull request. Please ensure:
- `npm run build` passes (typecheck + production bundle)
- All UI strings are added to both `en` and `es` dictionaries in `src/i18n/dictionary.ts`
- No hardcoded user-visible strings in JSX
- Docker-based workflow is respected for all npm commands

## License

MIT
