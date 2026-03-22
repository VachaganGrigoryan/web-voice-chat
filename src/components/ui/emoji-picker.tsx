import * as React from 'react';
import EmojiPicker, {
  Categories,
  EmojiStyle,
  SkinTonePickerLocation,
  SuggestionMode,
  Theme as EmojiPickerTheme,
  type CategoryConfig,
  type EmojiClickData,
} from 'emoji-picker-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemeMode } from '@/components/ThemeProvider';

export interface AppEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  height?: number | string;
  showSearch?: boolean;
  showPreview?: boolean;
  showSkinToneSelector?: boolean;
  layoutMode?: 'desktop-popover' | 'mobile-bottom-sheet';
  className?: string;
}

type PickerStyle = React.CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

interface PickerLayoutMetrics {
  horizontalPadding: number;
  headerVerticalPadding: number;
  searchBarInnerPadding: number;
  searchInputHeight: number;
  searchInputBorderRadius: number;
  categoryNavigationButtonSize: number;
  categoryLabelHeight: number;
  emojiSize: number;
  emojiPadding: number;
  previewHeight: number;
}

const PICKER_CATEGORIES: CategoryConfig[] = [
  {
    category: Categories.SMILEYS_PEOPLE,
    name: 'Smileys & People',
  },
  {
    category: Categories.ANIMALS_NATURE,
    name: 'Animals & Nature',
  },
  {
    category: Categories.FOOD_DRINK,
    name: 'Food & Drink',
  },
  {
    category: Categories.TRAVEL_PLACES,
    name: 'Travel & Places',
  },
  {
    category: Categories.ACTIVITIES,
    name: 'Activities',
  },
  {
    category: Categories.OBJECTS,
    name: 'Objects',
  },
  {
    category: Categories.SYMBOLS,
    name: 'Symbols',
  },
  {
    category: Categories.FLAGS,
    name: 'Flags',
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getDesktopPopoverMetrics(
  containerWidth: number,
  showPreview: boolean
): PickerLayoutMetrics {
  const width = containerWidth > 0 ? containerWidth : 360;
  const targetColumns = width < 340 ? 7 : width < 400 ? 8 : 9;
  const horizontalPadding = width < 360 ? 6 : 8;
  const availableWidth = Math.max(width - horizontalPadding * 2, 220);
  const emojiCellSize = clamp(
    Math.floor(availableWidth / targetColumns),
    34,
    44
  );
  const emojiSize = clamp(Math.round(emojiCellSize * 0.52), 18, 22);
  const emojiPadding = Math.max(
    4,
    Math.floor((emojiCellSize - emojiSize) / 2)
  );

  return {
    horizontalPadding,
    headerVerticalPadding: width < 360 ? 8 : 10,
    searchBarInnerPadding: 10,
    searchInputHeight: width < 360 ? 36 : 38,
    searchInputBorderRadius: 12,
    categoryNavigationButtonSize: width < 360 ? 24 : 28,
    categoryLabelHeight: width < 360 ? 30 : 34,
    emojiSize,
    emojiPadding,
    previewHeight: showPreview ? (width < 360 ? 52 : 58) : 0,
  };
}

function getMobileBottomSheetMetrics(
  containerWidth: number,
  showPreview: boolean
): PickerLayoutMetrics {
  const width = containerWidth > 0 ? containerWidth : 360;
  const targetColumns = width < 320 ? 6 : width < 420 ? 7 : 8;
  const horizontalPadding = 0;
  const availableWidth = Math.max(width - horizontalPadding * 2, 220);
  const emojiCellSize = clamp(
    Math.floor(availableWidth / targetColumns),
    40,
    52
  );
  const emojiSize = clamp(Math.round(emojiCellSize * 0.48), 18, 24);
  const emojiPadding = Math.max(
    3,
    Math.floor((emojiCellSize - emojiSize) / 2)
  );

  return {
    horizontalPadding,
    headerVerticalPadding: 6,
    searchBarInnerPadding: 8,
    searchInputHeight: 34,
    searchInputBorderRadius: 10,
    categoryNavigationButtonSize: width < 360 ? 22 : 24,
    categoryLabelHeight: 28,
    emojiSize,
    emojiPadding,
    previewHeight: showPreview ? 50 : 0,
  };
}

function getResponsivePickerMetrics(
  layoutMode: AppEmojiPickerProps['layoutMode'],
  containerWidth: number,
  showPreview: boolean
) {
  if (layoutMode === 'mobile-bottom-sheet') {
    return getMobileBottomSheetMetrics(containerWidth, showPreview);
  }

  return getDesktopPopoverMetrics(containerWidth, showPreview);
}

function resolveDocumentTheme(mode: ThemeMode): EmojiPickerTheme {
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) {
      return EmojiPickerTheme.DARK;
    }

    if (document.documentElement.classList.contains('light')) {
      return EmojiPickerTheme.LIGHT;
    }
  }

  if (mode === 'dark') {
    return EmojiPickerTheme.DARK;
  }

  if (mode === 'light') {
    return EmojiPickerTheme.LIGHT;
  }

  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? EmojiPickerTheme.DARK
      : EmojiPickerTheme.LIGHT;
  }

  return EmojiPickerTheme.LIGHT;
}

function useResolvedPickerTheme() {
  const { mode } = useTheme();
  const [resolvedTheme, setResolvedTheme] = React.useState<EmojiPickerTheme>(
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

export function AppEmojiPicker({
  onSelectEmoji,
  height = 360,
  showSearch = false,
  showPreview = false,
  showSkinToneSelector = true,
  layoutMode = 'desktop-popover',
  className,
}: AppEmojiPickerProps) {
  const pickerTheme = useResolvedPickerTheme();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      setContainerWidth(element.clientWidth || element.getBoundingClientRect().width);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(() => {
      measure();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const containerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      height: typeof height === 'number' ? `${height}px` : height,
    }),
    [height]
  );

  const layoutMetrics = React.useMemo(
    () => getResponsivePickerMetrics(layoutMode, containerWidth, showPreview),
    [containerWidth, layoutMode, showPreview]
  );

  const basePickerStyle = React.useMemo<PickerStyle>(
    () => ({
      width: '100%',
      height: '100%',
      border: 'none',
      backgroundColor: 'var(--background)',
      '--epr-bg-color': 'var(--background)',
      '--epr-dark-bg-color': 'var(--background)',
      '--epr-reactions-bg-color': 'var(--background)',
      '--epr-dark-reactions-bg-color': 'var(--background)',
      '--epr-picker-border-color': 'transparent',
      '--epr-dark-picker-border-color': 'transparent',
      '--epr-picker-border-radius': '0px',
      '--epr-highlight-color': 'var(--foreground)',
      '--epr-dark-highlight-color': 'var(--foreground)',
      '--epr-text-color': 'var(--muted-foreground)',
      '--epr-dark-text-color': 'var(--muted-foreground)',
      '--epr-hover-bg-color': 'var(--muted)',
      '--epr-dark-hover-bg-color': 'var(--muted)',
      '--epr-hover-bg-color-reduced-opacity': 'var(--muted)',
      '--epr-dark-hover-bg-color-reduced-opacity': 'var(--muted)',
      '--epr-focus-bg-color': 'var(--accent)',
      '--epr-dark-focus-bg-color': 'var(--accent)',
      '--epr-search-input-bg-color': 'var(--muted)',
      '--epr-dark-search-input-bg-color': 'var(--muted)',
      '--epr-search-input-bg-color-active': 'var(--background)',
      '--epr-dark-search-input-bg-color-active': 'var(--background)',
      '--epr-search-input-text-color': 'var(--foreground)',
      '--epr-search-input-placeholder-color': 'var(--muted-foreground)',
      '--epr-search-border-color': 'var(--border)',
      '--epr-search-border-color-active': 'var(--ring)',
      '--epr-category-label-bg-color': 'var(--background)',
      '--epr-dark-category-label-bg-color': 'var(--background)',
      '--epr-category-label-text-color': 'var(--muted-foreground)',
      '--epr-category-icon-active-color': 'var(--foreground)',
      '--epr-dark-category-icon-active-color': 'var(--foreground)',
      '--epr-skin-tone-picker-menu-color': 'var(--background)',
      '--epr-dark-skin-tone-picker-menu-color': 'var(--background)',
      '--epr-skin-tone-outer-border-color': 'var(--border)',
      '--epr-dark-skin-tone-outer-border-color': 'var(--border)',
      '--epr-skin-tone-inner-border-color': 'var(--background)',
      '--epr-dark-skin-tone-inner-border-color': 'var(--background)',
      '--epr-emoji-variation-picker-bg-color': 'var(--background)',
      '--epr-dark-emoji-variation-picker-bg-color': 'var(--background)',
      '--epr-emoji-variation-indicator-color': 'var(--border)',
      '--epr-dark-emoji-variation-indicator-color': 'var(--border)',
      '--epr-emoji-variation-indicator-color-hover': 'var(--foreground)',
      '--epr-preview-text-size': '13px',
      '--epr-preview-border-color': 'var(--border)',
      '--epr-preview-text-color': 'var(--muted-foreground)',
    }),
    []
  );

  const desktopPopoverStyle = React.useMemo<PickerStyle>(
    () => ({
      '--epr-horizontal-padding': `${layoutMetrics.horizontalPadding}px`,
      '--epr-header-padding': `${layoutMetrics.headerVerticalPadding}px var(--epr-horizontal-padding)`,
      '--epr-search-input-padding': '0 32px',
      '--epr-search-input-border-radius': `${layoutMetrics.searchInputBorderRadius}px`,
      '--epr-search-input-height': `${layoutMetrics.searchInputHeight}px`,
      '--epr-search-bar-inner-padding': `${layoutMetrics.searchBarInnerPadding}px`,
      '--epr-category-navigation-button-size': `${layoutMetrics.categoryNavigationButtonSize}px`,
      '--epr-category-padding': '0 var(--epr-horizontal-padding)',
      '--epr-category-label-padding': '0 var(--epr-horizontal-padding)',
      '--epr-category-label-height': `${layoutMetrics.categoryLabelHeight}px`,
      '--epr-emoji-size': `${layoutMetrics.emojiSize}px`,
      '--epr-emoji-padding': `${layoutMetrics.emojiPadding}px`,
      '--epr-preview-height': `${layoutMetrics.previewHeight}px`,
      '--epr-preview-text-padding': '0 var(--epr-horizontal-padding)',
    }),
    [layoutMetrics]
  );

  const mobileBottomSheetStyle = React.useMemo<PickerStyle>(
    () => ({
      '--epr-horizontal-padding': `${layoutMetrics.horizontalPadding}px`,
      '--epr-header-padding': `${layoutMetrics.headerVerticalPadding}px var(--epr-horizontal-padding)`,
      '--epr-search-input-padding': '0 28px',
      '--epr-search-input-border-radius': `${layoutMetrics.searchInputBorderRadius}px`,
      '--epr-search-input-height': `${layoutMetrics.searchInputHeight}px`,
      '--epr-search-bar-inner-padding': `${layoutMetrics.searchBarInnerPadding}px`,
      '--epr-category-navigation-button-size': `${layoutMetrics.categoryNavigationButtonSize}px`,
      '--epr-category-padding': '0',
      '--epr-category-label-padding': '0 4px',
      '--epr-category-label-height': `${layoutMetrics.categoryLabelHeight}px`,
      '--epr-emoji-size': `${layoutMetrics.emojiSize}px`,
      '--epr-emoji-padding': `${layoutMetrics.emojiPadding}px`,
      '--epr-preview-height': `${layoutMetrics.previewHeight}px`,
      '--epr-preview-text-padding': '0 4px',
    }),
    [layoutMetrics]
  );

  const pickerStyle = React.useMemo<PickerStyle>(
    () => ({
      ...basePickerStyle,
      ...(layoutMode === 'mobile-bottom-sheet'
        ? mobileBottomSheetStyle
        : desktopPopoverStyle),
    }),
    [basePickerStyle, desktopPopoverStyle, layoutMode, mobileBottomSheetStyle]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full min-h-0 min-w-0 overflow-hidden bg-background',
        layoutMode === 'mobile-bottom-sheet'
          ? 'rounded-none border-0 shadow-none'
          : 'rounded-[22px] border border-border/70 shadow-sm',
        className
      )}
      style={containerStyle}
    >
      <EmojiPicker
        onEmojiClick={(emojiData: EmojiClickData) => {
          onSelectEmoji(emojiData.emoji);
        }}
        theme={pickerTheme}
        emojiStyle={EmojiStyle.NATIVE}
        width="100%"
        height="100%"
        lazyLoadEmojis
        autoFocusSearch={false}
        searchDisabled={!showSearch}
        searchPlaceholder="Search emoji"
        categories={PICKER_CATEGORIES}
        suggestedEmojisMode={SuggestionMode.FREQUENT}
        previewConfig={{
          showPreview,
          defaultEmoji: '1f60a',
          defaultCaption: 'Pick an emoji',
        }}
        skinTonesDisabled={!showSkinToneSelector}
        skinTonePickerLocation={
          showPreview
            ? SkinTonePickerLocation.PREVIEW
            : SkinTonePickerLocation.SEARCH
        }
        className="!h-full !w-full !min-h-0 !min-w-0 !rounded-none !border-0 !shadow-none"
        style={pickerStyle}
      />
    </div>
  );
}
