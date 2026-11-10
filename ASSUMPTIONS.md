# ASSUMPTIONS.md

Decisions made where the brief was silent, with reasons (T7).

## S0 — Repo scaffold

| # | Decision | Reason |
|---|----------|--------|
| A1 | **Frontend API URL via runtime `config.js`** — At container start, `docker-entrypoint.d/40-runtime-config.sh` writes `/usr/share/nginx/html/config.js` from the env var `API_URL`. The browser loads this file before the app bundle. In Vite dev mode, the app falls back to `VITE_API_URL` then `http://localhost:8080`. | Satisfies T4: the backend URL can be changed by setting one env var and restarting the frontend container — no image rebuild required. |
| A2 | **CORS allowed origins from env `Cors__AllowedOrigins`** (comma-separated, default `http://localhost:3000`) — Parsed at startup; invalid startup stops the app. | Keeps the security boundary configurable without a code change, and the default is correct for local dev (Q12 answer: port 3000). |
| A3 | **LF line endings enforced via `.gitattributes`** (`* text=auto eol=lf`) — All text files are normalised to LF on checkout. | Shell scripts (`*.sh`) run inside Linux containers and must have LF. Windows Git defaults to CRLF; without this rule the entrypoint script breaks silently. |
| A4 | **Backend Dockerfile lives at `backend/Dockerfile`** (build context `./backend`) — Frontend Dockerfile at `frontend/Dockerfile` (build context `./frontend`). | Keeps each service self-contained: the Docker build context is the service folder, so the image does not need to reach outside it. The `.dockerignore` files sit next to the Dockerfiles. |

