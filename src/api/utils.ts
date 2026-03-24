import { SuccessResponse } from './types';

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
