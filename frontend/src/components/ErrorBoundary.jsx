import { Component } from "react";

// A bug in one page must never blank the whole site: show a recoverable message instead.
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UI error:", error, info?.componentStack); }
  componentDidUpdate(prev) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-2xl font-display font-bold mb-2">Something went wrong on this page</h1>
        <p className="text-sm text-ink-light/60 dark:text-ink-dark/60 max-w-md mb-5">The rest of the site still works. Try again, or go back home.</p>
        <div className="flex gap-3">
          <button className="btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
          <a className="btn-secondary" href="/">Go home</a>
        </div>
      </div>
    );
  }
}
export default ErrorBoundary;
