export const STORAGE_BUCKET = 'exhibits';

export const DEFAULT_ALLEY_CAPACITY = 6;
export const DEFAULT_MAX_ALLEYS = 24;

export const LIMITS = {
  titleMin: 2,
  titleMax: 80,
  captionMin: 1,
  captionMax: 600,
  altMin: 1,
  altMax: 240,
  dateMax: 60,
  letterTitleMax: 80,
  letterParagraphMin: 1,
  letterParagraphMax: 4000,
  letterParagraphsMax: 12,
  imageBytesMax: 25 * 1024 * 1024,
  displayEdge: 2400,
  thumbnailEdge: 900,
} as const;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
