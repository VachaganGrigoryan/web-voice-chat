type DateInput = Date | string | number;

const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const messageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: browserTimeZone,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const messageDayFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: browserTimeZone,
  dateStyle: 'medium',
});

const messageDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeZone: browserTimeZone,
  dateStyle: 'medium',
  timeStyle: 'medium',
});

function normalizeServerDateString(value: string): string {
  const trimmed = value.trim();
  const hasExplicitTimezone = /(?:[zZ]|[+\-]\d{2}:\d{2}|[+\-]\d{4})$/.test(trimmed);
  const looksIsoLike = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed);

  if (looksIsoLike && !hasExplicitTimezone) {
    return `${trimmed.replace(' ', 'T')}Z`;
  }

  return trimmed;
}

function toDate(value: DateInput): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string') {
    return new Date(normalizeServerDateString(value));
  }

  return new Date(value);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function toLocalBrowserDate(value: DateInput): Date {
  return toDate(value);
}

export function isSameLocalDay(left: DateInput, right: DateInput): boolean {
  const leftDate = toLocalBrowserDate(left);
  const rightDate = toLocalBrowserDate(right);

  if (!isValidDate(leftDate) || !isValidDate(rightDate)) {
    return false;
  }

  return leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate();
}

export function isToday(date: DateInput): boolean {
  return isSameLocalDay(date, new Date());
}

export function isYesterday(date: DateInput): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameLocalDay(date, yesterday);
}

export function formatChatMessageTime(date: DateInput): string {
  const normalizedDate = toLocalBrowserDate(date);
  return isValidDate(normalizedDate) ? messageTimeFormatter.format(normalizedDate) : '';
}

export function formatMessageTime(date: DateInput): string {
  return formatChatMessageTime(date);
}

export function formatMessageDay(date: DateInput): string {
  const normalizedDate = toLocalBrowserDate(date);

  if (!isValidDate(normalizedDate)) {
    return '';
  }

  if (isToday(normalizedDate)) {
    return 'Today';
  }

  if (isYesterday(normalizedDate)) {
    return 'Yesterday';
  }

  return messageDayFormatter.format(normalizedDate);
}

export function formatMessageDateTime(date: DateInput): string {
  const normalizedDate = toLocalBrowserDate(date);
  return isValidDate(normalizedDate) ? messageDateTimeFormatter.format(normalizedDate) : '';
}

export function getBrowserTimeZone(): string {
  return browserTimeZone;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
