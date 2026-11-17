import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ExhibitPanel } from './exhibits/ExhibitPanel';
import { loadManifest } from './exhibits/manifest';
import type { Exhibit, Manifest } from './exhibits/manifest';
import { PhotoIndex } from './exhibits/PhotoIndex';
import { Icon } from './Icons';
import { Welcome } from './Welcome';
import { gsap, useMuseumMotion } from './motion';
import type { Room } from './museum/layout';

const loadMuseum = () => import('./museum/Museum');
const createMuseum = () => lazy(loadMuseum);
type View = 'welcome' | 'museum' | 'photos';

function RoomReveal() {
  const veil = useRef<HTMLDivElement>(null);
  useMuseumMotion(veil, () => {
    gsap.fromTo(veil.current, { opacity: 0.78 }, { opacity: 0, duration: 0.54, ease: 'power2.out', clearProps: 'opacity' });
  });
  return <div ref={veil} className="room-reveal" aria-hidden="true" />;
}

class MuseumBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.error('The museum walkthrough could not open.', error);
    this.props.onFailure();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export function App() {
  const [Museum, setMuseum] = useState(createMuseum);
  const [view, setView] = useState<View>('welcome');
  const [room, setRoom] = useState<Room>('courtyard');
  const [ready, setReady] = useState<Room>();
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [manifest, setManifest] = useState<Manifest>();
  const [contentFailed, setContentFailed] = useState(false);
  const [selection, setSelection] = useState<{ exhibit: Exhibit; letter?: boolean }>();
  const [visited, setVisited] = useState(false);
  const [reset, setReset] = useState(0);
  const [doorRequest, setDoorRequest] = useState(0);
  const [atDoor, setAtDoor] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const load = useRef<Promise<Manifest> | undefined>(undefined);
  const returnFromPhotos = useRef<View>('welcome');
  const region = useRef<HTMLElement>(null);
  const hasLeftWelcome = useRef(false);
  const retryAttempt = useRef(0);

  function showView(value: View) {
    if (value !== 'welcome') hasLeftWelcome.current = true;
    setView(value);
    window.scrollTo(0, 0);
  }

  useEffect(() => { region.current?.focus({ preventScroll: true }); }, [view]);

  function getCollection() {
    if (load.current) return;
    setContentFailed(false);
    load.current = loadManifest();
    void load.current.then(setManifest, () => {
      load.current = undefined;
      setContentFailed(true);
    });
  }

  function browse() {
    if (view !== 'photos') returnFromPhotos.current = view;
    getCollection();
    showView('photos');
  }

  function start() {
    getCollection();
    setFailed(false);
    setVisited(true);
    showView('museum');
  }

  function welcome() {
    retryAttempt.current++;
    setRetrying(false);
    setVisited(false);
    setReady(undefined);
    setFailed(false);
    setRoom('courtyard');
    setAtDoor(false);
    setUnlocking(false);
    showView('welcome');
  }

  async function retryWalkthrough() {
    const attempt = ++retryAttempt.current;
    setRetrying(true);
    try {
      const { clearRoomModel } = await loadMuseum();
      if (attempt !== retryAttempt.current) return;
      clearRoomModel(room);
      region.current?.focus({ preventScroll: true });
      setMuseum(createMuseum);
      setAtDoor(false);
      setFailed(false);
      setVisited(true);
    } catch {
      if (attempt === retryAttempt.current) window.location.reload();
    } finally {
      if (attempt === retryAttempt.current) setRetrying(false);
    }
  }

  const openExhibit = useCallback((exhibit: Exhibit, letter?: boolean) => setSelection({ exhibit, letter }), []);
  const unlockDoor = useCallback(() => setUnlocking(true), []);
  const enterGallery = useCallback(() => {
    setRoom('gallery');
    setAtDoor(false);
    setUnlocking(false);
  }, []);
  const failWalkthrough = useCallback(() => { setFailed(true); setReady(undefined); setVisited(false); setUnlocking(false); }, []);
  const loading = !failed && ready !== room;

  return (
    <div className={`app app--${view}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {view !== 'welcome' && <header className="masthead">
        <button className="wordmark" onClick={welcome} aria-label="Our Little Louvre, welcome">
          <img src="/pyramid.svg" alt="" width="35" height="35" /> <span>Our Little Louvre</span>
        </button>
        {view === 'photos' ? <button className="masthead-link" onClick={() => showView(returnFromPhotos.current)}><Icon name="back" /> {returnFromPhotos.current === 'museum' ? 'Back to museum' : 'Back to invitation'}</button>
          : <button className="masthead-link" onClick={browse}><Icon name="collection" /> Browse photos</button>}
      </header>}
      {view === 'welcome' && <Welcome focusRegion={region} animateEntrance={!hasLeftWelcome.current} onStart={start} onBrowse={browse} />}
      {view === 'photos' && (
        <div className="photo-shell" ref={region as React.RefObject<HTMLDivElement>} tabIndex={-1}>
          {manifest ? <PhotoIndex manifest={manifest} onOpen={openExhibit} /> : <main id="main-content" className="center-state">
            {contentFailed ? <><h1>The photos couldn’t load</h1><button className="button button--gold" onClick={getCollection}>Try again</button></> : <p role="status">Opening the collection…</p>}
          </main>}
        </div>
      )}
      {(view === 'museum' || visited) && (
        <main className="walkthrough" id={view === 'museum' ? 'main-content' : undefined} ref={view === 'museum' ? region : undefined} tabIndex={-1} hidden={view !== 'museum'}>
          {visited && !failed && <MuseumBoundary onFailure={failWalkthrough}>
            <Suspense fallback={null}>
              <Museum room={room} manifest={manifest} active={view === 'museum' && !selection && !loading && !unlocking} visible={view === 'museum'} reset={reset}
                doorRequest={doorRequest} unlocking={unlocking} onDoorProximity={setAtDoor} onUnlock={unlockDoor}
                onReady={setReady} onDoorOpened={enterGallery} onOpen={openExhibit} onFailure={failWalkthrough} />
            </Suspense>
          </MuseumBoundary>}
          {loading && <div className="walkthrough-state" role="status"><span className="loading-ring" />{room === 'courtyard' ? 'Opening the courtyard…' : 'Opening the gallery…'}</div>}
          {failed && <div className="walkthrough-state">
            <h1>The walkthrough is unavailable</h1>
            <div className="button-row walkthrough-recovery">
              <button className="button button--gold" disabled={retrying} onClick={retryWalkthrough}><Icon name="reset" /> {retrying ? 'Reopening…' : 'Retry walkthrough'}</button>
              <button className="button button--outline" onClick={browse}>Browse photos <Icon name="arrow" /></button>
            </div>
          </div>}
          {!loading && !failed && <>
            <RoomReveal key={room} />
            <div className="scene-caption"><p className="eyebrow">{room === 'courtyard' ? 'After closing' : 'Private collection'}</p><h1>{room === 'courtyard' ? 'The Courtyard' : 'The Gallery of Us'}</h1></div>
            <div className="scene-actions">
              <button className="button button--glass reset-view" type="button" aria-label="Reset view" disabled={unlocking} onClick={() => setReset((current) => current + 1)}><Icon name="reset" size={17} /><span>Reset view</span></button>
              {room === 'courtyard' && <button className="button button--gold" type="button" disabled={unlocking}
                onClick={atDoor ? unlockDoor : () => setDoorRequest((current) => current + 1)}>
                <Icon name="key" />{unlocking ? 'Unlocking…' : atDoor ? 'Use brass key' : 'Go to pyramid door'}
              </button>}
            </div>
            {room === 'courtyard' && atDoor && !unlocking && <p className="door-prompt">Press <kbd>E</kbd> or select Use brass key.</p>}
            {room === 'gallery' && contentFailed && <aside className="content-error">The exhibits couldn’t load. <button onClick={getCollection}>Try again</button></aside>}
          </>}
        </main>
      )}
      {selection && <ExhibitPanel key={selection.exhibit.id} exhibit={selection.exhibit} startWithLetter={selection.letter} onClose={() => setSelection(undefined)}
        letter={selection.exhibit.id === manifest?.finale.exhibitId ? manifest.finale.letterParagraphs : undefined} />}
    </div>
  );
}
