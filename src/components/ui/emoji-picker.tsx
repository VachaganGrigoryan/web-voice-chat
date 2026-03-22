import * as React from 'react';
import Picker from '@emoji-mart/react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/components/ThemeProvider';

export interface AppEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  height?: number | string;
  showSearch?: boolean;
  showPreview?: boolean;
  showSkinToneSelector?: boolean;
  className?: string;
}

type EmojiMartData = import('@emoji-mart/data').EmojiMartData;

let emojiDataPromise: Promise<EmojiMartData> | null = null;

function loadEmojiMartData() {
  if (!emojiDataPromise) {
    emojiDataPromise = import('@emoji-mart/data').then((module) => {
      const resolvedModule = (module as { default?: unknown }).default ?? module;
      return resolvedModule as EmojiMartData;
    });
  }

  return emojiDataPromise;
}

function resolveDocumentTheme(mode: ThemeMode): 'light' | 'dark' {
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) {
      return 'dark';
    }

    if (document.documentElement.classList.contains('light')) {
      return 'light';
    }
  }

  if (mode === 'dark' || mode === 'light') {
    return mode;
  }

  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
}

function useResolvedPickerTheme() {
  const { mode } = useTheme();
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>(
    () => resolveDocumentTheme(mode)
  );

  React.useEffect(() => {
    setResolvedTheme(resolveDocumentTheme(mode));

    if (mode !== 'system' || typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      setResolvedTheme(resolveDocumentTheme(mode));
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, [mode]);

  return resolvedTheme;
}

function extractNativeEmoji(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybeEmoji = value as { native?: unknown };
  return typeof maybeEmoji.native === 'string' ? maybeEmoji.native : null;
}

export function AppEmojiPicker({
  onSelectEmoji,
  height = 360,
  showSearch = false,
  showPreview = false,
  showSkinToneSelector = true,
  className,
}: AppEmojiPickerProps) {
  const pickerTheme = useResolvedPickerTheme();
  const [emojiData, setEmojiData] = React.useState<EmojiMartData | null>(null);

  const style = React.useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      height: typeof height === 'number' ? `${height}px` : height,
      ['--padding' as string]: '8px',
      ['--sidebar-width' as string]: '0px',
    }),
    [height]
  );

  const searchPosition = showSearch ? 'sticky' : 'none';
  const previewPosition = showPreview ? 'bottom' : 'none';
  const skinTonePosition =
    showSkinToneSelector && showPreview
      ? 'preview'
      : showSkinToneSelector && showSearch
      ? 'search'
      : 'none';

  React.useEffect(() => {
    let cancelled = false;

    void loadEmojiMartData().then((data) => {
      if (!cancelled) {
        setEmojiData(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className={cn(
        'flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-border/70 bg-background shadow-sm [&>div]:flex [&>div]:h-full [&>div]:w-full [&>div]:min-h-0 [&>div]:min-w-0 [&>div]:flex-1 [&>div>em-emoji-picker]:block [&>div>em-emoji-picker]:h-full [&>div>em-emoji-picker]:w-full [&>div>em-emoji-picker]:min-h-full [&>div>em-emoji-picker]:min-w-full [&>div>em-emoji-picker]:max-h-full [&>div>em-emoji-picker]:max-w-full [&>div>em-emoji-picker]:flex-1',
        className
      )}
      style={style}
    >
      {emojiData ? (
        <Picker
          data={emojiData}
          locale="en"
          set="native"
          theme={pickerTheme}
          navPosition="top"
          searchPosition={searchPosition}
          previewPosition={previewPosition}
          skinTonePosition={skinTonePosition}
          dynamicWidth
          emojiButtonSize={32}
          emojiSize={20}
          maxFrequentRows={0}
          onEmojiSelect={(value: unknown) => {
            const emoji = extractNativeEmoji(value);
            if (emoji) {
              onSelectEmoji(emoji);
            }
          }}
          style={{
            height: '100%',
            width: '100%',
            minHeight: '100%',
            minWidth: '100%',
            maxHeight: '100%',
            maxWidth: '100%',
            flex: '1 1 auto',
            ['--padding' as string]: '8px',
            ['--sidebar-width' as string]: '0px',
          }}
        />
      ) : (
        <div className="flex h-full min-h-32 items-center justify-center px-4 text-sm text-muted-foreground">
          Loading emoji…
        </div>
      )}
    </div>
  );
}
