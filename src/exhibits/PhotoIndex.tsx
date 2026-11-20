import type { RefObject } from 'react';
import type { WingAlley } from '../../shared/types';
import { Icon } from '../Icons';
import type { DisplayExhibit, Manifest } from './manifest';

const chapters = ['How It Started', 'The Days We Keep', 'Only We Would Remember'];

export function PhotoIndex({ manifest, wingRooms, wingOnly, focusRegion, onOpen }: {
  manifest: Manifest;
  wingRooms: readonly WingAlley[];
  wingOnly?: boolean;
  focusRegion?: RefObject<HTMLElement | null>;
  onOpen: (exhibit: DisplayExhibit, letter?: boolean) => void;
}) {
  const RoomTitle = wingOnly ? 'h2' : 'h3';
  const newWing = <>
    {wingRooms.map(({ index, exhibits }) => <section className="wing-alley" key={index} aria-labelledby={`wing-room-${index}`}>
      <div className="wing-alley-heading"><RoomTitle id={`wing-room-${index}`}>Room {index + 1}</RoomTitle></div>
      <div className="photo-grid">
        {exhibits.map((exhibit) => <button className="photo-card" key={exhibit.id} onClick={() => onOpen(exhibit)}>
          <span className="photo-card-image"><img src={exhibit.thumbnailUrl} alt="" loading="lazy" /></span>
          <span className="photo-card-label">{exhibit.title}<Icon name="arrow" /></span>
        </button>)}
      </div>
    </section>)}
  </>;
  if (wingOnly) return <main className="collection-page" id="main-content" ref={focusRegion} tabIndex={-1}>
    <header className="collection-heading">
      <p className="eyebrow">The collection</p>
      <h1>The New Wing</h1>
      <p>{wingRooms.length ? 'Choose a photograph to read its story.' : 'New memories will hang here.'}</p>
    </header>
    {newWing}
  </main>;

  const finale = manifest.exhibits.find(({ id }) => id === manifest.finale.exhibitId)!;
  const photos = manifest.exhibits.filter(({ id }) => id !== finale.id);
  const chapterSize = Math.ceil(photos.length / chapters.length);
  return (
    <main className="collection-page" id="main-content">
      <header className="collection-heading">
        <p className="eyebrow">The collection</p>
        <h1>The Gallery of Us</h1>
        <p>Choose a photograph to read its story.</p>
      </header>
      {chapters.map((chapter, index) => {
        const exhibits = photos.slice(index * chapterSize, (index + 1) * chapterSize);
        if (!exhibits.length) return null;
        return <section key={chapter} className="photo-section">
          <h2>{chapter}</h2>
          <div className="photo-grid">
            {exhibits.map((exhibit) => <button className="photo-card" key={exhibit.id} onClick={() => onOpen(exhibit)}>
              <span className="photo-card-image"><img src={exhibit.thumbnailUrl} alt="" loading="lazy" /></span>
              <span className="photo-card-label">{exhibit.title}<Icon name="arrow" /></span>
            </button>)}
          </div>
        </section>;
      })}
      <section className="collection-finale" aria-labelledby="finale-heading">
        <img src={finale.thumbnailUrl} alt={finale.alt} loading="lazy" />
        <div>
          <p className="eyebrow">The final exhibit</p>
          <h2 id="finale-heading">{finale.title}</h2>
          <div className="button-row">
            <button className="button button--outline" onClick={() => onOpen(finale)}>View photograph <Icon name="arrow" /></button>
            <button className="button button--gold" onClick={() => onOpen(finale, true)}><Icon name="letter" /> Read the letter</button>
          </div>
        </div>
      </section>
      {wingRooms.length > 0 && <section className="new-wing" aria-labelledby="new-wing-heading">
        <header className="new-wing-heading">
          <p className="eyebrow">An expanding collection</p>
          <h2 id="new-wing-heading">The New Wing</h2>
          <p>Memories we’ve added along the way.</p>
        </header>
        {newWing}
      </section>}
    </main>
  );
}
