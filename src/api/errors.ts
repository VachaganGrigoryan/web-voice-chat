import type { ErrorResponse } from './types';

const RETRY_AFTER_HEADER = 'retry-after';
const RATE_LIMIT_FALLBACK_DELAY_MS = 10_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 20_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';

const getErrorResponseCandidate = (error: unknown): unknown => {
  if (!isRecord(error)) {
    return null;
  }

  const response = error.response;
  if (!isRecord(response)) {
    return null;
  }

  return response.data;
};

export const getApiErrorResponse = (error: unknown): ErrorResponse | null => {
  const candidate = getErrorResponseCandidate(error);
  if (!isRecord(candidate)) {
    return null;
  }

  const apiError = candidate.error;
  if (!isRecord(apiError) || typeof apiError.message !== 'string' || typeof apiError.code !== 'string') {
    return null;
  }

  let requestId: string | null = null;
  if (typeof candidate.request_id === 'string') {
    requestId = candidate.request_id;
  }

  return {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      details: 'details' in apiError ? apiError.details ?? null : null,
    },
    request_id: requestId,
  };
};

export const getApiErrorStatus = (error: unknown): number | null => {
  if (!isRecord(error) || !isRecord(error.response)) {
    return null;
  }

  const status = error.response.status;
  return typeof status === 'number' ? status : null;
};

export const isRateLimitError = (error: unknown) => getApiErrorStatus(error) === 429;

const readRetryAfterHeader = (error: unknown): string | null => {
  if (!isRecord(error) || !isRecord(error.response) || !isRecord(error.response.headers)) {
    return null;
  }

  const value = error.response.headers[RETRY_AFTER_HEADER];
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim();
  }

  return null;
};

export const getRetryAfterMs = (error: unknown, fallbackMs: number = RATE_LIMIT_FALLBACK_DELAY_MS) => {
  const retryAfter = readRetryAfterHeader(error);
  if (!retryAfter) {
    return fallbackMs;
  }

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(fallbackMs, Math.round(seconds * 1000));
  }

  const retryAt = Date.parse(retryAfter);
  if (Number.isNaN(retryAt)) {
    return fallbackMs;
  }

  return Math.max(fallbackMs, retryAt - Date.now());
};

export const getRetryDelayMs = (error: unknown, attemptIndex: number) => {
  if (isRateLimitError(error)) {
    return getRetryAfterMs(error);
  }

  return Math.min(
    DEFAULT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attemptIndex),
    MAX_RETRY_DELAY_MS
  );
};

export function extractApiError(error: unknown, fallback: string): string {
  const response = getApiErrorResponse(error);
  if (response?.error.message?.trim()) {
    return response.error.message;
  }

  if (isRecord(error) && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
