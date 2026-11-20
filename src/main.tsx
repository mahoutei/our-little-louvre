import { Component, StrictMode, Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import { AuthGate } from './auth/AuthGate';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';

const Studio = lazy(() => import('./studio/Studio').then((module) => ({ default: module.Studio })));
const App = lazy(() => import('./App').then((module) => ({ default: module.App })));

class EntryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="center-state">
      <h1>The page couldn’t open</h1>
      <button className="button button--gold" onClick={() => window.location.reload()}>Reload page</button>
    </main>;
  }
}

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const studio = path === '/studio' || path.startsWith('/studio/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <EntryBoundary>
          <Suspense fallback={<main className="center-state"><span className="loading-ring" /><p role="status">Opening…</p></main>}>
            {studio ? <Studio /> : <App />}
          </Suspense>
        </EntryBoundary>
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
