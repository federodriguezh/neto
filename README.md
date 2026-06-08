# neto

> A personal finance app for tracking investments, income, and shared expenses.  
> Real-time sync across devices. Works offline. Free forever.

## What is neto?

neto is a comprehensive personal finance app built for Argentine users. It combines portfolio tracking for local capital markets (BYMA stocks, CEDEARs, and bonds) with income tracking and shared expense management for households. The app runs as a Progressive Web App (PWA) with Supabase as the backend, providing real-time sync across devices while maintaining offline-first capabilities via IndexedDB.

### Key features

#### Portfolio Tracking
- **Real-time prices** for BYMA stocks, CEDEARs, and Argentine bonds via [data912.com](https://data912.com)
- **Portfolio value history** computed by replaying all transactions day-by-day from the first trade to today
- **Multi-currency display** (ARS, USD MEP, USD CCL) with automatic historical exchange-rate conversion
- **Realized P&L calculation** using FIFO method with automatic batch recomputation

#### Income Tracking
- **Multiple income sources** — salary, freelance, investments, gifts, and other categories
- **Monthly and yearly summaries** with automatic aggregation
- **Participant association** — link income to household members for proportional expense splitting

#### Shared Expenses (Households)
- **Create or join households** via invite codes
- **Two split methods:**
  - **Proportional** — automatically splits expenses based on each participant's income ratio
  - **Fixed** — uses a configured percentage split
- **Balance tracking** — see who owes whom and settle debts with one click
- **Real-time sync** — changes appear instantly across all household members' devices

#### Core Features
- **Cross-device sync** via Supabase with real-time updates and offline queue
- **CSV import** for transactions with automatic account creation and validation
- **JSON export/import** for full data backup including income and expenses
- **PWA installable** on mobile and desktop — works offline after first load
- **Bilingual UI** (English / Español) via a lightweight custom i18n system
- **Authentication** — email/password login with secure session management

## Architecture

| Layer | Technology |
|-------|------------|
| Framework | React 19 + Vite 6 + TypeScript 5 (strict, `noUnusedLocals`, `noUnusedParameters`) |
| Styling | Tailwind CSS v3 (`tailwind.config.js` + `postcss.config.js`, not v4) |
| Database | Dexie.js (IndexedDB wrapper). Schema v5 with UUID string keys + sync queue |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| Charts | Recharts |
| Icons | Lucide React |
| PWA | `vite-plugin-pwa` with custom `public/manifest.json` |
| Routing | React Router v7 (hash-based for static hosting compatibility) |
| Testing | Vitest + React Testing Library |

### Data Flow

1. **User input** → Data written to IndexedDB first (instant, offline-capable)
2. **Sync queue** → Changes queued in `syncQueue` table with operation type and timestamp
3. **Background sync** → Queue flushed to Supabase every 30 seconds or when online
4. **Real-time updates** → Supabase Realtime subscriptions push changes from other devices
5. **Conflict resolution** — last-write-wins by `updatedAt` timestamp
6. **Live prices** → Fetched from data912.com with a 500ms in-memory request queue and 60s client-side cache
7. **Historical prices** → Loaded from same-origin static JSON (`public/data/cedears/`, `public/data/spy/`) at build time; falls back to data912 API for missing symbols
8. **Portfolio computation** → `usePortfolioValueHistory` replays all transactions daily, merges transaction prices as fallback anchors, and uses backward-fill for missing price days. Results cached in `portfolioHistory`

### Sync Architecture

```
┌─────────────┐     write      ┌──────────────┐
│   UI/Form   │───────────────▶│   IndexedDB   │  (instantáneo)
└─────────────┘                │   (Dexie)     │
                               └──────┬───────┘
                                      │ enqueue
                                      ▼
                               ┌──────────────┐
                               │  Sync Queue   │  (en IndexedDB)
                               │  (Dexie)      │
                               └──────┬───────┘
                                      │ flush (online)
                                      ▼
┌─────────────┐   realtime     ┌──────────────┐
│   UI update │◀───────────────│   Supabase    │  (source of truth)
└─────────────┘                │   (Postgres)  │
                               └──────────────┘
```

## Project Structure

```
src/
  api/            # data912 client, exchange rates, static CEDEAR/SPY loaders
  components/     # Reusable UI (charts, forms, tables, import/export)
  contexts/       # React contexts (AuthContext for Supabase auth)
  db/             # Dexie schema v5 + CRUD helpers + upgrade migrations
  hooks/          # Data fetching, portfolio computation, sync orchestration
  i18n/           # Custom translation hook + EN/ES dictionaries
  lib/            # Supabase client configuration
  pages/          # Dashboard, Transactions, Income, Expenses, Balances, Households, Settings, Onboarding, Login, Signup
  sync/           # Supabase sync engine, offline queue, migration utilities
  utils/          # CSV import, currency formatting, realized P&L, fee calc
  types/          # Shared TypeScript interfaces
supabase/
  migrations/     # SQL migrations for Supabase schema and RLS policies
```

## Development Setup

> **Critical:** All npm commands run inside Docker only. The host must never execute `node_modules/` code.

### Prerequisites

1. **Supabase Project** — Create a free project at [supabase.com](https://supabase.com)
2. **Environment Variables** — Copy `.env.example` to `.env.local` and fill in:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. **Database Schema** — Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor

### Local Development

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

### Testing

```bash
docker run -it --rm -v $(pwd):/app neto-dev npm test
```

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

### Environment Variables for Production

Set these in your deployment platform (GitHub Pages, Vercel, Netlify, etc.):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

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
- **Backend & sync:** [Supabase](https://supabase.com) (PostgreSQL + Auth + Realtime)

## Privacy & Security

- No analytics, no tracking pixels, no external scripts
- Portfolio data is stored in Supabase with Row Level Security (RLS) policies
- Each user can only access their own data (enforced at the database level)
- Household data is shared only with invited participants
- Sync uses Supabase's built-in encryption at rest and in transit
- Authentication via email/password with secure session management
- Offline-first architecture — app works without internet connection

## Contributing

This is a personal project. Contributions are welcome via pull request. Please ensure:
- `npm run build` passes (typecheck + production bundle)
- `npm test` passes (all tests green)
- All UI strings are added to both `en` and `es` dictionaries in `src/i18n/dictionary.ts`
- No hardcoded user-visible strings in JSX
- Docker-based workflow is respected for all npm commands

## License

MIT
