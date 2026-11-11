import { Component, type ReactNode } from 'react';

interface Props {
  /** Shown instead of the children after a render error. */
  fallback: (message: string) => ReactNode;
  children: ReactNode;
}

/** Catches a render error so a log the viewer cannot draw shows a message, not a blank page. */
export class ErrorBoundary extends Component<Props, { message: string | null }> {
  override state = { message: null as string | null };

  static getDerivedStateFromError(error: unknown): { message: string } {
    const detail = error instanceof Error ? error.message : String(error);
    return { message: `This log could not be shown (${detail}). Try another log.` };
  }

  override render(): ReactNode {
    return this.state.message === null ? this.props.children : this.props.fallback(this.state.message);
  }
}
