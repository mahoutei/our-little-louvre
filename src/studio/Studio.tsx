import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { STORAGE_BUCKET } from '../../shared/config';
import type { Collection, ExhibitBase, ExhibitFields, LetterView, MemberView, StudioData } from '../../shared/types';
import { fieldsFrom, validateExhibitFields } from '../../shared/validation';
import { api, ApiError } from '../api/client';
import { demoCollection } from '../api/demo';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { parseCollection } from '../exhibits/collection';
import { loadManifest } from '../exhibits/manifest';
import { Icon } from '../Icons';
import { describeBytes, prepareImage } from './image';
import type { PreparedImage } from './image';
import './studio.css';

type Notice = { tone: 'good' | 'bad'; text: string } | null;
type EditPatch = ExhibitFields & { published?: boolean };

const EMPTY_FIELDS: ExhibitFields = { title: '', caption: '', alt: '', dateLabel: '' };

function statsOf(collection: Collection): StudioData['stats'] {
  const wing = collection.wing.alleys.flatMap((alley) => alley.exhibits);
  return {
    originals: collection.manifest.exhibits.length,
    wing: collection.wing.total,
    published: collection.manifest.exhibits.length + wing.filter((exhibit) => exhibit.published).length,
    alleys: collection.wing.alleys.length,
    capacity: collection.wing.capacity,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong in the museum office.';
}

function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: ReactNode;
}) {
  return <div className={`studio-field${error ? ' studio-field--error' : ''}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {error ? <p className="studio-field-error" role="alert">{error}</p> : hint ? <p className="studio-hint">{hint}</p> : null}
  </div>;
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
  const [file, setFile] = useState<File>();
  const [prepared, setPrepared] = useState<PreparedImage>();
  const [preview, setPreview] = useState<string>();
  const [preparing, setPreparing] = useState(false);
  const [fields, setFields] = useState<ExhibitFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | undefined>(undefined);
  const prepareRun = useRef(0);

  useEffect(() => () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  async function choose(next?: File) {
    if (!next) return;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    const run = ++prepareRun.current;
    const url = URL.createObjectURL(next);
    previewUrl.current = url;
    setPreview(url);
    setFile(next);
    setPrepared(undefined);
    setPreparing(true);
    setErrors({});
    try {
      const result = await prepareImage(next);
      if (run === prepareRun.current) setPrepared(result);
    } catch (error) {
      if (run === prepareRun.current) {
        setFile(undefined);
        setErrors({ file: messageOf(error) });
      }
    } finally {
      if (run === prepareRun.current) setPreparing(false);
    }
  }

  function reset() {
    ++prepareRun.current;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = undefined;
    setPreview(undefined);
    setFile(undefined);
    setPrepared(undefined);
    setPreparing(false);
    setFields(EMPTY_FIELDS);
    setErrors({});
    if (input.current) input.current.value = '';
  }

  function submit(event: FormEvent) {
    event.preventDefault();
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
      onDragOver={(event) => { event.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => { event.preventDefault(); setDrag(false); void choose(event.dataTransfer.files[0]); }}>
      {preview ? <img src={preview} alt="The photograph you chose" />
        : <div className="studio-drop-copy">
          <Icon name="collection" size={30} />
          <strong>Drop a photograph here</strong>
          <span>or choose one from your phone or computer</span>
        </div>}
      <label className="button button--outline studio-file-button">
        {preview ? 'Choose another' : 'Choose a photograph'}
        <input ref={input} type="file" accept="image/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => void choose(event.target.files?.[0])} />
      </label>
    </div>
    {preparing && <p className="studio-hint" role="status">Preparing the photograph…</p>}
    {prepared && <p className="studio-hint studio-ready"><Icon name="key" size={15} /> Ready · {prepared.width} × {prepared.height} · {describeBytes(prepared.bytes)}</p>}
    {errors.file && <p className="studio-field-error" role="alert">{errors.file}</p>}

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

    <button className="button button--gold studio-submit" type="submit" disabled={busy || preparing || !file}>
      <Icon name="arrow" /> {busy ? 'Hanging the photograph…' : 'Hang this photograph'}
    </button>
  </form>;
}

function ExhibitEditor({ exhibit, wing, busy, onSave, onCancel }: {
  exhibit: ExhibitBase;
  wing: boolean;
  busy: boolean;
  onSave: (patch: EditPatch) => Promise<void>;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<ExhibitFields>({
    title: exhibit.title,
    caption: exhibit.caption,
    alt: exhibit.alt,
    dateLabel: exhibit.dateLabel ?? '',
  });
  const [published, setPublished] = useState(exhibit.published);
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = fieldsFrom(fields);
    const found = validateExhibitFields(next);
    if (Object.keys(found).length) {
      setErrors(found as Record<string, string>);
      return;
    }
    void onSave({ ...next, ...(wing ? { published } : {}) });
  }
  return <form className="studio-edit" onSubmit={submit} noValidate>
    <div className="studio-form-grid">
      <Field id={`edit-title-${exhibit.id}`} label="Title" error={errors.title}>
        <input id={`edit-title-${exhibit.id}`} value={fields.title} maxLength={80} required onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} />
      </Field>
      <Field id={`edit-date-${exhibit.id}`} label="Date" error={errors.dateLabel}>
        <input id={`edit-date-${exhibit.id}`} value={fields.dateLabel ?? ''} maxLength={60} onChange={(event) => setFields((current) => ({ ...current, dateLabel: event.target.value }))} />
      </Field>
    </div>
    <Field id={`edit-story-${exhibit.id}`} label="The story" error={errors.caption}>
      <textarea id={`edit-story-${exhibit.id}`} value={fields.caption} rows={3} maxLength={600} required onChange={(event) => setFields((current) => ({ ...current, caption: event.target.value }))} />
    </Field>
    <Field id={`edit-alt-${exhibit.id}`} label="Describe the photograph" error={errors.alt}>
      <input id={`edit-alt-${exhibit.id}`} value={fields.alt} maxLength={240} required onChange={(event) => setFields((current) => ({ ...current, alt: event.target.value }))} />
    </Field>
    {wing && <label className="studio-check">
      <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
      <span>Show this photograph in the museum</span>
    </label>}
    <div className="studio-row-actions">
      <button className="button button--gold" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
      <button className="button button--outline" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

function LetterEditor({ letter, readOnly, busy, onSave }: {
  letter: LetterView;
  readOnly: boolean;
  busy: boolean;
  onSave: (letter: { title: string; paragraphs: string[] }) => Promise<void>;
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
    void onSave({ title: title.trim() || 'A Letter for You', paragraphs: clean });
  }
  return <form className="studio-letter" onSubmit={submit}>
    <Field id="letter-title" label="Title">
      <input id="letter-title" value={title} maxLength={80} readOnly={readOnly} onChange={(event) => setTitle(event.target.value)} />
    </Field>
    <div className="studio-paragraphs">
      {paragraphs.map((paragraph, index) => <div className="studio-paragraph" key={index}>
        <label htmlFor={`letter-paragraph-${index}`}>Paragraph {index + 1}</label>
        <textarea id={`letter-paragraph-${index}`} rows={index === 0 ? 2 : 4} value={paragraph} maxLength={4000} readOnly={readOnly}
          onChange={(event) => update(index, event.target.value)} />
        {!readOnly && paragraphs.length > 1 && <button type="button" className="studio-text-button" onClick={() => setParagraphs((current) => current.filter((_, at) => at !== index))}>
          Remove paragraph
        </button>}
      </div>)}
    </div>
    {!readOnly && <div className="studio-row-actions">
      <button className="button button--outline" type="button" disabled={busy || paragraphs.length >= 12} onClick={() => setParagraphs((current) => [...current, ''])}>
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
    let paths: string[] = [];
    try {
      token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      if (!supabase) throw new Error('The photograph store is not configured.');
      const issued = await api.createUploads(token, [
        { kind: 'full', contentType: input.prepared.full.type },
        { kind: 'thumb', contentType: input.prepared.thumb.type },
      ]);
      paths = issued.files.map((file) => file.path);
      for (const file of issued.files) {
        const body = file.kind === 'full' ? input.prepared.full : input.prepared.thumb;
        const { error } = await supabase.storage.from(STORAGE_BUCKET)
          .uploadToSignedUrl(file.path, file.token, body, { contentType: body.type });
        if (error) throw new Error(`The ${file.kind === 'full' ? 'photograph' : 'thumbnail'} could not be uploaded: ${error.message}`);
      }
      const full = issued.files.find((file) => file.kind === 'full');
      const thumb = issued.files.find((file) => file.kind === 'thumb');
      if (!full || !thumb) throw new Error('The upload was not prepared completely. Try again.');
      const result = await api.createExhibit(token, {
        ...input.fields,
        imagePath: full.path,
        thumbPath: thumb.path,
        width: input.prepared.width,
        height: input.prepared.height,
      });
      paths = [];
      const collection = parseCollection(result.collection);
      applyCollection(collection);
      input.reset();
      const spot = `Alley ${result.slot.alleyIndex + 1}, frame ${result.slot.slotIndex + 1}`;
      setNotice({
        tone: 'good',
        text: result.slot.newAlley
          ? `${spot}. A brand-new alley opened for it — the museum just grew.`
          : `${spot}. ${result.slot.remainingInAlley} frame${result.slot.remainingInAlley === 1 ? '' : 's'} left in that alley.`,
      });
    } catch (error) {
      if (token && paths.length) await api.discardUploads(token, paths).catch(() => undefined);
      setNotice({ tone: 'bad', text: messageOf(error) });
    } finally {
      setUploading(false);
    }
  }

  async function saveExhibit(id: string, patch: EditPatch) {
    if (demo) return;
    setBusyId(id);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your key has expired. Reload the page and sign in again.');
      const result = await api.updateExhibit(token, id, patch);
      applyCollection(parseCollection(result.collection));
      setEditingId(undefined);
      setNotice({ tone: 'good', text: 'The label has been updated.' });
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof ApiError && error.fields ? Object.values(error.fields).join(' ') : messageOf(error) });
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
      setNotice({ tone: 'good', text: 'The photograph has been taken down. Its frame is ready for the next one.' });
    } catch (error) {
      setNotice({ tone: 'bad', text: messageOf(error) });
    } finally {
      setBusyId(undefined);
    }
  }

  async function saveLetter(letter: { title: string; paragraphs: string[] }) {
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
      setNotice({ tone: 'bad', text: messageOf(error) });
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
        <p>Every photograph you hang in the New Wing finds its own frame. When an alley is full, the museum quietly opens another one.</p>
        <dl className="studio-stats">
          <div><dt>Original collection</dt><dd>{data.stats.originals}</dd></div>
          <div><dt>In the New Wing</dt><dd>{data.stats.wing}</dd></div>
          <div><dt>Alleys</dt><dd>{data.stats.alleys || 0}</dd></div>
          <div><dt>Frames each</dt><dd>{data.stats.capacity}</dd></div>
        </dl>
        {demo && <p className="studio-demo-note" role="status">This is the public preview. The private studio is read-only until one of the two keys is used.</p>}
      </header>

      {notice && <p className={`studio-notice studio-notice--${notice.tone}`} role={notice.tone === 'bad' ? 'alert' : 'status'}>{notice.text}</p>}

      <div className="studio-columns">
        <section className="studio-panel" aria-labelledby="studio-upload-heading">
          <div className="studio-panel-heading">
            <p className="eyebrow">New photograph</p>
            <h2 id="studio-upload-heading">Hang a memory</h2>
          </div>
          {demo ? <p className="studio-empty">Sign in with one of the two private addresses to add photographs.</p>
            : <UploadForm busy={uploading} onSubmit={upload} />}
        </section>

        <section className="studio-panel" aria-labelledby="studio-letter-heading">
          <div className="studio-panel-heading">
            <p className="eyebrow">The final exhibit</p>
            <h2 id="studio-letter-heading">The letter</h2>
            <p>The words at the end of the gallery. Only the two of you will read them.</p>
          </div>
          <LetterEditor key={data.letter.updatedAt} letter={data.letter} readOnly={demo} busy={savingLetter} onSave={saveLetter} />
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
            <p>{collection.wing.total} photograph{collection.wing.total === 1 ? '' : 's'} hung across {data.stats.alleys || 0} alley{data.stats.alleys === 1 ? '' : 's'}, {data.stats.capacity} frames in each.</p>
          </div>
        </div>
        {wingPhotos.length ? <ul className="studio-list">
          {wingPhotos.map((exhibit) => <li key={exhibit.id} className="studio-item">
            <img className="studio-thumb" src={exhibit.thumbnailUrl} alt="" loading="lazy" />
            <div className="studio-item-copy">
              <p className="studio-item-where">Alley {exhibit.alleyIndex + 1} · Frame {exhibit.slotIndex + 1}{exhibit.published ? '' : ' · hidden'}</p>
              <h3>{exhibit.title}</h3>
              <p>{exhibit.dateLabel ? `${exhibit.dateLabel} · ` : ''}{exhibit.caption}</p>
              {exhibit.authorName && <p className="studio-byline">Hung by {exhibit.authorName}</p>}
            </div>
            {!demo && <div className="studio-item-actions">
              <button className="button button--outline" type="button" disabled={busyId === exhibit.id} onClick={() => { setEditingId(editingId === exhibit.id ? undefined : exhibit.id); setConfirmId(undefined); }}>
                {editingId === exhibit.id ? 'Close' : 'Edit'}
              </button>
              {confirmId === exhibit.id ? <>
                <button className="button button--danger" type="button" disabled={busyId === exhibit.id} onClick={() => void remove(exhibit)}>{busyId === exhibit.id ? 'Taking down…' : 'Remove it'}</button>
                <button className="studio-text-button" type="button" onClick={() => setConfirmId(undefined)}>Keep it</button>
              </> : <button className="studio-text-button" type="button" onClick={() => { setConfirmId(exhibit.id); setEditingId(undefined); }}>Remove</button>}
            </div>}
            {editingId === exhibit.id && <ExhibitEditor exhibit={exhibit} wing busy={busyId === exhibit.id} onCancel={() => setEditingId(undefined)}
              onSave={(patch) => saveExhibit(exhibit.id, patch)} />}
          </li>)}
        </ul> : <p className="studio-empty">The New Wing is waiting for its first photograph. The first one opens Alley I.</p>}
      </section>

      <section className="studio-panel studio-collection" aria-labelledby="studio-original-heading">
        <div className="studio-panel-heading">
          <p className="eyebrow">The original ten</p>
          <h2 id="studio-original-heading">The Gallery of Us</h2>
          <p>The photographs the museum was built around. Their labels can change; their frames stay.</p>
        </div>
        <ul className="studio-list">
          {originals.map((exhibit) => <li key={exhibit.id} className="studio-item">
            <img className="studio-thumb" src={exhibit.thumbnailUrl} alt="" loading="lazy" />
            <div className="studio-item-copy">
              <p className="studio-item-where">{exhibit.dateLabel || 'Original collection'}</p>
              <h3>{exhibit.title}</h3>
              <p>{exhibit.caption}</p>
            </div>
            {!demo && <div className="studio-item-actions">
              <button className="button button--outline" type="button" disabled={busyId === exhibit.id} onClick={() => { setEditingId(editingId === exhibit.id ? undefined : exhibit.id); setConfirmId(undefined); }}>
                {editingId === exhibit.id ? 'Close' : 'Edit label'}
              </button>
            </div>}
            {editingId === exhibit.id && <ExhibitEditor exhibit={exhibit} wing={false} busy={busyId === exhibit.id} onCancel={() => setEditingId(undefined)}
              onSave={(patch) => saveExhibit(exhibit.id, patch)} />}
          </li>)}
        </ul>
      </section>
    </main>
  </div>;
}
