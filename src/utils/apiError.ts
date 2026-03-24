export function extractApiError(error: unknown, fallback: string): string {
  const err = error as any;
  const errorData = err?.response?.data?.error;
  if (typeof errorData === 'string') return errorData;
  if (errorData?.message) return errorData.message;
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return fallback;
}
