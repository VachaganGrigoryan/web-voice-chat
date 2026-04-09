import { BRAND } from '@/shared/branding/brand';
import { LogoSymbol } from '@/shared/branding/LogoSymbol';

export function ChatWelcomeState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-4 text-center text-muted-foreground">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white shadow-sm dark:bg-white dark:text-black">
        <LogoSymbol size="lg" className="animate-[pulse_3.6s_ease-in-out_infinite]" />
      </div>
      <h3 className="mb-2 text-xl font-bold text-foreground">Welcome to {BRAND.name}</h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        {BRAND.description} Select a user from the sidebar to start chatting.
      </p>
    </div>
  );
}
