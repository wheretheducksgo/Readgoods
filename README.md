# Readgoods

A personal book tracking app that innovates on Goodreads with features like a visual bookshelf, library connection graphs, reading pace tracking, mood tagging, AI-powered recommendations, book clubs, and a year-in-review.

## Features

- **Library** — visual bookshelf with books organised by shelf (Currently Reading, Want to Read, Read)
- **Library Connections** — force-directed graph showing which books share authors or genres
- **For You / Popular Picks** — personalised and curated book recommendations on the home page
- **What's New** — recent releases filtered to modern fiction (no classic reprints)
- **Mood Tagging** — tag books with reading moods (cozy, dark, fast-paced, etc.)
- **Reading Pace Tracker** — log pages read and see your daily pace and projected finish date
- **Book Notes & Highlights** — per-book notes with autosave, plus a saved quotes panel
- **Reading Goal** — set a yearly reading target with a live progress ring
- **Year in Review** — stats, monthly chart, and highlights for any year
- **AI Pick** — Claude-powered "what to read next" based on your library and notes
- **Book Club** — create a shareable club for a book; members post progress and thoughts

---

## Deploying (recommended — zero setup for visitors)

The app has two parts: a React frontend and a small Express server. Deploy them separately — the whole process takes about 10 minutes.

### Step 1 — Deploy the Express server to Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.
2. Click **New Project → Deploy from GitHub repo** and select this repo.
3. Railway will detect the `railway.json` and start the server automatically.
4. Once deployed, go to **Settings → Networking → Generate Domain** to get a public URL (e.g. `https://readgoods-server.railway.app`).
5. Add your API keys as environment variables under **Variables**:
   - `VITE_GOOGLE_BOOKS_KEY` — [get one here](https://console.cloud.google.com/) (enable the Books API)
   - `VITE_ANTHROPIC_KEY` — [get one here](https://console.anthropic.com/) (optional — AI Pick feature)

### Step 2 — Point the frontend at your Railway server

Open `vercel.json` and replace `YOUR-RAILWAY-URL.railway.app` with the domain from Step 1:

```json
"destination": "https://readgoods-server.railway.app/api/:path*"
```

Commit and push this change.

### Step 3 — Deploy the frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New Project** and import this repo.
3. Leave all build settings as defaults (Vercel detects Vite automatically).
4. Add environment variables:
   - `VITE_GOOGLE_BOOKS_KEY` — same key as above (used at build time for the frontend)
5. Click **Deploy**.

Vercel will give you a URL like `https://readgoods.vercel.app`. Share that — no setup needed for visitors.

### Step 4 — Allow your Vercel domain on the server

Back in Railway, add one more environment variable:

- `ALLOWED_ORIGIN` — your Vercel URL, e.g. `https://readgoods.vercel.app`

Then in `server/index.js`, update the CORS check to also allow this origin (or just redeploy after updating the env var — the current code allows any `*.vercel.app` domain automatically).

---

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### Setup

```bash
npm install
```

Create a `.env` file in the project root (both keys are optional — see table below):

```
VITE_GOOGLE_BOOKS_KEY=your_key_here
VITE_ANTHROPIC_KEY=your_key_here
```

| Key | Without it |
|-----|-----------|
| `VITE_GOOGLE_BOOKS_KEY` | Uses anonymous Google Books requests (lower rate limit) |
| `VITE_ANTHROPIC_KEY` | AI Pick shows "unavailable" instead of a recommendation |

### Start

```bash
npm run dev:all
```

This starts both servers concurrently:

| Server | URL | Purpose |
|--------|-----|---------|
| Vite (frontend) | http://localhost:5173 | React app |
| Express (proxy) | http://localhost:3001 | Book reviews, AI, book clubs |

> Running `npm run dev` alone (without `dev:all`) starts only the frontend. Reviews, AI picks, and Book Club will not work.

---

## Data & privacy

All reading data (shelves, notes, highlights, moods, reading log, goals) is stored in your browser's `localStorage` — it never leaves your device. The only outbound requests are:

- Book searches → Google Books API
- Book reviews → Open Library (via the Express server)
- AI recommendations → Anthropic API (via the Express server, only if a key is configured)

Book club data lives in the Express server's memory and resets when the server restarts. It is not persisted to a database.
