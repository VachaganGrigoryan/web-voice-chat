import { ChatMessage } from '../types/message';
import { isSameDay, differenceInMinutes } from 'date-fns';

export interface MessageGroup {
  id: string;
  senderId: string;
  isOwn: boolean;
  messages: ChatMessage[];
  date: Date;
}

export function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  if (!messages.length) return [];

  // Sort messages by createdAt ascending
  const sortedMessages = [...messages].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of sortedMessages) {
    const messageDate = new Date(message.createdAt);

    if (!currentGroup) {
      currentGroup = {
        id: `group-${message.id}`,
        senderId: message.senderId,
        isOwn: message.isOwn,
        messages: [message],
        date: messageDate,
      };
      continue;
    }

    const lastMessage = currentGroup.messages[currentGroup.messages.length - 1];
    const lastMessageDate = new Date(lastMessage.createdAt);

    const isSameSender = message.senderId === currentGroup.senderId;
    const isSameDayAsLast = isSameDay(messageDate, lastMessageDate);
    const isWithinTimeWindow = differenceInMinutes(messageDate, lastMessageDate) < 5;

    if (isSameSender && isSameDayAsLast && isWithinTimeWindow) {
      currentGroup.messages.push(message);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: `group-${message.id}`,
        senderId: message.senderId,
        isOwn: message.isOwn,
        messages: [message],
        date: messageDate,
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
