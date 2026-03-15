type DateInput = Date | string | number;

const messageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  timeStyle: 'short',
});

const messageDayFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

const messageDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function isSameLocalDay(left: DateInput, right: DateInput): boolean {
  const leftDate = toDate(left);
  const rightDate = toDate(right);

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

export function formatMessageTime(date: DateInput): string {
  const normalizedDate = toDate(date);
  return isValidDate(normalizedDate) ? messageTimeFormatter.format(normalizedDate) : '';
}

export function formatMessageDay(date: DateInput): string {
  const normalizedDate = toDate(date);

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
  const normalizedDate = toDate(date);
  return isValidDate(normalizedDate) ? messageDateTimeFormatter.format(normalizedDate) : '';
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
