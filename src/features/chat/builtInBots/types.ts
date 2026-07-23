import type { LucideIcon } from 'lucide-react';

export type BuiltInBotId = 'poll';

export interface BuiltInBotDefinition {
  id: BuiltInBotId;
  command: string;
  name: string;
  description: string;
  Icon: LucideIcon;
}
