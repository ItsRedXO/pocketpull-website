import React from 'react';

interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; }

export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.error('[SectionErrorBoundary]', err.message); }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[10px] text-white/20 text-center py-4">Could not load this section.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
