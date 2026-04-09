import * as React from 'react';
import { cn } from '@/lib/utils';
import { BRAND } from './brand';

export type LogoSize = 'sm' | 'md' | 'lg';

const logoSizeClassNames: Record<LogoSize, string> = {
  sm: 'h-6',
  md: 'h-8',
  lg: 'h-12',
};

export interface LogoSymbolProps extends Omit<React.HTMLAttributes<HTMLElement>, 'children'> {
  size?: LogoSize;
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

export const LogoSymbol = React.forwardRef<HTMLElement, LogoSymbolProps>(function LogoSymbol(
  { size = 'md', asChild = false, className, children, ...props },
  ref,
) {
  const rootClassName = cn('inline-flex shrink-0 items-center justify-center', className);
  const content = (
    <img
      src={BRAND.assets.symbol}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('w-auto object-contain select-none', logoSizeClassNames[size])}
    />
  );

  if (asChild && children && React.isValidElement(children)) {
    return renderAsChild(children, { ...props, ref }, rootClassName, content);
  }

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={rootClassName} {...props}>
      {content}
    </span>
  );
});
