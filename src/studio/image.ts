import { LIMITS } from '../../shared/config';

export type PreparedImage = {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  bytes: number;
};

type Source = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<Source> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the image element, which handles a few formats more gracefully.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('That photograph could not be read. Try a JPEG, PNG, or WebP.'));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sourceSize(source: Source): { width: number; height: number } {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

function render(source: Source, edge: number, quality: number): Promise<Blob> {
  const { width, height } = sourceSize(source);
  if (!width || !height) throw new Error('That photograph has no readable size.');
  const scale = Math.min(1, edge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare photographs.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('This browser could not compress the photograph.'));
        return;
      }
      if (!['image/webp', 'image/jpeg', 'image/png'].includes(blob.type)) {
        reject(new Error('This browser produced an unsupported image format.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

async function encodeUnder(source: Source, edge: number, quality: number, byteLimit: number): Promise<Blob> {
  let currentQuality = quality;
  let blob = await render(source, edge, currentQuality);
  while (blob.size > byteLimit && currentQuality > 0.42) {
    currentQuality = Math.max(0.42, currentQuality - 0.12);
    blob = await render(source, edge, currentQuality);
  }
  if (blob.size > byteLimit) {
    throw new Error('That photograph is too detailed to store. Try a smaller image.');
  }
  return blob;
}

const MEGABYTE = 1024 * 1024;

/** Decodes, rotates, downsizes, and re-encodes a photograph for the private gallery. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photograph file.');
  if (file.size > LIMITS.imageBytesMax) throw new Error('Choose a photograph smaller than 25 MB.');

  const source = await decode(file);
  try {
    const { width, height } = sourceSize(source);
    const full = await encodeUnder(source, LIMITS.displayEdge, 0.9, 9.5 * MEGABYTE);
    const thumb = await encodeUnder(source, LIMITS.thumbnailEdge, 0.82, 2 * MEGABYTE);
    return { full, thumb, width, height, bytes: full.size + thumb.size };
  } finally {
    if ('close' in source) source.close();
  }
}

export function describeBytes(bytes: number): string {
  if (bytes < MEGABYTE) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MEGABYTE).toFixed(1)} MB`;
}
