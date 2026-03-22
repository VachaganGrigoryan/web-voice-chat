import React from 'react';
import { AppEmojiPicker } from '@/components/ui/emoji-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
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
      <TabsList
        className={cn(
          'grid w-full shrink-0 grid-cols-3 bg-muted/50',
          isMobileViewport ? 'h-10 rounded-xl' : 'h-11 rounded-2xl'
        )}
      >
        <TabsTrigger
          value="emoji"
          className={cn(
            'text-xs sm:text-sm',
            isMobileViewport ? 'rounded-lg' : 'rounded-xl'
          )}
        >
          Emojis
        </TabsTrigger>
        <TabsTrigger
          value="gif"
          className={cn(
            'text-xs sm:text-sm',
            isMobileViewport ? 'rounded-lg' : 'rounded-xl'
          )}
        >
          GIFs
        </TabsTrigger>
        <TabsTrigger
          value="stickers"
          className={cn(
            'text-xs sm:text-sm',
            isMobileViewport ? 'rounded-lg' : 'rounded-xl'
          )}
        >
          Stickers
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="emoji"
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          isMobileViewport ? 'mt-2' : 'mt-3'
        )}
      >
        <AppEmojiPicker
          onSelectEmoji={onSelectEmoji}
          height="100%"
          showSkinToneSelector={!isMobileViewport}
          layoutMode={
            isMobileViewport ? 'mobile-bottom-sheet' : 'desktop-popover'
          }
          className="h-full w-full"
        />
      </TabsContent>
      <TabsContent
        value="gif"
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          isMobileViewport ? 'mt-2' : 'mt-3'
        )}
      >
        <ComposerPlaceholderPanel
          title="GIFs are coming next"
          description={`This ${contextLabel} composer now has the Telegram-style panel structure, but GIF sources are not integrated yet.`}
        />
      </TabsContent>
      <TabsContent
        value="stickers"
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          isMobileViewport ? 'mt-2' : 'mt-3'
        )}
      >
        <ComposerPlaceholderPanel
          title="Sticker picker coming next"
          description="Sticker rendering already exists in chat, but sticker selection is not wired to a real source in this first composer refactor."
        />
      </TabsContent>
    </Tabs>
  );
}
