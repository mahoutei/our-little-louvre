import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Collection } from '../../shared/types';
import { api, ApiError } from '../api/client';
import { Icon } from '../Icons';
import { gsap, useMuseumMotion } from '../motion';
import { parseCollection } from './collection';
import type { DisplayExhibit } from './manifest';

type Props = {
  exhibit: DisplayExhibit;
  letter?: string[];
  letterTitle?: string;
  startWithLetter?: boolean;
  focusFallback?: RefObject<HTMLElement | null>;
  onClose: () => void;
  photoEditing?: {
    getToken: () => Promise<string | null>;
    onChange: (collection: Collection, removed: boolean) => void;
  };
};

export function ExhibitPanel({ exhibit, letter, letterTitle, startWithLetter, focusFallback, onClose, photoEditing }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [showLetter, setShowLetter] = useState(Boolean(startWithLetter || (letter && !exhibit.published)));
  const [failedImage, setFailedImage] = useState<{ full: string; fallback?: string }>();
  const imageSource = failedImage?.full === exhibit.imageUrl ? failedImage.fallback : exhibit.imageUrl;
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>('view');
  const [editor, setEditor] = useState<typeof import('./ExhibitEditor')>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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
      if (previous instanceof HTMLElement && previous !== document.body && previous.isConnected) previous.focus();
      else focusFallback?.current?.focus({ preventScroll: true });
    };
  }, [focusFallback]);

  useEffect(() => {
    content.current?.scrollTo(0, 0);
    title.current?.focus({ preventScroll: true });
  }, [showLetter, mode]);

  function show(next: typeof mode) {
    setError(undefined);
    setMode(next);
  }

  async function editPhoto() {
    show('edit');
    if (editor) return;
    try {
      setEditor(await import('./ExhibitEditor'));
    } catch {
      setMode('view');
      setError('The photo editor could not open. Try again.');
    }
  }

  async function changePhoto(save: (token: string) => Promise<Collection>, removed = false) {
    if (!photoEditing || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const token = await photoEditing.getToken();
      if (!token) throw new Error('Your key has expired. Sign in again to change this photo.');
      photoEditing.onChange(await save(token), removed);
      if (!removed) show('view');
    } catch (error) {
      setError(error instanceof ApiError && error.fields ? Object.values(error.fields).join(' ')
        : error instanceof Error ? error.message : 'The photo could not be changed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className={`exhibit-dialog${showLetter ? ' exhibit-dialog--letter' : mode === 'view' ? '' : ' exhibit-dialog--form'}`}
      aria-labelledby="exhibit-title" onCancel={(event) => {
        event.preventDefault();
        if (busy) return;
        if (mode === 'view') onClose();
        else show('view');
      }}>
      <button type="button" className="icon-button dialog-close" onClick={onClose} disabled={busy} aria-label="Close exhibit"><Icon name="close" /></button>
      <div className="dialog-content" ref={content}>
        {mode !== 'view' ? (
          <div className="exhibit-form">
            <h2 id="exhibit-title" ref={title} tabIndex={-1}>{mode === 'edit' ? 'Edit photo' : 'Remove this photo?'}</h2>
            {mode === 'edit' ? editor ? (
              <editor.ExhibitEditor exhibit={exhibit} busy={busy} showVisibility={false} onCancel={() => show('view')}
                onSave={(patch, photo) => changePhoto((token) => editor.savePhoto(token, exhibit.id, patch, photo, 'gallery'))} />
            ) : <p role="status">Opening the photo editor…</p> : <>
              <p>{exhibit.title} will be taken down.{letter ? ' The final letter will still be available.' : ''}</p>
              <div className="button-row">
                <button type="button" className="button button--outline" disabled={busy} onClick={() => show('view')}>Keep photo</button>
                <button type="button" className="button button--danger" disabled={busy}
                  onClick={() => void changePhoto(async (token) => {
                    const result = await api.deleteExhibit(token, exhibit.id, 'gallery');
                    return parseCollection(result.collection);
                  }, true)}>{busy ? 'Removing…' : 'Confirm removal'}</button>
              </div>
            </>}
            {error && <p className="exhibit-photo-error" role="alert">{error}</p>}
          </div>
        ) : showLetter && letter ? (
          <div className="letter-body">
            <Icon name="letter" size={30} />
            <h2 id="exhibit-title" ref={title} tabIndex={-1}>{letterTitle ?? 'A Letter for You'}</h2>
            {letter.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {exhibit.published && <button className="button button--outline" onClick={() => setShowLetter(false)}><Icon name="back" /> Back to photograph</button>}
          </div>
        ) : (
          <>
            <div className="exhibit-image">
              {imageSource ? <img src={imageSource} alt={exhibit.alt} onError={() => setFailedImage({
                full: exhibit.imageUrl,
                fallback: imageSource === exhibit.imageUrl && imageSource !== exhibit.thumbnailUrl ? exhibit.thumbnailUrl : undefined,
              })} /> : <p role="status">Photograph unavailable</p>}
            </div>
            <div className="exhibit-copy">
              {exhibit.dateLabel && <p className="eyebrow">{exhibit.dateLabel}</p>}
              <h2 id="exhibit-title" ref={title} tabIndex={-1}>{exhibit.title}</h2>
              <p>{exhibit.caption}</p>
              {letter && <button className="button button--gold" onClick={() => setShowLetter(true)}><Icon name="letter" /> Read the letter</button>}
              {photoEditing && exhibit.published && <div className="button-row">
                <button type="button" className="button button--outline" onClick={() => void editPhoto()}>Edit photo</button>
                <button type="button" className="button button--text" onClick={() => show('remove')}>Remove photo</button>
              </div>}
              {error && <p className="exhibit-photo-error" role="alert">{error}</p>}
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
