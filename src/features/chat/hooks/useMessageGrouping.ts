import { useMemo } from 'react';
import { ChatMessage } from '../types/message';
import { groupMessages, MessageGroup } from '../utils/groupMessages';

export function useMessageGrouping(messages: ChatMessage[]): MessageGroup[] {
  return useMemo(() => {
    return groupMessages(messages);
  }, [messages]);
}
