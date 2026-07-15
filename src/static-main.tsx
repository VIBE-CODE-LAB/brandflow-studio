import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { StudioFlow } from "@/routes";
import "./styles.css";

class StaticAppBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background px-5 py-10 text-foreground">
          <div className="mx-auto max-w-xl rounded-2xl border border-border bg-paper p-6 shadow-sm">
            <h1 className="font-display text-2xl">Studio could not load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Refresh the page once. If it keeps happening, the browser blocked or crashed a
              required script.
            </p>
            <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-muted p-3 text-xs">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(
    <StrictMode>
      <StaticAppBoundary>
        <StudioFlow />
      </StaticAppBoundary>
    </StrictMode>,
  );
}
