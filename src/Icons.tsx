import type { ReactNode } from 'react';

const paths: Record<string, ReactNode> = {
  arrow: <><path d="M3 12h17M14 6l6 6-6 6" /></>,
  back: <><path d="M21 12H4M10 6l-6 6 6 6" /></>,
  collection: <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="m4 17 5-5 4 4 3-3 4 4" /><circle cx="15.5" cy="8.5" r="1.5" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  reset: <><path d="M4 11a8 8 0 1 1 2 7M4 5v6h6" /></>,
  letter: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 7 9 6 9-6" /></>,
  key: <><circle cx="7.5" cy="7.5" r="4.25" /><path d="m10.5 10.5 10 10m-3.25-3.25 2.5-2.5m-5.4-0.4 2.2-2.2" /></>,
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
};

export function Icon({ name, size = 19 }: { name: keyof typeof paths; size?: number }) {
  return <svg data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
