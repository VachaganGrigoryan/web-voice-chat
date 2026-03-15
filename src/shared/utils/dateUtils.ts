import { format, isToday, isYesterday, isSameDay } from 'date-fns';

export const formatMessageTime = (date: Date): string => {
  return format(date, 'HH:mm');
};

export const formatMessageDay = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
};

export { isToday, isYesterday, isSameDay };
