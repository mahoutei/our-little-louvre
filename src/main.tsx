import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import { App } from './App';
import { AuthGate } from './auth/AuthGate';
import { AuthProvider } from './auth/AuthProvider';
import './styles.css';

const Studio = lazy(() => import('./studio/Studio').then((module) => ({ default: module.Studio })));

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const studio = path === '/studio' || path.startsWith('/studio/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        {studio ? <Suspense fallback={<div className="studio studio--state"><span className="loading-ring" /><p role="status">Opening the private studio…</p></div>}>
          <Studio />
        </Suspense> : <App />}
      </AuthGate>
    </AuthProvider>
  </StrictMode>,
);
