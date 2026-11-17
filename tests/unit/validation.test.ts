import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '../../shared/validation';

describe('safeReturnTo', () => {
  it.each(['/', '/studio', '/studio?tab=letter'])('keeps the local path %s', (value) => {
    expect(safeReturnTo(value)).toBe(value);
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\tevil.example',
  ])('falls back to the home page for %s', (value) => {
    expect(safeReturnTo(value)).toBe('/');
  });
});
