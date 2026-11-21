import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { STORAGE_BUCKET } from '../../shared/config';
import type { ExhibitBase, ExhibitFields, ExhibitPatch, PhotoUpload } from '../../shared/types';
import { fieldsFrom, validateExhibitFields } from '../../shared/validation';
import { api } from '../api/client';
import { supabase } from '../auth/supabase';
import { prepareImage } from '../studio/image';
import type { PreparedImage } from '../studio/image';
import { parseCollection } from './collection';
import '../studio/studio.css';

export function usePhotoDraft() {
  const [draft, setDraft] = useState<{ preview: string; prepared?: PreparedImage; error?: string }>();
  const activeUrl = useRef<string | undefined>(undefined);

  const releaseUrl = useCallback(() => {
    if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
    activeUrl.current = undefined;
  }, []);

  useEffect(() => releaseUrl, [releaseUrl]);

  async function choose(file?: File) {
    if (!file) return;
    releaseUrl();
    const preview = URL.createObjectURL(file);
    activeUrl.current = preview;
    setDraft({ preview });
    try {
      const prepared = await prepareImage(file);
      if (activeUrl.current === preview) setDraft({ preview, prepared });
    } catch (error) {
      if (activeUrl.current === preview) setDraft({ preview, error: error instanceof Error ? error.message : 'The photograph could not be prepared.' });
    }
  }

  function reset() {
    releaseUrl();
    setDraft(undefined);
  }

  return { ...draft, preparing: Boolean(draft && !draft.prepared && !draft.error), choose, reset };
}

export async function uploadPhoto(token: string, prepared: PreparedImage): Promise<PhotoUpload> {
  if (!supabase) throw new Error('The photograph store is not configured.');
  const { files } = await api.createUploads(token, [
    { kind: 'full', contentType: prepared.full.type },
    { kind: 'thumb', contentType: prepared.thumb.type },
  ]);
  try {
    const full = files.find((file) => file.kind === 'full');
    const thumb = files.find((file) => file.kind === 'thumb');
    if (!full || !thumb) throw new Error('The upload was not prepared completely. Try again.');
    for (const file of [full, thumb]) {
      const body = file === full ? prepared.full : prepared.thumb;
      const { error } = await supabase.storage.from(STORAGE_BUCKET)
        .uploadToSignedUrl(file.path, file.token, body, { contentType: body.type });
      if (error) throw new Error(`The ${file === full ? 'photograph' : 'thumbnail'} could not be uploaded: ${error.message}`);
    }
    return { imagePath: full.path, thumbPath: thumb.path, width: prepared.width, height: prepared.height };
  } catch (error) {
    await api.discardUploads(token, files.map(({ path }) => path)).catch(() => undefined);
    throw error;
  }
}

export function Field({ id, label, hint, error, children }: {
  id: string; label: string; hint?: string; error?: string; children: ReactNode;
}) {
  return <div className={`studio-field${error ? ' studio-field--error' : ''}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    {error ? <p className="studio-field-error" role="alert">{error}</p> : hint ? <p className="studio-hint">{hint}</p> : null}
  </div>;
}

export function ExhibitEditor({ exhibit, busy, onSave, onCancel, showVisibility = true }: {
  exhibit: ExhibitBase;
  busy: boolean;
  showVisibility?: boolean;
  onSave: (patch: ExhibitPatch, photo?: PreparedImage) => Promise<void>;
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
  const photo = usePhotoDraft();
  const fileInput = useRef<HTMLInputElement>(null);
  const wing = exhibit.origin === 'WING';
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || photo.preparing || photo.error) return;
    const next = fieldsFrom(fields);
    const found = validateExhibitFields(next);
    if (Object.keys(found).length) {
      setErrors(found as Record<string, string>);
      return;
    }
    void onSave({ ...next, ...(wing && showVisibility ? { published } : {}) }, photo.prepared);
  }
  return <form className="studio-edit" onSubmit={submit} noValidate>
    <Field id={`edit-photo-${exhibit.id}`} label={exhibit.published || wing ? 'Replace photograph' : 'Choose a photograph for this frame'} error={photo.error}>
      <input id={`edit-photo-${exhibit.id}`} ref={fileInput} type="file" accept="image/*" disabled={busy}
        onChange={(event) => void photo.choose(event.target.files?.[0])} />
    </Field>
    {photo.preparing && <p className="studio-hint" role="status">Preparing the photograph…</p>}
    {photo.prepared && <img className="studio-thumb" src={photo.preview} alt="Replacement preview" />}
    {photo.preview && <button className="studio-text-button" type="button" disabled={busy} onClick={() => {
      photo.reset();
      if (fileInput.current) fileInput.current.value = '';
    }}>Clear selected file</button>}
    <div className="studio-form-grid">
      <Field id={`edit-title-${exhibit.id}`} label="Title" error={errors.title}>
        <input id={`edit-title-${exhibit.id}`} value={fields.title} maxLength={80} required disabled={busy} onChange={(event) => setFields((current) => ({ ...current, title: event.target.value }))} />
      </Field>
      <Field id={`edit-date-${exhibit.id}`} label="Date" error={errors.dateLabel}>
        <input id={`edit-date-${exhibit.id}`} value={fields.dateLabel ?? ''} maxLength={60} disabled={busy} onChange={(event) => setFields((current) => ({ ...current, dateLabel: event.target.value }))} />
      </Field>
    </div>
    <Field id={`edit-story-${exhibit.id}`} label="The story" error={errors.caption}>
      <textarea id={`edit-story-${exhibit.id}`} value={fields.caption} rows={3} maxLength={600} required disabled={busy} onChange={(event) => setFields((current) => ({ ...current, caption: event.target.value }))} />
    </Field>
    <Field id={`edit-alt-${exhibit.id}`} label="Describe the photograph" error={errors.alt}>
      <input id={`edit-alt-${exhibit.id}`} value={fields.alt} maxLength={240} required disabled={busy} onChange={(event) => setFields((current) => ({ ...current, alt: event.target.value }))} />
    </Field>
    {wing && showVisibility && <label className="studio-check">
      <input type="checkbox" checked={published} disabled={busy} onChange={(event) => setPublished(event.target.checked)} />
      <span>Show this photograph in the museum</span>
    </label>}
    <div className="studio-row-actions">
      <button className="button button--gold" type="submit" disabled={busy || photo.preparing || Boolean(photo.error)}>{busy ? 'Saving…' : 'Save changes'}</button>
      <button className="button button--outline" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
    </div>
  </form>;
}

export async function savePhoto(token: string, id: string, patch: ExhibitPatch, photo?: PreparedImage, view?: 'gallery') {
  const replacement = photo ? await uploadPhoto(token, photo) : undefined;
  try {
    const result = await api.updateExhibit(token, id, { ...patch, replacement }, view);
    return parseCollection(result.collection);
  } catch (error) {
    if (replacement) await api.discardUploads(token, [replacement.imagePath, replacement.thumbPath]).catch(() => undefined);
    throw error;
  }
}
