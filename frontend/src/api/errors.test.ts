import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ERROR_MESSAGES, ERROR_MESSAGES_BN, getErrorMessage } from '../shared/messages';
import { LANG_STORAGE_KEY } from '../shared/i18n';
import { ApiClientError, apiClient } from './client';

const BACKEND_CODES = [
  'VALIDATION_ERROR',
  'INVALID_STUDENT_ID',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
  'NO_SEATS_AVAILABLE',
  'ALREADY_APPLIED_IN_CLASS',
  'ALREADY_APPLIED_ELSEWHERE',
  'HOLD_EXPIRED',
  'HOLD_NOT_ACTIVE',
  'HOLD_ALREADY_CONFIRMED',
  'TOTAL_SEATS_BELOW_OCCUPIED',
  'INTERNAL_ERROR',
];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('getErrorMessage', () => {
  beforeEach(() => {
    localStorage.removeItem(LANG_STORAGE_KEY);
  });

  it.each(BACKEND_CODES)('has a plain-language message for %s', (code) => {
    const msg = getErrorMessage(code);
    expect(msg).toBe(ERROR_MESSAGES[code]);
    expect(msg).not.toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
  });

  it.each(BACKEND_CODES)('has a Bangla translation for %s', (code) => {
    const msg = getErrorMessage(code, undefined, 'bn');
    expect(msg).toBe(ERROR_MESSAGES_BN[code]);
    expect(msg).not.toBe(ERROR_MESSAGES_BN.UNKNOWN_ERROR);
  });

  it('falls back for unknown or missing codes', () => {
    expect(getErrorMessage('SOMETHING_NEW')).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    expect(getErrorMessage(undefined, 'custom')).toBe('custom');
  });

  it('respects active language from localStorage', () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'bn');
    expect(getErrorMessage('NO_SEATS_AVAILABLE')).toBe(ERROR_MESSAGES_BN.NO_SEATS_AVAILABLE);

    localStorage.setItem(LANG_STORAGE_KEY, 'en');
    expect(getErrorMessage('NO_SEATS_AVAILABLE')).toBe(ERROR_MESSAGES.NO_SEATS_AVAILABLE);
  });
});

describe('apiClient error mapping & localization precedence (Task 1)', () => {
  beforeEach(() => {
    localStorage.removeItem(LANG_STORAGE_KEY);
  });

  afterEach(async () => {
    // Leave the client in "server reachable" state so no recovery timer keeps running.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));
    await apiClient('/classes');
    vi.unstubAllGlobals();
    localStorage.removeItem(LANG_STORAGE_KEY);
  });

  it('in Bangla mode, a known backend error code displays the Bangla translation', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'bn');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: { code: 'NO_SEATS_AVAILABLE', message: 'No seats left in this class.' } }),
      ),
    );

    const err = (await apiClient('/classes/x/holds', { method: 'POST', studentId: '20051234567890123' }).catch(
      (e: unknown) => e,
    )) as ApiClientError;

    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe('NO_SEATS_AVAILABLE');
    expect(err.message).toBe(ERROR_MESSAGES_BN.NO_SEATS_AVAILABLE);
    expect(err.getUserMessage('bn')).toBe(ERROR_MESSAGES_BN.NO_SEATS_AVAILABLE);
  });

  it('in English mode, the same error displays the English translation', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'en');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: { code: 'NO_SEATS_AVAILABLE', message: 'No seats left in this class.' } }),
      ),
    );

    const err = (await apiClient('/classes/x/holds', { method: 'POST', studentId: '20051234567890123' }).catch(
      (e: unknown) => e,
    )) as ApiClientError;

    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe('NO_SEATS_AVAILABLE');
    expect(err.message).toBe(ERROR_MESSAGES.NO_SEATS_AVAILABLE);
    expect(err.getUserMessage('en')).toBe(ERROR_MESSAGES.NO_SEATS_AVAILABLE);
  });

  it('a raw backend message does not override an available localized translation', async () => {
    localStorage.setItem(LANG_STORAGE_KEY, 'bn');

    const rawBackendEnglishMessage = 'Class is full! Custom backend raw English message.';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: { code: 'ALREADY_APPLIED_IN_CLASS', message: rawBackendEnglishMessage } }),
      ),
    );

    const err = (await apiClient('/classes/x/holds', { method: 'POST', studentId: '20051234567890123' }).catch(
      (e: unknown) => e,
    )) as ApiClientError;

    // Localized translation takes precedence in user message
    expect(err.message).toBe(ERROR_MESSAGES_BN.ALREADY_APPLIED_IN_CLASS);
    expect(err.message).not.toBe(rawBackendEnglishMessage);

    // Raw message is preserved strictly for logging/debugging
    expect(err.rawMessage).toBe(rawBackendEnglishMessage);
  });

  it('internal server errors and technical exceptions do not expose raw details to users', async () => {
    const rawException = 'Npgsql.PostgresException (0x80004005): 23505: duplicate key value violates unique constraint at line 42';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: rawException } }),
      ),
    );

    const err = (await apiClient('/classes/x/holds', { method: 'POST', studentId: '20051234567890123' }).catch(
      (e: unknown) => e,
    )) as ApiClientError;

    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(500);
    // User message is safe, plain-English/Bangla message
    expect(err.message).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(err.message).not.toContain('Npgsql');
    expect(err.message).not.toContain('PostgresException');
    // Raw message is preserved only on rawMessage
    expect(err.rawMessage).toBe(rawException);
  });

  it('maps a 409 error body to ApiClientError with the friendly message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(409, { error: { code: 'NO_SEATS_AVAILABLE', message: 'No seats left in this class.' } }),
      ),
    );

    const err = await apiClient('/classes/x/holds', { method: 'POST', studentId: '20051234567890123' }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiClientError);
    const apiErr = err as ApiClientError;
    expect(apiErr.status).toBe(409);
    expect(apiErr.code).toBe('NO_SEATS_AVAILABLE');
    expect(apiErr.message).toBe(ERROR_MESSAGES.NO_SEATS_AVAILABLE);
    expect(apiErr.rawMessage).toBe('No seats left in this class.');
  });

  it('maps a failed fetch (server down) to NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const err = (await apiClient('/classes').catch((e: unknown) => e)) as ApiClientError;

    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.status).toBe(0);
    expect(err.message).toBe(ERROR_MESSAGES.NETWORK_ERROR);
  });

  it('sends the X-Student-Id header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient('/me/holds', { studentId: '20051234567890123' });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-Student-Id')).toBe('20051234567890123');
  });
});

