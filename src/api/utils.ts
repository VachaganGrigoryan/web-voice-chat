import { PaginatedResponse, SuccessResponse } from './types';

export function extractResponseData<T>(payload: T | SuccessResponse<T>): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    'success' in payload
  ) {
    return (payload as SuccessResponse<T>).data;
  }
  return payload as T;
}

export function toSinglePageResponse<T>(
  data: T[],
  limit: number | null = null
): PaginatedResponse<T> {
  return {
    success: true,
    data,
    meta: {
      cursor: null,
      next_cursor: null,
      limit,
      total: data.length,
    },
  };
}
