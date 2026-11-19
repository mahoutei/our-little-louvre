import type { Wing } from '../../shared/types';
import { Icon } from '../Icons';
import type { DisplayExhibit, Manifest } from './manifest';

const chapters = ['How It Started', 'The Days We Keep', 'Only We Would Remember'];

export function PhotoIndex({ manifest, wing, onOpen }: {
  manifest: Manifest;
  wing?: Wing;
  onOpen: (exhibit: DisplayExhibit, letter?: boolean) => void;
}) {
  const finale = manifest.exhibits.find(({ id }) => id === manifest.finale.exhibitId)!;
  const photos = manifest.exhibits.filter(({ id }) => id !== finale.id);
  const chapterSize = Math.ceil(photos.length / chapters.length);
  const wingPhotos = wing?.alleys.flatMap((alley) => alley.exhibits).filter((exhibit) => exhibit.published) ?? [];
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
      {wing && wingPhotos.length > 0 && <section className="new-wing" aria-labelledby="new-wing-heading">
        <header className="new-wing-heading">
          <p className="eyebrow">An expanding collection</p>
          <h2 id="new-wing-heading">The New Wing</h2>
          <p>{wing.total} photograph{wing.total === 1 ? '' : 's'} across {wing.alleys.length} alley{wing.alleys.length === 1 ? '' : 's'}. The museum makes room for every new memory.</p>
        </header>
        {wing.alleys.map((alley) => {
          const exhibits = alley.exhibits.filter((exhibit) => exhibit.published);
          if (!exhibits.length) return null;
          return <section className="wing-alley" key={alley.index} aria-labelledby={`alley-${alley.index}`}>
            <div className="wing-alley-heading">
              <h3 id={`alley-${alley.index}`}>Alley {alley.index + 1}</h3>
              <span>{exhibits.length} of {wing.capacity} frames</span>
            </div>
            <div className="photo-grid">
              {exhibits.map((exhibit) => <button className="photo-card" key={exhibit.id} onClick={() => onOpen(exhibit)}>
                <span className="photo-card-image"><img src={exhibit.thumbnailUrl} alt="" loading="lazy" /></span>
                <span className="photo-card-label">{exhibit.title}<Icon name="arrow" /></span>
              </button>)}
            </div>
          </section>;
        })}
      </section>}
    </main>
  );
}
