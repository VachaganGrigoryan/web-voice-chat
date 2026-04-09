import * as React from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { getBrandWordmarkSrc, type BrandTheme } from './brand';
import { LogoSymbol, type LogoSize } from './LogoSymbol';

const wordmarkSizeClassNames: Record<LogoSize, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
};

export interface LogoProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  size?: LogoSize;
  variant?: 'symbol' | 'wordmark' | 'auto';
  theme?: BrandTheme;
  asChild?: boolean;
  children?: React.ReactElement;
}

function renderAsChild(
  child: React.ReactElement<{ className?: string; children?: React.ReactNode }>,
  props: Record<string, unknown>,
  className: string,
  content: React.ReactNode,
) {
  return React.cloneElement(child, {
    ...props,
    className: cn(className, child.props.className),
    children: content,
  });
}

export const Logo = React.forwardRef<HTMLElement, LogoProps>(function Logo(
  { size = 'md', variant = 'wordmark', theme, asChild = false, className, children, ...props },
  ref,
) {
  const { resolvedMode } = useTheme();
  const surfaceTheme = theme ?? resolvedMode;
  const wordmarkSrc = getBrandWordmarkSrc(surfaceTheme);

  const wordmark = (
    <img
      src={wordmarkSrc}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('w-auto object-contain select-none', wordmarkSizeClassNames[size])}
    />
  );

  const content =
    variant === 'symbol' ? (
      <LogoSymbol size={size} />
    ) : variant === 'auto' ? (
      <>
        <LogoSymbol size={size} className="md:hidden" />
        <span className="hidden md:inline-flex">{wordmark}</span>
      </>
    ) : (
      wordmark
    );

  const rootClassName = cn('inline-flex shrink-0 items-center justify-center gap-0', className);

  if (asChild && children && React.isValidElement(children)) {
    return renderAsChild(children, { ...props, ref }, rootClassName, content);
  }

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={rootClassName} {...props}>
      {content}
    </span>
  );
});
