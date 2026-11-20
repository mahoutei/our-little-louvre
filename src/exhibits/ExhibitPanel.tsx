import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { gsap, useMuseumMotion } from '../motion';
import type { DisplayExhibit } from './manifest';

type Props = { exhibit: DisplayExhibit; letter?: string[]; letterTitle?: string; startWithLetter?: boolean; onClose: () => void };

export function ExhibitPanel({ exhibit, letter, letterTitle, startWithLetter, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [showLetter, setShowLetter] = useState(Boolean(startWithLetter || (letter && !exhibit.published)));
  const [imageSource, setImageSource] = useState<string | undefined>(exhibit.imageUrl);

  useMuseumMotion(dialog, () => {
    if (showLetter && letter) {
      gsap.from('.letter-body h2, .letter-body p', {
        opacity: 0.45, y: 7, duration: 0.34, stagger: 0.045, ease: 'power2.out', clearProps: 'opacity,transform',
      });
    }
  }, [showLetter, letter]);

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous !== document.body && document.contains(previous)) previous.focus();
    };
  }, []);

  useEffect(() => {
    content.current?.scrollTo(0, 0);
    title.current?.focus({ preventScroll: true });
  }, [showLetter]);

  return (
    <dialog ref={dialog} className={`exhibit-dialog${showLetter ? ' exhibit-dialog--letter' : ''}`} aria-labelledby="exhibit-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button type="button" className="icon-button dialog-close" onClick={onClose} aria-label="Close exhibit"><Icon name="close" /></button>
      <div className="dialog-content" ref={content}>
        {showLetter && letter ? (
          <div className="letter-body">
            <Icon name="letter" size={30} />
            <h2 id="exhibit-title" ref={title} tabIndex={-1}>{letterTitle ?? 'A Letter for You'}</h2>
            {letter.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {exhibit.published && <button className="button button--outline" onClick={() => setShowLetter(false)}><Icon name="back" /> Back to photograph</button>}
          </div>
        ) : (
          <>
            <div className="exhibit-image">
              {imageSource ? <img src={imageSource} alt={exhibit.alt} onError={() => setImageSource(imageSource === exhibit.imageUrl ? exhibit.thumbnailUrl : undefined)} /> : <p role="status">Photograph unavailable</p>}
            </div>
            <div className="exhibit-copy">
              {exhibit.dateLabel && <p className="eyebrow">{exhibit.dateLabel}</p>}
              <h2 id="exhibit-title" ref={title} tabIndex={-1}>{exhibit.title}</h2>
              <p>{exhibit.caption}</p>
              {letter && <button className="button button--gold" onClick={() => setShowLetter(true)}><Icon name="letter" /> Read the letter</button>}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
