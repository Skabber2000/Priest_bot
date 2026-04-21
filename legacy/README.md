# Legacy (v1) — Flask + Telegram + OpenAI bot

This directory preserves the original `Priest_bot` source for historical reference. It is **not** maintained.

- `app.py` — 43-line Flask webhook receiving Telegram messages and replying via the deprecated `openai.ChatCompletion` API.
- `requirements.txt` — `flask`, `requests`, `openai`.
- `README_v1.md` — the original README (effectively empty).

The current product lives in `../web/` (GitHub Pages frontend) and `../worker/` (Cloudflare Worker Anthropic proxy). See the root README for details.
