import { afterEach, describe, expect, it, vi } from 'vitest';
import { ERROR_MESSAGES, getErrorMessage } from '../shared/messages';
import { ApiClientError, apiClient } from './client';

const BACKEND_CODES = [
  'VALIDATION_ERROR',
  'INVALID_STUDENT_ID',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'UNSUPPORTED_MEDIA_TYPE',
  'NO_SEATS_AVAILABLE',
  'ALREADY_APPLIED_IN_CLASS',
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
  it.each(BACKEND_CODES)('has a plain-language message for %s', (code) => {
    const msg = getErrorMessage(code);
    expect(msg).toBe(ERROR_MESSAGES[code]);
    expect(msg).not.toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
  });

  it('falls back for unknown or missing codes', () => {
    expect(getErrorMessage('SOMETHING_NEW')).toBe(ERROR_MESSAGES.UNKNOWN_ERROR);
    expect(getErrorMessage(undefined, 'custom')).toBe('custom');
  });
});

describe('apiClient error mapping', () => {
  afterEach(async () => {
    // Leave the client in "server reachable" state so no recovery timer keeps running.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, [])));
    await apiClient('/classes');
    vi.unstubAllGlobals();
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

