import { BarChart3 } from 'lucide-react';
import type { BuiltInBotDefinition } from './types';

export const BUILT_IN_BOTS: BuiltInBotDefinition[] = [
  {
    id: 'poll',
    command: '/poll',
    name: 'PollBot',
    description: 'Create a structured poll for this conversation.',
    Icon: BarChart3,
  },
];

export const findBuiltInBotByCommand = (command: string) =>
  BUILT_IN_BOTS.find((bot) => bot.command === command);
