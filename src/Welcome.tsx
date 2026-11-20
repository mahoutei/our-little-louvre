import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Icon } from './Icons';
import { gsap, useMuseumMotion } from './motion';
import './entry.css';

const OPENING_BEATS = [
  'When the last visitor left, I kept a key for you.',
  'I hung a few of my favorite photographs of us inside.',
  'I left something for you in the last room.',
];
const BEAT_DURATION = 4000;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function Welcome({ focusRegion, animateEntrance, onStart, onBrowse }: {
  focusRegion: RefObject<HTMLElement | null>;
  animateEntrance: boolean;
  onStart: () => void;
  onBrowse: () => void;
}) {
  const [beat, setBeat] = useState(animateEntrance ? 0 : OPENING_BEATS.length);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia(REDUCED_MOTION).matches);
  const remaining = useRef(BEAT_DURATION);
  const playback = useRef<HTMLDivElement>(null);
  const keyButton = useRef<HTMLButtonElement>(null);
  const focusKey = useRef(false);
  const revealed = beat === OPENING_BEATS.length;

  const moveToBeat = useCallback((next: number, fromButton = false) => {
    if (next === OPENING_BEATS.length) {
      focusKey.current = fromButton || !!playback.current?.contains(document.activeElement);
    }
    remaining.current = BEAT_DURATION;
    setBeat(next);
  }, []);

  useLayoutEffect(() => {
    if (revealed && focusKey.current) keyButton.current?.focus({ preventScroll: true });
  }, [revealed]);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION);
    const syncPreference = () => setReducedMotion(media.matches);
    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => media.removeEventListener('change', syncPreference);
  }, []);

  useEffect(() => {
    if (revealed || reducedMotion || paused) return;
    let timer: number | undefined;
    let startedAt = 0;

    function stop() {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
      remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt));
    }

    function syncVisibility() {
      if (document.hidden) {
        stop();
      } else if (timer === undefined) {
        startedAt = performance.now();
        timer = window.setTimeout(() => {
          stop();
          if (!document.hidden) moveToBeat(beat + 1);
        }, remaining.current);
      }
    }

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [beat, moveToBeat, paused, reducedMotion, revealed]);

  useMuseumMotion(focusRegion, () => {
    if (animateEntrance) gsap.from('.entry-background', { opacity: 0.62, duration: 0.65, ease: 'power2.out', clearProps: 'opacity' });
  });

  useMuseumMotion(focusRegion, () => {
    if (!animateEntrance) return;
    if (revealed) {
      gsap.from('.entry-key-object', { y: 10, opacity: 0.28, duration: 0.48, ease: 'power2.out', clearProps: 'transform,opacity' });
    } else {
      gsap.from('.entry-beat', { opacity: 0.14, duration: 0.38, ease: 'power2.out', clearProps: 'opacity' });
    }
  }, [beat]);

  return <main id="main-content" className="entry-scene" ref={focusRegion} tabIndex={-1}>
    <picture>
      <source media="(max-width: 720px)" srcSet="/media/invitation-desk-phone.webp" />
      <img className="entry-background" src="/media/invitation-desk.webp" alt="" width="1536" height="1024" fetchPriority="high" />
    </picture>
    <h1 className="entry-sr-only">Our Little Louvre</h1>
    <div className="entry-stage">
      <div className="entry-story" aria-live="polite" aria-atomic="true">
        {revealed ? <p className="entry-sr-only">The brass key is ready.</p> : <p className="entry-beat" key={beat}>{OPENING_BEATS[beat]}</p>}
      </div>
      <div className={`entry-envelope${revealed ? ' entry-envelope--open' : ''}`} aria-hidden="true">
        <span className="envelope-sheet">
          <span className="envelope-flap" />
          {revealed
            ? <span className="entry-key-object"><Icon name="key" size={76} /></span>
            : <span className="envelope-seal"><img src="/pyramid.svg" alt="" width="26" height="26" /></span>}
        </span>
      </div>
      {revealed && <button className="button button--gold entry-key" ref={keyButton} onClick={onStart}>
        Take the brass key <Icon name="arrow" size={17} />
      </button>}
    </div>
    <div className="entry-controls">
      {!revealed && <div className="entry-playback" ref={playback}>
        {reducedMotion
          ? <button className="masthead-link" onClick={() => moveToBeat(beat + 1, true)}>Continue</button>
          : <button className="masthead-link" onClick={() => setPaused((value) => !value)}>{paused ? 'Resume' : 'Pause'}</button>}
        <button className="masthead-link" onClick={() => moveToBeat(OPENING_BEATS.length, true)}>Skip opening</button>
      </div>}
      <button className="masthead-link" onClick={onBrowse}><Icon name="collection" size={17} /> Browse photos</button>
    </div>
  </main>;
}
