import React from 'react';
import { AppEmojiPicker } from '@/components/ui/emoji-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { ComposerPlaceholderPanel } from './ComposerPlaceholderPanel';

interface ComposerEmojiPanelProps {
  isMobileViewport: boolean;
  contextLabel: string;
  onSelectEmoji: (emoji: string) => void;
}

export function ComposerEmojiPanel({
  isMobileViewport,
  contextLabel,
  onSelectEmoji,
}: ComposerEmojiPanelProps) {
  return (
    <Tabs defaultValue="emoji" className="flex h-full min-h-0 w-full flex-col">
      <TabsList className="grid h-11 w-full shrink-0 grid-cols-3 rounded-2xl bg-muted/50">
        <TabsTrigger value="emoji" className="rounded-xl text-xs sm:text-sm">
          Emojis
        </TabsTrigger>
        <TabsTrigger value="gif" className="rounded-xl text-xs sm:text-sm">
          GIFs
        </TabsTrigger>
        <TabsTrigger value="stickers" className="rounded-xl text-xs sm:text-sm">
          Stickers
        </TabsTrigger>
      </TabsList>
      <TabsContent value="emoji" className="mt-3 flex min-h-0 flex-1 flex-col">
        <AppEmojiPicker
          onSelectEmoji={onSelectEmoji}
          height="100%"
          className="h-full w-full"
        />
      </TabsContent>
      <TabsContent value="gif" className="mt-3 flex min-h-0 flex-1 flex-col">
        <ComposerPlaceholderPanel
          title="GIFs are coming next"
          description={`This ${contextLabel} composer now has the Telegram-style panel structure, but GIF sources are not integrated yet.`}
        />
      </TabsContent>
      <TabsContent value="stickers" className="mt-3 flex min-h-0 flex-1 flex-col">
        <ComposerPlaceholderPanel
          title="Sticker picker coming next"
          description="Sticker rendering already exists in chat, but sticker selection is not wired to a real source in this first composer refactor."
        />
      </TabsContent>
    </Tabs>
  );
}
