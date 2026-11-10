// Global type declaration for the runtime config object written by the container entrypoint.
interface AppConfig {
  API_URL?: string;
}

declare global {
  interface Window {
    __APP_CONFIG__?: AppConfig;
  }
}

/**
 * Returns the backend API base URL, with no trailing slash.
 * Priority: runtime config.js → VITE_API_URL env var → hardcoded local default.
 */
export function getApiUrl(): string {
  const raw =
    window.__APP_CONFIG__?.API_URL ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:8080';
  return raw.replace(/\/$/, '');
}

