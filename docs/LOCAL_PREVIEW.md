# Local preview and checks

Keep `Anixo` and `Anivexa-API` in sibling folders, or set `ANIVEXA_DIR` to the streaming API directory. Use Node 22.12+ (Node 24 recommended) and Python 3.10+.

Install dependencies with `npm ci` in Anixo, Anivexa-API, and each Anixo service: `backend-core`, `api`, `chat-service`, `comment-service`, `online-server`, `watch2gether-service`, `cf-worker`.

Create a Python virtual environment in Anixo:

```sh
python -m venv .venv
# Windows
.venv\Scripts\python -m pip install -r api/requirements.txt
# Linux/macOS
.venv/bin/python -m pip install -r api/requirements.txt
```

Run `npm run dev:all` from Anixo. It starts an isolated, temporary MongoDB database, generates fresh local secrets, disables credential-dependent integrations, and starts all services. MongoDB downloads its binary on first use. Stop with Ctrl+C; preview accounts and data are discarded.

| Service | Address |
| --- | --- |
| Frontend | http://localhost:5173 |
| Core backend | http://localhost:5001 |
| Metadata API | http://localhost:7860 |
| Streaming API docs | http://localhost:4001/docs |
| Comments | http://localhost:4000 |
| Chat | http://localhost:8080 |
| Presence | http://localhost:7861 |
| Watch together | http://localhost:8081 |

Local administrator: `preview.admin@gmail.com` / `LocalPreview123!`. These are development-only credentials. Registration uses Gmail-formatted addresses and a 3–32 character username containing letters, digits, `_`, or `-`.

Local password recovery displays a reset link instead of sending email. Real email, Google/AniList OAuth, AI generation, Turnstile, and Telegram need their own configured credentials and are not exercised by the isolated preview. Third-party metadata and streams still depend on provider availability; an unavailable provider should produce a usable error/fallback rather than a stuck loader.

## Verification

```sh
npm test
npm run lint
npm run build
npm --prefix backend-core test
node scripts/validateSearchQueryParser.js
npx playwright install chromium
npm run test:browser  # while dev:all is running
npm run test:services # live socket/auth integration, isolated preview only
```

The browser test needs Chromium system libraries on Linux. Backend tests use a separate ephemeral database. Proxy/provider tests use mocked upstream responses and do not upload media.

## Deployment notes

- Copy `.env.example` values into environment-specific configuration and set strong JWT, internal-service, and cron secrets. Never put private values into `VITE_*` variables.
- Set `FRONTEND_URL` and the exact public AniList callback `/auth/anilist/callback`. Set both frontend Turnstile site key and backend secret to enable challenge verification.
- Set independent backend/metadata destinations for Cloudflare Pages. Vercel Express and Python deployments must have their own working MongoDB/runtime configuration.
- Configure proxy allowed hosts for your actual media CDNs. Node validates resolved public addresses and redirects; edge deployments require an explicit hostname allowlist. Provider requests share a bounded request budget; timed-out provider operations abort their upstream requests.
- Rotate credentials that were previously committed or hardcoded. Removing a credential from current source does not revoke it or remove it from Git history.
- Existing accounts affected by historical double-hashing need password recovery. Check legacy username conflicts before enabling the unique index against an existing database.
- Keep dependency directories, `.env` files, virtual environments, build/browser artifacts, Telegram registries, media files, and local archives out of commits. Previously tracked dependency files require explicit Git index cleanup when preparing publication.
