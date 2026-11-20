import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Collection } from '../shared/types';
import { api } from './api/client';
import { demoCollection } from './api/demo';
import { useAuth } from './auth/AuthProvider';
import { parseCollection } from './exhibits/collection';
import { ExhibitPanel } from './exhibits/ExhibitPanel';
import { loadManifest } from './exhibits/manifest';
import type { DisplayExhibit } from './exhibits/manifest';
import { PhotoIndex } from './exhibits/PhotoIndex';
import { Icon } from './Icons';
import { Welcome } from './Welcome';
import { gsap, useMuseumMotion } from './motion';
import { galleryReturnPose } from './museum/layout';
import type { Pose, Room } from './museum/layout';
import { visibleWingRooms } from './museum/wingLayout';

const loadMuseum = () => import('./museum/Museum');
const createMuseum = () => lazy(loadMuseum);
type View = 'welcome' | 'museum' | 'photos' | 'wing-photos';

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

const ROOM_LABELS: Record<Room, { eyebrow: string; title: string; loading: string }> = {
  courtyard: { eyebrow: 'After closing', title: 'The Courtyard', loading: 'Opening the courtyard…' },
  gallery: { eyebrow: 'Private collection', title: 'The Gallery of Us', loading: 'Opening the gallery…' },
  wing: { eyebrow: 'Room 1', title: 'The New Wing', loading: 'Opening the New Wing…' },
};

export function App() {
  const auth = useAuth();
  const { demo, token: getToken } = auth;
  const [Museum, setMuseum] = useState(createMuseum);
  const [view, setView] = useState<View>('welcome');
  const [room, setRoom] = useState<Room>('courtyard');
  const [ready, setReady] = useState<Room>();
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [collection, setCollection] = useState<Collection>();
  const [contentFailed, setContentFailed] = useState(false);
  const [selection, setSelection] = useState<{ exhibit: DisplayExhibit; letter?: boolean }>();
  const [visited, setVisited] = useState(false);
  const [reset, setReset] = useState(0);
  const [doorRequest, setDoorRequest] = useState(0);
  const [atDoor, setAtDoor] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [gallerySpawn, setGallerySpawn] = useState<Pose>();
  const [wingRoomIndex, setWingRoomIndex] = useState(0);
  const load = useRef<Promise<Collection> | undefined>(undefined);
  const returnFromPhotos = useRef<'welcome' | 'museum'>('welcome');
  const returningFromWingPhotos = useRef(false);
  const wingEntrance = useRef<HTMLButtonElement>(null);
  const wingPhotoEntrance = useRef<HTMLButtonElement>(null);
  const region = useRef<HTMLElement>(null);
  const hasLeftWelcome = useRef(false);
  const retryAttempt = useRef(0);
  const manifest = collection?.manifest;
  const wing = collection?.wing;
  const wingRooms = useMemo(() => visibleWingRooms(wing), [wing]);

  function showView(value: View) {
    if (value !== 'welcome') hasLeftWelcome.current = true;
    setView(value);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    const entrance = view === 'museum' && returningFromWingPhotos.current
      ? (room === 'wing' ? wingPhotoEntrance.current : wingEntrance.current)
      : null;
    returningFromWingPhotos.current = false;
    (entrance ?? region.current)?.focus({ preventScroll: true });
  }, [view, room]);

  const loadCollection = useCallback(() => {
    if (load.current) return load.current;
    setContentFailed(false);
    const run = (async () => {
      if (demo) return demoCollection(await loadManifest());
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Sign in again.');
      const result = await api.collection(token);
      return parseCollection(result.collection);
    })();
    load.current = run;
    void run.then((next) => setCollection(next), () => {
      load.current = undefined;
      setContentFailed(true);
    });
    return run;
  }, [demo, getToken]);

  useEffect(() => { void loadCollection(); }, [loadCollection]);

  function retryCollection() {
    load.current = undefined;
    void loadCollection();
  }

  function browse() {
    if (view === 'museum' && room === 'wing') {
      showView('wing-photos');
      return;
    }
    if (view !== 'photos') returnFromPhotos.current = view === 'museum' ? 'museum' : 'welcome';
    void loadCollection();
    showView('photos');
  }

  function returnFromWing() {
    returningFromWingPhotos.current = true;
    showView('museum');
  }

  function start() {
    void loadCollection();
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
    setGallerySpawn(undefined);
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

  const openExhibit = useCallback((exhibit: DisplayExhibit, letter?: boolean) => setSelection({ exhibit, letter }), []);
  const unlockDoor = useCallback(() => setUnlocking(true), []);
  const enterGallery = useCallback(() => {
    setGallerySpawn(undefined);
    setRoom('gallery');
    setAtDoor(false);
    setUnlocking(false);
  }, []);
  function enterWing() {
    if (!wing) return;
    if (!wingRooms.length) {
      showView('wing-photos');
      return;
    }
    setWingRoomIndex(0);
    setRoom('wing');
    setReady(undefined);
  }
  const leaveWing = useCallback(() => {
    setGallerySpawn(galleryReturnPose);
    setRoom('gallery');
    setReady(undefined);
    setFailed(false);
    setVisited(true);
  }, []);
  const failWalkthrough = useCallback(() => { setFailed(true); setReady(undefined); setVisited(false); setUnlocking(false); }, []);
  const loading = !failed && ready !== room;
  const roomLabel = ROOM_LABELS[room];

  return (
    <div className={`app app--${view === 'wing-photos' ? 'photos' : view}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      {view !== 'welcome' && <header className="masthead">
        <button className="wordmark" onClick={welcome} aria-label="Our Little Louvre, welcome">
          <img src="/pyramid.svg" alt="" width="35" height="35" /> <span>Our Little Louvre</span>
        </button>
        <nav className="masthead-actions" aria-label="Museum">
          {view === 'wing-photos' ? <button className="masthead-link" onClick={returnFromWing}><Icon name="back" /> {room === 'wing' ? 'Back to the New Wing' : 'Back to the gallery'}</button>
            : view === 'photos' ? <button className="masthead-link" onClick={() => showView(returnFromPhotos.current)}><Icon name="back" /> {returnFromPhotos.current === 'museum' ? 'Back to museum' : 'Back to invitation'}</button>
            : (room !== 'wing' || !failed) && <button className="masthead-link" ref={room === 'wing' ? wingPhotoEntrance : undefined} onClick={browse}><Icon name="collection" /> {room === 'wing' ? 'Browse New Wing photos' : 'Browse photos'}</button>}
          {!auth.demo && <a className="masthead-link masthead-link--quiet" href="/studio">Private studio</a>}
        </nav>
      </header>}
      {view === 'welcome' && <Welcome focusRegion={region} animateEntrance={!hasLeftWelcome.current} onStart={start} onBrowse={browse} />}
      {view === 'photos' && (
        <div className="photo-shell" ref={region as React.RefObject<HTMLDivElement>} tabIndex={-1}>
          {manifest ? <PhotoIndex manifest={manifest} wingRooms={wingRooms} onOpen={openExhibit} /> : <main id="main-content" className="center-state">
            {contentFailed ? <><h1>The photos couldn’t load</h1><button className="button button--gold" onClick={retryCollection}>Try again</button></> : <p role="status">Opening the collection…</p>}
          </main>}
        </div>
      )}
      {view === 'wing-photos' && manifest && <PhotoIndex manifest={manifest} wingRooms={wingRooms} wingOnly focusRegion={region} onOpen={openExhibit} />}
      {(view === 'museum' || visited) && (
        <main className="walkthrough" id={view === 'museum' ? 'main-content' : undefined} ref={view === 'museum' ? region : undefined} tabIndex={-1} hidden={view !== 'museum'}>
          {visited && !failed && <MuseumBoundary onFailure={failWalkthrough}>
            <Suspense fallback={null}>
              <Museum room={room} manifest={manifest} wingRooms={wingRooms} wingRoomIndex={wingRoomIndex} onWingRoomChange={setWingRoomIndex}
                spawn={gallerySpawn} active={view === 'museum' && !selection && !loading && !unlocking} visible={view === 'museum'} reset={reset}
                doorRequest={doorRequest} unlocking={unlocking} onDoorProximity={setAtDoor} onUnlock={unlockDoor}
                onReady={setReady} onDoorOpened={enterGallery} onOpen={openExhibit} onFailure={failWalkthrough} />
            </Suspense>
          </MuseumBoundary>}
          {loading && <div className="walkthrough-state" role="status"><span className="loading-ring" />{roomLabel.loading}</div>}
          {failed && <div className="walkthrough-state">
            <h1>The walkthrough is unavailable</h1>
            <div className="button-row walkthrough-recovery">
              <button className="button button--gold" disabled={retrying} onClick={retryWalkthrough}><Icon name="reset" /> {retrying ? 'Reopening…' : 'Retry walkthrough'}</button>
              <button className="button button--outline" ref={room === 'wing' ? wingPhotoEntrance : undefined} onClick={browse}>{room === 'wing' ? 'Browse New Wing photos' : 'Browse photos'} <Icon name="arrow" /></button>
              {room === 'wing' && <button className="button button--outline" onClick={leaveWing}><Icon name="back" /> Back to the gallery</button>}
            </div>
          </div>}
          {!loading && !failed && <>
            <RoomReveal key={room} />
            <div className="scene-caption"><p className="eyebrow">{room === 'wing' ? `Room ${(wingRooms[wingRoomIndex]?.index ?? 0) + 1}` : roomLabel.eyebrow}</p><h1>{roomLabel.title}</h1></div>
            <div className="scene-actions">
              <button className="button button--glass reset-view" type="button" aria-label="Reset view" disabled={unlocking} onClick={() => setReset((current) => current + 1)}><Icon name="reset" size={17} /><span>Reset view</span></button>
              {room === 'courtyard' && <button className="button button--gold" type="button" disabled={unlocking}
                onClick={atDoor ? unlockDoor : () => setDoorRequest((current) => current + 1)}>
                <Icon name="key" />{unlocking ? 'Unlocking…' : atDoor ? 'Use brass key' : 'Go to pyramid door'}
              </button>}
              {room === 'gallery' && <button className="button button--gold" type="button" ref={wingEntrance} onClick={enterWing} disabled={!wing}>
                <Icon name="collection" /> {!wing && !contentFailed ? 'Loading the New Wing…' : 'Visit the New Wing'}
              </button>}
              {room === 'wing' && <button className="button button--gold" type="button" onClick={leaveWing}>
                <Icon name="back" /> Back to the gallery
              </button>}
            </div>
            {room === 'courtyard' && atDoor && !unlocking && <p className="door-prompt">Press <kbd>E</kbd> or select Use brass key.</p>}
            {(room === 'gallery' || room === 'wing') && contentFailed && <aside className="content-error">The exhibits couldn’t load. <button onClick={retryCollection}>Try again</button></aside>}
          </>}
        </main>
      )}
      {selection && <ExhibitPanel key={selection.exhibit.id} exhibit={selection.exhibit} startWithLetter={selection.letter} onClose={() => setSelection(undefined)}
        letter={selection.exhibit.id === manifest?.finale.exhibitId ? manifest.finale.letterParagraphs : undefined}
        letterTitle={manifest?.finale.letterTitle} />}
    </div>
  );
}
