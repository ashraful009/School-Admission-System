import { getApiUrl } from './config';
import { ERROR_MESSAGES, getErrorMessage } from '../shared/messages';

export const STUDENT_ID_KEY = 'school_admission_student_id';

let memoryStudentId: string | null = null;

export function isValidStudentId(id: string): boolean {
  return /^\d{17}$/.test(id.trim());
}

export function getStoredStudentId(): string | null {
  try {
    return localStorage.getItem(STUDENT_ID_KEY) || memoryStudentId;
  } catch {
    return memoryStudentId;
  }
}

export function setStoredStudentId(id: string): void {
  const clean = id.trim();
  memoryStudentId = clean;
  try {
    localStorage.setItem(STUDENT_ID_KEY, clean);
  } catch {
    // Local storage access denied / quota exceeded / private mode
  }
  window.dispatchEvent(new Event('student-id-changed'));
}

export function clearStoredStudentId(): void {
  memoryStudentId = null;
  try {
    localStorage.removeItem(STUDENT_ID_KEY);
  } catch {
    // Local storage access denied / private mode
  }
  window.dispatchEvent(new Event('student-id-changed'));
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly rawMessage: string;

  constructor(status: number, code: string, userMessage: string, rawMessage: string) {
    super(userMessage);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.rawMessage = rawMessage;
  }
}

// Global server reachability state and subscriber pattern
type ServerStatusListener = (isDown: boolean) => void;
const serverStatusListeners = new Set<ServerStatusListener>();
let isServerDown = false;
let recoveryTimer: ReturnType<typeof setInterval> | null = null;

export function isServerReachable(): boolean {
  return !isServerDown;
}

export function subscribeServerStatus(listener: ServerStatusListener): () => void {
  serverStatusListeners.add(listener);
  listener(isServerDown);
  return () => {
    serverStatusListeners.delete(listener);
  };
}

function notifyServerStatus(down: boolean) {
  if (isServerDown !== down) {
    isServerDown = down;
    serverStatusListeners.forEach((l) => l(isServerDown));

    if (isServerDown && !recoveryTimer) {
      // Auto-probe /health every 3s until server recovers
      recoveryTimer = setInterval(async () => {
        try {
          const res = await fetch(`${getApiUrl()}/health`, { method: 'GET', cache: 'no-store' });
          if (res.ok) {
            notifyServerStatus(false);
          }
        } catch {
          // Still down
        }
      }, 3000);
    } else if (!isServerDown && recoveryTimer) {
      clearInterval(recoveryTimer);
      recoveryTimer = null;
    }
  }
}

export interface RequestOptions extends RequestInit {
  studentId?: string | null;
  skipGlobalError?: boolean;
}

/**
 * Central fetch wrapper for all API calls:
 * - Uses getApiUrl()
 * - Appends X-Student-Id if provided or present in localStorage
 * - Parses D9 error body
 * - Maps error codes and network failures to plain-English messages
 * - Notifies global server-unreachable listeners
 */
export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { studentId, headers, skipGlobalError, ...fetchOptions } = options;
  const baseUrl = getApiUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  const requestHeaders = new Headers(headers || {});

  // Add default content type for JSON bodies if not specified
  if (fetchOptions.body && typeof fetchOptions.body === 'string' && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  // Set X-Student-Id header if passed or stored
  const effectiveStudentId = studentId !== undefined ? studentId : getStoredStudentId();
  if (effectiveStudentId && !requestHeaders.has('X-Student-Id')) {
    requestHeaders.set('X-Student-Id', effectiveStudentId);
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers: requestHeaders,
    });

    // Successful request: server is reachable
    notifyServerStatus(false);

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    if (!res.ok) {
      let errorBody: ApiErrorBody | null = null;
      try {
        errorBody = await res.json();
      } catch {
        // Response was not JSON
      }

      const code = errorBody?.error?.code || (res.status === 404 ? 'NOT_FOUND' : 'UNKNOWN_ERROR');
      const rawMessage = errorBody?.error?.message || res.statusText || 'Request failed';
      const userMessage = getErrorMessage(code, rawMessage);

      throw new ApiClientError(res.status, code, userMessage, rawMessage);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw err;
    }

    // Network / connection error (e.g. failed fetch, connection refused)
    notifyServerStatus(true);
    const networkMsg = ERROR_MESSAGES.NETWORK_ERROR;
    throw new ApiClientError(0, 'NETWORK_ERROR', networkMsg, err instanceof Error ? err.message : 'Network error');
  }
}
