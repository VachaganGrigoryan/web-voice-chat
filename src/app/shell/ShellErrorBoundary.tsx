import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ShellErrorBoundaryProps {
  children: ReactNode;
  /** Changing this value clears the error, so navigating away recovers the region. */
  resetKey: string;
}

interface ShellErrorBoundaryState {
  error: Error | null;
}

/**
 * Wraps only the routed region. The rail sits above the router outlet now, so a
 * throw inside one destination must not take the whole application down with it —
 * navigation has to survive the failure that made the page unusable.
 */
export class ShellErrorBoundary extends Component<
  ShellErrorBoundaryProps,
  ShellErrorBoundaryState
> {
  state: ShellErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ShellErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(previousProps: ShellErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Shell route error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">This page hit an error</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            The rest of the app still works — pick another destination from the sidebar, or
            try loading this one again.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer gap-2"
          onClick={() => this.setState({ error: null })}
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }
}
