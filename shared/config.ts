export const STORAGE_BUCKET = 'exhibits';

// The wing geometry has three rows of two frames. This is the hard ceiling;
// WING_ALLEY_CAPACITY can only lower it.
export const MAX_FRAMES_PER_ALLEY = 6;
export const DEFAULT_ALLEY_CAPACITY = MAX_FRAMES_PER_ALLEY;
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

export const UPLOAD_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
