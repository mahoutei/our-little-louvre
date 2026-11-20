import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Icon } from './Icons';
import { gsap, useMuseumMotion } from './motion';
import './entry.css';

export function Welcome({ focusRegion, animateEntrance, onStart, onBrowse }: {
  focusRegion: RefObject<HTMLElement | null>;
  animateEntrance: boolean;
  onStart: () => void;
  onBrowse: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const envelope = useRef<HTMLButtonElement>(null);
  const salutation = useRef<HTMLHeadingElement>(null);
  const hasInteracted = useRef(false);

  useLayoutEffect(() => {
    if (hasInteracted.current) (opened ? salutation.current : envelope.current)?.focus({ preventScroll: true });
  }, [opened]);

  useMuseumMotion(focusRegion, () => {
    if (animateEntrance) gsap.from('.entry-background', { opacity: 0.62, duration: 0.65, ease: 'power2.out', clearProps: 'opacity' });
  });

  useMuseumMotion(focusRegion, () => {
    if (opened) {
      gsap.from('.entry-note', { y: 19, rotate: -3, opacity: 0.5, duration: 0.48, ease: 'power3.out', clearProps: 'transform,opacity' });
    }
  }, [opened]);

  function setNote(next: boolean) {
    hasInteracted.current = true;
    setOpened(next);
  }

  return <main id="main-content" className="entry-scene" ref={focusRegion} tabIndex={-1}>
    <picture>
      <source media="(max-width: 720px)" srcSet="/media/invitation-desk-phone.webp" />
      <img className="entry-background" src="/media/invitation-desk.webp" alt="" width="1536" height="1024" fetchPriority="high" />
    </picture>
    <div className="entry-stage">
      {opened ? <article className="entry-note" aria-labelledby="entry-salutation">
        <button className="entry-note-close" onClick={() => setNote(false)} aria-label="Close the note"><Icon name="close" size={16} /></button>
        <h1 id="entry-salutation" ref={salutation} tabIndex={-1}>My love,</h1>
        <p>I wanted to give you one night at the Louvre, just us. I hung a few of my favorite photographs of us inside.</p>
        <p>This key opens the pyramid door. I left something for you at the end.</p>
        <p className="entry-signature">With love</p>
        <button className="entry-key" onClick={onStart}>
          <span className="entry-key-object"><Icon name="key" size={29} /></span>
          <span>Take the brass key</span><Icon name="arrow" size={17} />
        </button>
      </article> : <>
        <h1 className="entry-screen-title">Our Little Louvre</h1>
        <button className="entry-envelope" ref={envelope} onClick={() => setNote(true)} aria-label="Open the envelope">
          <span className="envelope-sheet" aria-hidden="true">
            <span className="envelope-flap" />
            <span className="envelope-inscription">For you</span>
            <span className="envelope-seal"><img src="/pyramid.svg" alt="" width="26" height="26" /></span>
          </span>
          <span className="envelope-instruction">Open the envelope <Icon name="arrow" size={16} /></span>
        </button>
      </>}
    </div>
    <div className="entry-alternative">
      <button className="masthead-link" onClick={onBrowse}><Icon name="collection" size={17} /> Browse photos</button>
    </div>
  </main>;
}
