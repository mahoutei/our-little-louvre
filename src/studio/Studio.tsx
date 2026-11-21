import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { LIMITS } from '../../shared/config';
import type { Collection, ExhibitBase, ExhibitFields, ExhibitPatch, LetterView, MemberView, PhotoUpload, StudioData } from '../../shared/types';
import { fieldsFrom, validateExhibitFields } from '../../shared/validation';
import { api, ApiError } from '../api/client';
import { demoCollection } from '../api/demo';
import { useAuth } from '../auth/AuthProvider';
import { parseCollection } from '../exhibits/collection';
import { loadManifest } from '../exhibits/manifest';
import { Icon } from '../Icons';
import { describeBytes } from './image';
import { ExhibitEditor, Field, savePhoto, uploadPhoto, usePhotoDraft } from '../exhibits/ExhibitEditor';
import type { PreparedImage } from './image';

type Notice = { tone: 'good' | 'bad'; text: string; exhibitId?: string } | null;

const EMPTY_FIELDS: ExhibitFields = { title: '', caption: '', alt: '', dateLabel: '' };

function statsOf(collection: Collection): StudioData['stats'] {
  const wing = collection.wing.alleys.flatMap((alley) => alley.exhibits);
  return {
    originals: collection.manifest.exhibits.length,
    wing: collection.wing.total,
    published: [...collection.manifest.exhibits, ...wing].filter((exhibit) => exhibit.published).length,
    alleys: collection.wing.alleys.length,
    capacity: collection.wing.capacity,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in the museum office.';
}

function NameForm({ member, busy, onSave }: { member: MemberView; busy: boolean; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(member.name);
  useEffect(() => setName(member.name), [member.name]);
  return <form className="studio-name" onSubmit={(event) => { event.preventDefault(); void onSave(name); }}>
    <label htmlFor="studio-name">Your name in the museum</label>
    <div>
      <input id="studio-name" value={name} maxLength={60} required onChange={(event) => setName(event.target.value)} />
      <button className="button button--outline" type="submit" disabled={busy || name.trim() === member.name || !name.trim()}>
        {busy ? 'Saving…' : 'Save name'}
      </button>
    </div>
  </form>;
}

function UploadForm({ busy, onSubmit }: {
  busy: boolean;
  onSubmit: (input: { fields: ExhibitFields; prepared: PreparedImage; reset: () => void }) => Promise<void>;
}) {
  const photo = usePhotoDraft();
  const { prepared, preview, preparing } = photo;
  const [fields, setFields] = useState<ExhibitFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function choose(file?: File) {
    setErrors({});
    void photo.choose(file);
  }

  function reset() {
    photo.reset();
    setFields(EMPTY_FIELDS);
    setErrors({});
    if (input.current) input.current.value = '';
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!prepared) {
      setErrors({ file: 'Choose a photograph first.' });
      return;
    }
    const next = fieldsFrom(fields);
    const found = validateExhibitFields(next);
    if (Object.keys(found).length) {
      setErrors(found as Record<string, string>);
      return;
    }
    setErrors({});
    void onSubmit({ fields: next, prepared, reset });
  }

  return <form className="studio-upload" onSubmit={submit} noValidate>
    <div className={`studio-drop${drag ? ' studio-drop--over' : ''}${preview ? ' studio-drop--filled' : ''}`}
      onDragOver={(event) => { event.preventDefault(); if (!busy) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => { event.preventDefault(); setDrag(false); if (!busy) choose(event.dataTransfer.files[0]); }}>
      {preview ? <img src={preview} alt="The photograph you chose" />
        : <div className="studio-drop-copy">
          <Icon name="collection" size={30} />
          <strong>Drop a photograph here</strong>
          <span>or choose one from your phone or computer</span>
        </div>}
      <button type="button" className="button button--outline studio-file-button" disabled={busy} onClick={() => input.current?.click()}>
        {preview ? 'Choose another' : 'Choose a photograph'}
      </button>
      <input ref={input} type="file" accept="image/*" hidden disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => choose(event.target.files?.[0])} />
    </div>
    {preparing && <p className="studio-hint" role="status">Preparing the photograph…</p>}
    {prepared && <p className="studio-hint studio-ready"><Icon name="key" size={15} /> Ready · {prepared.width} × {prepared.height} · {describeBytes(prepared.bytes)}</p>}
    {(photo.error || errors.file) && <p className="studio-field-error" role="alert">{photo.error ?? errors.file}</p>}

    <div className="studio-form-grid">
      <Field id="photo-title" label="Title" error={errors.title}>
        <input id="photo-title" value={fields.title} maxLength={80} required placeholder="The evening we stayed longer"
          onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} />
      </Field>
      <Field id="photo-date" label="Date" hint="Optional — “June 2024” or “Our first winter”." error={errors.dateLabel}>
        <input id="photo-date" value={fields.dateLabel ?? ''} maxLength={60} placeholder="June 2024"
          onChange={(event) => setFields((current) => ({ ...current, dateLabel: event.target.value }))} />
      </Field>
    </div>
    <Field id="photo-story" label="The story" hint="The line that will hang beside the photograph." error={errors.caption}>
      <textarea id="photo-story" value={fields.caption} rows={3} maxLength={600} required placeholder="We took the long way home and the lights were still on."
        onChange={(event) => setFields((current) => ({ ...current, caption: event.target.value }))} />
    </Field>
    <Field id="photo-alt" label="Describe the photograph" hint="For anyone who cannot see the image." error={errors.alt}>
      <input id="photo-alt" value={fields.alt} maxLength={240} required placeholder="Two coffee cups on a sunlit café table"
        onChange={(event) => setFields((current) => ({ ...current, alt: event.target.value }))} />
    </Field>

    <button className="button button--gold studio-submit" type="submit" disabled={busy || !prepared}>
      <Icon name="arrow" /> {busy ? 'Hanging the photograph…' : 'Hang this photograph'}
    </button>
  </form>;
}

function LetterEditor({ letter, readOnly, busy, onSave }: {
  letter: LetterView;
  readOnly: boolean;
  busy: boolean;
  onSave: (letter: { title: string; paragraphs: string[]; updatedAt: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(letter.title);
  const [paragraphs, setParagraphs] = useState(letter.paragraphs.length ? letter.paragraphs : ['']);
  const [error, setError] = useState<string>();
  function update(index: number, value: string) {
    setParagraphs((current) => current.map((paragraph, at) => at === index ? value : paragraph));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = paragraphs.map((paragraph) => paragraph.trim()).filter(Boolean);
    if (!clean.length) {
      setError('The letter needs at least one paragraph.');
      return;
    }
    setError(undefined);
    void onSave({ title: title.trim() || 'A Letter for You', paragraphs: clean, updatedAt: letter.updatedAt });
  }
  return <form className="studio-letter" onSubmit={submit}>
    <Field id="letter-title" label="Title">
      <input id="letter-title" value={title} maxLength={LIMITS.letterTitleMax} readOnly={readOnly} onChange={(event) => setTitle(event.target.value)} />
    </Field>
    <div className="studio-paragraphs">
      {paragraphs.map((paragraph, index) => <div className="studio-paragraph" key={index}>
        <label htmlFor={`letter-paragraph-${index}`}>Paragraph {index + 1}</label>
        <textarea id={`letter-paragraph-${index}`} rows={index === 0 ? 2 : 4} value={paragraph} maxLength={LIMITS.letterParagraphMax} readOnly={readOnly}
          onChange={(event) => update(index, event.target.value)} />
        {!readOnly && paragraphs.length > 1 && <button type="button" className="studio-text-button" onClick={() => setParagraphs((current) => current.filter((_, at) => at !== index))}>
          Remove paragraph
        </button>}
      </div>)}
    </div>
    {!readOnly && <div className="studio-row-actions">
      <button className="button button--outline" type="button" disabled={busy || paragraphs.length >= LIMITS.letterParagraphsMax} onClick={() => setParagraphs((current) => [...current, ''])}>
        Add a paragraph
      </button>
      <button className="button button--gold" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save the letter'}</button>
    </div>}
    {error && <p className="studio-field-error" role="alert">{error}</p>}
    <p className="studio-hint">Last saved {new Date(letter.updatedAt).toLocaleString()}.</p>
  </form>;
}

export function Studio() {
  const auth = useAuth();
  const { demo, token: getToken, updateMember, signOut } = auth;
  const [data, setData] = useState<StudioData>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [notice, setNotice] = useState<Notice>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [confirmId, setConfirmId] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [savingLetter, setSavingLetter] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const savingCollection = uploading || Boolean(busyId) || savingLetter;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      if (demo) {
        const manifest = await loadManifest();
        const collection = demoCollection(manifest);
        setData({
          collection,
          letter: { title: 'A Letter for You', paragraphs: manifest.finale.letterParagraphs, updatedAt: new Date().toISOString() },
          stats: statsOf(collection),
        });
        return;
      }
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      const result = await api.studio(token);
      const collection = parseCollection(result.collection);
      setData({ ...result, collection, stats: statsOf(collection) });
    } catch (error) {
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [demo, getToken]);

  useEffect(() => { void load(); }, [load]);

  function applyCollection(collection: Collection) {
    setData((current) => current ? { ...current, collection, stats: statsOf(collection) } : current);
  }

  async function upload(input: { fields: ExhibitFields; prepared: PreparedImage; reset: () => void }) {
    if (demo) return;
    setUploading(true);
    setNotice(null);
    let token: string | null = null;
    let photo: PhotoUpload | undefined;
    try {
      token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      photo = await uploadPhoto(token, input.prepared);
      const result = await api.createExhibit(token, { ...input.fields, ...photo });
      const collection = parseCollection(result.collection);
      applyCollection(collection);
      input.reset();
      const spot = `Room ${result.slot.alleyIndex + 1}, frame ${result.slot.slotIndex + 1}`;
      setNotice({
        tone: 'good',
        text: result.slot.newAlley
          ? `${spot}. A new room opened for this photograph.`
          : `${spot}. ${result.slot.remainingInAlley} frame${result.slot.remainingInAlley === 1 ? '' : 's'} left in this room.`,
      });
    } catch (error) {
      if (token && photo) await api.discardUploads(token, [photo.imagePath, photo.thumbPath]).catch(() => undefined);
      setNotice({ tone: 'bad', text: messageOf(error) });
    } finally {
      setUploading(false);
    }
  }

  async function saveExhibit(id: string, patch: ExhibitPatch, photo?: PreparedImage) {
    if (demo) return;
    setBusyId(id);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      applyCollection(await savePhoto(token, id, patch, photo));
      setEditingId(undefined);
      setNotice({ tone: 'good', exhibitId: id, text: photo ? 'The new photograph is in the same frame.' : 'The label has been updated.' });
    } catch (error) {
      setNotice({ tone: 'bad', exhibitId: id, text: error instanceof ApiError && error.fields ? Object.values(error.fields).join(' ') : messageOf(error) });
    } finally {
      setBusyId(undefined);
    }
  }

  async function remove(exhibit: ExhibitBase) {
    if (demo) return;
    setBusyId(exhibit.id);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      const result = await api.deleteExhibit(token, exhibit.id);
      applyCollection(parseCollection(result.collection));
      setConfirmId(undefined);
      setEditingId(undefined);
      setNotice({ tone: 'good', exhibitId: exhibit.origin === 'ORIGINAL' ? exhibit.id : undefined, text: exhibit.origin === 'ORIGINAL'
        ? 'The photograph has been taken down. You can add a replacement to this frame in Private studio.'
        : 'The photograph has been taken down. Its frame is ready for the next one.' });
    } catch (error) {
      setNotice({ tone: 'bad', exhibitId: exhibit.id, text: messageOf(error) });
    } finally {
      setBusyId(undefined);
    }
  }

  function exhibitRow(exhibit: ExhibitBase, location: string) {
    const editing = editingId === exhibit.id;
    const empty = exhibit.origin === 'ORIGINAL' && !exhibit.published;
    const busy = busyId === exhibit.id;
    return <li key={exhibit.id} className="studio-item">
      <img className="studio-thumb" src={exhibit.thumbnailUrl} alt="" loading="lazy" />
      <div className="studio-item-copy">
        <p className="studio-item-where">{location}</p>
        <h3>{exhibit.title}</h3>
        <p>{exhibit.dateLabel ? `${exhibit.dateLabel} · ` : ''}{exhibit.caption}</p>
        {exhibit.authorName && exhibit.origin === 'WING' && <p className="studio-byline">Hung by {exhibit.authorName}</p>}
      </div>
      {!demo && <div className="studio-item-actions">
        <button className="button button--outline" type="button" disabled={savingCollection}
          onClick={() => { setEditingId(editing ? undefined : exhibit.id); setConfirmId(undefined); }}>
          {editing ? 'Close' : empty ? 'Add photo' : 'Edit photo'}
        </button>
        {!empty && (confirmId === exhibit.id ? <>
          <button className="button button--danger" type="button" disabled={savingCollection}
            onClick={() => void remove(exhibit)}>{busy ? 'Taking down…' : 'Remove it'}</button>
          <button className="studio-text-button" type="button" disabled={savingCollection} onClick={() => setConfirmId(undefined)}>Keep it</button>
        </> : <button className="studio-text-button" type="button" disabled={savingCollection}
          onClick={() => { setConfirmId(exhibit.id); setEditingId(undefined); }}>Remove</button>)}
      </div>}
      {editing && <ExhibitEditor exhibit={exhibit} busy={savingCollection} onCancel={() => setEditingId(undefined)}
        onSave={(patch, photo) => saveExhibit(exhibit.id, patch, photo)} />}
      {notice?.exhibitId === exhibit.id && <p className={`studio-notice studio-notice--row studio-notice--${notice.tone}`}
        role={notice.tone === 'bad' ? 'alert' : 'status'}>{notice.text}</p>}
    </li>;
  }

  async function saveLetter(letter: { title: string; paragraphs: string[]; updatedAt: string }) {
    if (demo) return;
    setSavingLetter(true);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      const result = await api.saveLetter(token, letter);
      const collection = parseCollection(result.collection);
      setData((current) => current ? { ...current, collection, stats: statsOf(collection), letter: result.letter } : current);
      setNotice({ tone: 'good', text: 'The letter has been saved for the next visit.' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await load();
        setNotice({ tone: 'bad', text: 'A newer letter was saved. The latest words are shown; make your changes again.' });
      } else {
        setNotice({ tone: 'bad', text: messageOf(error) });
      }
    } finally {
      setSavingLetter(false);
    }
  }

  async function saveName(name: string) {
    if (demo) return;
    setSavingName(true);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      const result = await api.updateProfile(token, name.trim());
      updateMember(result.member);
      setData((current) => current ? { ...current, collection: { ...current.collection, member: result.member } } : current);
      setNotice({ tone: 'good', text: 'Your name has been updated.' });
    } catch (error) {
      setNotice({ tone: 'bad', text: messageOf(error) });
    } finally {
      setSavingName(false);
    }
  }

  if (loading && !data) {
    return <div className="studio studio--state"><span className="loading-ring" /><p role="status">Opening the private studio…</p></div>;
  }
  if (!data) {
    return <div className="studio studio--state">
      <h1>The studio could not open</h1>
      <p role="alert">{loadError ?? 'The museum office did not answer.'}</p>
      <div className="button-row"><button className="button button--gold" onClick={() => void load()}>Try again</button><a className="button button--outline" href="/">Back to the museum</a></div>
    </div>;
  }

  const collection = data.collection;
  const wingPhotos = collection.wing.alleys.flatMap((alley) => alley.exhibits);
  const originals = collection.manifest.exhibits;
  const member = collection.member;

  return <div className="studio">
    <header className="studio-bar">
      <a className="wordmark" href="/" aria-label="Our Little Louvre">
        <img src="/pyramid.svg" alt="" width="35" height="35" /> <span>Our Little Louvre</span>
      </a>
      <div className="studio-bar-actions">
        <span className="studio-member">{member.name}</span>
        <a className="button button--outline" href="/"><Icon name="back" /> Museum</a>
        <button className="button button--glass" type="button" onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>

    <main className="studio-main">
      <header className="studio-heading">
        <p className="eyebrow">Private studio</p>
        <h1>What should the museum hold?</h1>
        <p>Every photograph you hang in the New Wing finds its own frame. When a room is full, the museum opens another one.</p>
        <dl className="studio-stats">
          <div><dt>Original collection</dt><dd>{data.stats.originals}</dd></div>
          <div><dt>In the New Wing</dt><dd>{data.stats.wing}</dd></div>
          <div><dt>Rooms</dt><dd>{data.stats.alleys || 0}</dd></div>
          <div><dt>Frames each</dt><dd>{data.stats.capacity}</dd></div>
        </dl>
        {demo && <p className="studio-demo-note" role="status">This is the public preview. The private studio is read-only until one of the two keys is used.</p>}
      </header>

      {notice && !notice.exhibitId && <p className={`studio-notice studio-notice--${notice.tone}`} role={notice.tone === 'bad' ? 'alert' : 'status'}>{notice.text}</p>}

      <div className="studio-columns">
        <section className="studio-panel" aria-labelledby="studio-upload-heading">
          <div className="studio-panel-heading">
            <p className="eyebrow">New photograph</p>
            <h2 id="studio-upload-heading">Hang a memory</h2>
          </div>
          {demo ? <p className="studio-empty">Sign in with one of the two private addresses to add photographs.</p>
            : <UploadForm busy={savingCollection} onSubmit={upload} />}
        </section>

        <section className="studio-panel" aria-labelledby="studio-letter-heading">
          <div className="studio-panel-heading">
            <p className="eyebrow">The final exhibit</p>
            <h2 id="studio-letter-heading">The letter</h2>
            <p>The words at the end of the gallery. Only the two of you will read them.</p>
          </div>
          <LetterEditor key={data.letter.updatedAt} letter={data.letter} readOnly={demo} busy={savingCollection} onSave={saveLetter} />
        </section>
      </div>

      <section className="studio-panel" aria-labelledby="studio-name-heading">
        <div className="studio-panel-heading">
          <p className="eyebrow">Your signature</p>
          <h2 id="studio-name-heading">Name on the label</h2>
        </div>
        {demo ? <p className="studio-empty">The preview does not change names.</p>
          : <NameForm member={member} busy={savingName} onSave={saveName} />}
      </section>

      <section className="studio-panel studio-collection" aria-labelledby="studio-wing-heading">
        <div className="studio-panel-heading studio-panel-heading--row">
          <div>
            <p className="eyebrow">The New Wing</p>
            <h2 id="studio-wing-heading">Your photographs</h2>
            <p>{collection.wing.total} photograph{collection.wing.total === 1 ? '' : 's'} hung across {data.stats.alleys || 0} room{data.stats.alleys === 1 ? '' : 's'}, {data.stats.capacity} frames in each.</p>
          </div>
        </div>
        {wingPhotos.length ? <ul className="studio-list">
          {wingPhotos.map((exhibit) => exhibitRow(exhibit,
            `Room ${exhibit.alleyIndex + 1} · Frame ${exhibit.slotIndex + 1}${exhibit.published ? '' : ' · hidden'}`))}
        </ul> : <p className="studio-empty">The New Wing is waiting for its first photograph. The first one opens Room 1.</p>}
      </section>

      <section className="studio-panel studio-collection" aria-labelledby="studio-original-heading">
        <div className="studio-panel-heading">
          <p className="eyebrow">The original ten</p>
          <h2 id="studio-original-heading">The Gallery of Us</h2>
          <p>Edit the story, replace a photograph, or leave its frame empty for later.</p>
        </div>
        <ul className="studio-list">
          {originals.map((exhibit, index) => exhibitRow(exhibit, `Original frame ${index + 1}${exhibit.published ? '' : ' · empty'}`))}
        </ul>
      </section>
    </main>
  </div>;
}
