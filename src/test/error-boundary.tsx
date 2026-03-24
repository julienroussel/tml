import { Component, type ComponentType, type ReactNode } from "react";

interface ErrorComponentProps {
  error: Error & { digest?: string };
  reset: () => void;
}

interface TestErrorBoundaryProps {
  children: ReactNode;
  errorComponent: ComponentType<ErrorComponentProps>;
}

interface TestErrorBoundaryState {
  error: (Error & { digest?: string }) | null;
}

/**
 * Test-only error boundary that renders the provided error component on catch.
 * Mirrors Next.js error.tsx behaviour: passes `error` and `reset` props.
 * React mandates a class component for error boundaries.
 */
class TestErrorBoundary extends Component<
  TestErrorBoundaryProps,
  TestErrorBoundaryState
> {
  state: TestErrorBoundaryState = { error: null };

  static getDerivedStateFromError(
    error: Error
  ): Partial<TestErrorBoundaryState> {
    return { error };
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const ErrorComponent = this.props.errorComponent;
      return <ErrorComponent error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

export type { ErrorComponentProps };
export { TestErrorBoundary };
