# JPredict — Football Analytics Platform

A production-ready football prediction platform. Analyzes real fixtures using
real data from approved APIs and returns the 7 safest betting markets per
fixture with calculated confidence scores.

---

## Data Sources

| Source | Purpose |
|---|---|
| [football-data.org](https://football-data.org) | Fixtures, results, standings, head-to-head |
| [The Odds API](https://the-odds-api.com) | Bookmaker odds, implied probabilities |
| [TheSportsDB](https://thesportsdb.com) | Supplemental fixture coverage |

All API calls are server-side only. No credentials ever reach the browser.

---

## Prediction Engine

For every fixture, the engine:

1. Fetches team form (last 10 matches), home/away venue form separately
2. Fetches head-to-head history (last 10 meetings)
3. Fetches current league standings for relative strength context
4. Fetches bookmaker odds and computes normalized implied probabilities
5. Assesses data quality — penalizes confidence when data is sparse
6. Generates all supported market predictions using Poisson approximation +
   historical rates + odds signals
7. Ranks by composite score (model confidence × market confidence × data reliability)
8. Returns the top 7

### Markets Supported

- Over 0.5 Goals
- Over 1.5 Goals
- Under 4.5 Goals
- Under 5.5 Goals
- Home Team Over 0.5 Goals
- Away Team Over 0.5 Goals
- Double Chance (Home/Draw, Away/Draw, Home/Away)

---

## Local Setup

```bash
# 1. Clone and install
git clone https://github.com/jerryboss322/Jpredict
cd Jpredict
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local and add your API keys

# 3. Run locally
npm run dev
# Open http://localhost:3000
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `FOOTBALL_DATA_API_KEY` | Yes | football-data.org API key |
| `ODDS_API_KEY` | Yes | The Odds API key |
| `SPORTSDB_API_KEY` | No | TheSportsDB key (falls back to public tier) |
| `NEXT_PUBLIC_BASE_URL` | Yes | Full deployment URL |

**Get API keys:**
- football-data.org: https://www.football-data.org/client/register
- The Odds API: https://the-odds-api.com/
- TheSportsDB: https://www.thesportsdb.com/api.php (optional)

---

## Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard:
# Project Settings → Environment Variables
# Add: FOOTBALL_DATA_API_KEY, ODDS_API_KEY, NEXT_PUBLIC_BASE_URL
```

Or push to GitHub and import the repo in the Vercel dashboard. Set all
environment variables before the first production deploy.

---

## Project Structure

```
jpredict/
├── app/
│   ├── api/
│   │   ├── fixtures/route.ts          # GET /api/fixtures
│   │   ├── predictions/[id]/route.ts  # GET /api/predictions/:id
│   │   └── health/route.ts            # GET /api/health
│   ├── predictions/[id]/page.tsx      # Prediction detail page
│   ├── settings/page.tsx              # System status page
│   ├── page.tsx                       # Fixtures list (home)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── fixtures/FixtureCard.tsx
│   ├── predictions/
│   │   ├── PredictionCard.tsx
│   │   └── FormPanel.tsx
│   └── ui/
│       ├── NavBar.tsx
│       └── ConfidenceBadge.tsx
├── lib/
│   ├── api/
│   │   ├── football-data.ts           # football-data.org client
│   │   ├── odds-api.ts                # The Odds API client
│   │   └── sportsdb.ts                # TheSportsDB client
│   └── engine/
│       ├── form.ts                    # Form + Poisson calculations
│       ├── h2h.ts                     # Head-to-head analysis
│       ├── confidence.ts              # Market confidence engine
│       ├── ranking.ts                 # Data quality + ranking
│       └── predictor.ts              # Orchestrator
└── types/index.ts                     # All shared TypeScript types
```

---

## Design Principles

- **No mock data, ever.** If real data is unavailable, a proper unavailable
  state is shown. No invented fixtures, odds, or predictions.
- **Data quality transparency.** Every prediction shows its confidence
  breakdown and data coverage report. Low-quality data reduces confidence.
- **Security first.** API keys live in environment variables. No secrets in
  source code or client bundles.
- **Accuracy over coverage.** Fixtures with insufficient data are skipped
  with a clear explanation rather than generating unreliable predictions.
