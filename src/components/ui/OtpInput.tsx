import * as React from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export const OtpInput = React.forwardRef<HTMLInputElement, OtpInputProps>(
  ({ className, value, onChange, maxLength = 6, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleClick = () => {
      inputRef.current?.focus();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value.replace(/[^0-9]/g, '').slice(0, maxLength);
      onChange(newValue);
    };

    // Expose the internal ref to the parent if needed, while keeping our local ref
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    return (
      <div className={cn('relative w-full', className)}>
        <div
          className="flex w-full items-center justify-between gap-2"
          onClick={handleClick}
        >
          {Array.from({ length: maxLength }).map((_, index) => {
            const isActive = index === value.length;
            const isFilled = index < value.length;
            const char = value[index] || '';

            return (
              <div
                key={index}
                className={cn(
                  'flex h-12 w-10 items-center justify-center rounded-md border border-input bg-background text-xl font-semibold transition-all',
                  isActive && 'border-primary ring-2 ring-primary/20',
                  !isActive && !isFilled && 'text-muted-foreground'
                )}
              >
                {char}
              </div>
            );
          })}
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={handleChange}
          maxLength={maxLength}
          className="absolute inset-0 h-full w-full opacity-0 cursor-text"
          type="tel" // Better keyboard on mobile
          autoComplete="one-time-code"
          {...props}
        />
      </div>
    );
  }
);

OtpInput.displayName = 'OtpInput';
