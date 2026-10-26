import React from 'react';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  declare props: { children: React.ReactNode };
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[app] Render failed', error, info.componentStack);
  }
  render() {
    if (this.state.failed) return <div dir="rtl" role="alert" className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p>אירעה שגיאה בתצוגה. אפשר לטעון מחדש ולנסות שוב.</p>
      <button className="rounded-xl bg-primary px-6 py-3 text-white" onClick={() => window.location.reload()}>טען מחדש</button>
    </div>;
    return this.props.children;
  }
}
