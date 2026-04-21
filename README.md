# Priest Bot — Father Octavian

A cinematic, browser-based conversation with a fictional Catholic priest who suspects God is kidding. Streaming subtitles only (voice and facial animation are planned but deferred).

- **Frontend:** Vite + React + TypeScript + Tailwind → static site on **GitHub Pages**
- **Backend:** **Cloudflare Worker** proxying the **Anthropic Claude API** (Claude Sonnet 4.6)
- **Transport:** Server-Sent Events
- **Memory:** session-only (browser tab)
- **License:** MIT

> The v1 Flask/Telegram/OpenAI bot is archived in [`legacy/`](./legacy/) for history.

## Local development

Prereqs: Node 20+, an **Anthropic API key** (`sk-ant-...`), and a free Cloudflare account (for `wrangler`).

### 1. Start the Worker (terminal A)

```bash
cd worker
npm install
echo "ANTHROPIC_API_KEY=sk-ant-your-key" > .dev.vars
npm run dev        # http://localhost:8787
```

### 2. Start the frontend (terminal B)

```bash
cd web
npm install
echo "VITE_WORKER_URL=http://localhost:8787" > .env.local
echo "VITE_BASE=/" >> .env.local
npm run dev        # http://localhost:5173
```

Open `http://localhost:5173` and the priest will greet you. Type, press Enter.

### Tests / typecheck

```bash
cd worker && npm test && npm run typecheck
cd web    && npm test && npm run typecheck && npm run build
```

## Deploying

### Worker → Cloudflare

```bash
cd worker
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
# optional: npx wrangler secret put TURNSTILE_SECRET
npx wrangler deploy
```

After first deploy, note the `https://priest-worker.<your-subdomain>.workers.dev` URL.

Edit `worker/wrangler.toml` → `ALLOWED_ORIGINS` to include your GitHub Pages origin, e.g.:

```toml
ALLOWED_ORIGINS = "https://<your-user>.github.io"
```

Then `npx wrangler deploy` again.

### Web → GitHub Pages

1. In your repo **Settings → Pages**, set Source to **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_WORKER_URL` — your `workers.dev` URL
   - `VITE_TURNSTILE_SITE_KEY` — optional, only if you enable Turnstile
3. Push to `main`. `.github/workflows/deploy-web.yml` builds and publishes.

The worker is deployed automatically by `.github/workflows/deploy-worker.yml` if you add these repo secrets:
- `CLOUDFLARE_API_TOKEN` — a scoped API token with Workers Scripts:Edit
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID

## Cost

At Claude Sonnet 4.6 pricing, an average turn (≈200 in / 100 out tokens) is well under $0.01. A hundred exchanges ≈ $0.50. Cloudflare Workers free tier covers 100 000 requests/day. GitHub Pages is free.

## Cinematographic avatar (video-clip mode)

`VideoAvatarStage` crossfades between two pre-rendered MP4 loops based on whether the priest is actively speaking. **Drop the clips in `web/public/videos/`** and they're picked up on page reload. If a clip is missing, the stage silently falls back to the still `rest.jpg`.

### Expected files

| File | Duration | Purpose |
|---|---|---|
| `web/public/videos/idle.mp4` | 6–10 s loop | Priest at rest: breathing, blinking, rare head shifts, eyes may drift. **No mouth movement.** |
| `web/public/videos/speaking.mp4` | 8–15 s loop | Priest talking (no specific words): mouth movement throughout, head shifts, expressive brow work. |

### Generating the clips in Grok

1. Go to [grok.com](https://grok.com) and open the Imagine panel in image-to-video mode.
2. Upload `web/public/visemes/rest.jpg` as the source frame.
3. For **idle.mp4** prompt:
   > *A middle-aged priest in a Gothic cathedral stands very still. He is silent and pensive. His chest rises and falls slowly with his breath. He blinks naturally every few seconds. His eyes drift slowly around the scene. His mouth stays closed. No speech, no lip movement. Cinematic, slow, contemplative, 24 fps.*
4. For **speaking.mp4** prompt:
   > *A middle-aged priest in a Gothic cathedral is talking casually to someone just off-camera. His mouth moves naturally as he speaks. His eyebrows lift and fall with his words. Occasional small head nods and shifts. Calm, seasoned, slightly amused expression — like a priest who has heard everything and finds it mildly funny. Cinematic, steady camera, 24 fps.*
5. Export as MP4 (H.264 or H.265). Aim for 720p – 1080p, under 20 MB each.
6. Rename to `idle.mp4` / `speaking.mp4` and drop into `web/public/videos/`.

### Tips

- Grok sometimes inserts random framing cuts; re-generate until both clips start and end on a similar neutral pose so the crossfade reads as continuous motion.
- The idle clip should **feel like a loop** — Grok's output is often usable end-to-end; if seam is visible, re-render with a prompt ending in "*and returns to the starting pose*".
- If you want multiple speaking variants, the component currently only reads one `speaking.mp4` — extending it to rotate through several is a small change (track me down when you want that).

## Roadmap

The architecture was chosen so each of these is an additive swap, not a rewrite:

| Next step | Where it plugs in |
|---|---|
| **TTS voice** (ElevenLabs Flash 2.5 / Cartesia Sonic / Kokoro) | Replace `Pacer`'s fixed-WPM clock with TTS word timestamps in `web/src/hooks/useSubtitlePacer.ts`. |
| **Audio-synced lip-sync** (LivePortrait / MuseTalk on a backend GPU) | Replace `VideoAvatarStage` with a live video element fed by a WebRTC stream from the GPU worker. |
| **Multiple speaking clips** | Extend `VideoAvatarStage` to round-robin across `speaking_1.mp4`, `speaking_2.mp4`, … when `active` cycles. |
| **Persistent memory** | Add a KV / D1 binding to the worker and a user id header. |
| **Cloudflare Turnstile** | Already wired. Set `TURNSTILE_SECRET` in the worker and `VITE_TURNSTILE_SITE_KEY` in the frontend build. |

## Repo layout

```
priest/
├── web/         # GitHub Pages frontend (Vite + React + TS + Tailwind)
├── worker/      # Cloudflare Worker (Anthropic proxy with SSE)
├── legacy/      # Original Flask/Telegram/OpenAI bot (archived)
├── .github/workflows/
└── .env.example
```
