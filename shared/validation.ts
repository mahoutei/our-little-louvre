import { LIMITS } from './config';
import type { ExhibitFields } from './types';

export type FieldErrors = Partial<Record<keyof ExhibitFields, string>>;

export function tidy(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function tidyCaption(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') : '';
}

export function validateExhibitFields(input: Partial<ExhibitFields>): FieldErrors {
  const errors: FieldErrors = {};
  const title = tidy(input.title);
  const caption = tidyCaption(input.caption);
  const alt = tidy(input.alt);
  const date = tidy(input.dateLabel);

  if (title.length < LIMITS.titleMin) errors.title = 'Give the photograph a title.';
  else if (title.length > LIMITS.titleMax) errors.title = `Keep the title under ${LIMITS.titleMax} characters.`;

  if (caption.length < LIMITS.captionMin) errors.caption = 'Write a line about this memory.';
  else if (caption.length > LIMITS.captionMax) errors.caption = `Keep the story under ${LIMITS.captionMax} characters.`;

  if (alt.length < LIMITS.altMin) errors.alt = 'Describe the photograph for screen readers.';
  else if (alt.length > LIMITS.altMax) errors.alt = `Keep the description under ${LIMITS.altMax} characters.`;

  if (date.length > LIMITS.dateMax) errors.dateLabel = `Keep the date under ${LIMITS.dateMax} characters.`;
  return errors;
}

export function fieldsFrom(input: Partial<ExhibitFields>): ExhibitFields {
  const dateLabel = tidy(input.dateLabel);
  return {
    title: tidy(input.title),
    caption: tidyCaption(input.caption),
    alt: tidy(input.alt),
    ...(dateLabel ? { dateLabel } : {}),
  };
}

/**
 * Keeps a post-sign-in redirect on this site. `//host` and `/\host` are
 * protocol-relative URLs, and browsers strip control characters before parsing.
 */
export function safeReturnTo(value?: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return '/';
  }
  return value;
}
