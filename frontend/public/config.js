// Runtime configuration injected by the container entrypoint script.
// In production: /docker-entrypoint.d/40-runtime-config.sh writes this file.
// In Vite dev: falls back to VITE_API_URL env var, then the hardcoded default.
window.__APP_CONFIG__ = {};

