import { describe, expect, it } from 'vitest';
import { groupWingRows, highestAlley, nextWingSlot, WingFullError } from '../../shared/slots';

const slot = (alleyIndex: number, slotIndex: number) => ({ alleyIndex, slotIndex });

describe('New Wing slots', () => {
  it('starts the first alley with the first frame', () => {
    expect(nextWingSlot([], 6, 24)).toEqual({ alleyIndex: 0, slotIndex: 0, newAlley: true });
  });

  it('fills a gap left by a removed photograph before opening another alley', () => {
    const exhibits = [slot(0, 0), slot(0, 1), slot(0, 2), slot(0, 4), slot(0, 5), slot(1, 0)];
    expect(nextWingSlot(exhibits, 6, 24)).toEqual({ alleyIndex: 0, slotIndex: 3, newAlley: false });
  });

  it('opens a new alley only when every hanging frame is taken', () => {
    const exhibits = Array.from({ length: 6 }, (_, index) => slot(0, index));
    expect(nextWingSlot(exhibits, 6, 24)).toEqual({ alleyIndex: 1, slotIndex: 0, newAlley: true });
    expect(highestAlley(exhibits)).toBe(0);
  });

  it('fills an earlier gap even when a later alley is already in use', () => {
    const exhibits = [slot(1, 0), slot(1, 2)];
    expect(nextWingSlot(exhibits, 6, 24)).toEqual({ alleyIndex: 0, slotIndex: 0, newAlley: false });
  });

  it('refuses to grow past the safety limit', () => {
    const exhibits = Array.from({ length: 12 }, (_, index) => slot(Math.floor(index / 6), index % 6));
    expect(() => nextWingSlot(exhibits, 6, 2)).toThrow(WingFullError);
  });

  it('fills a gap in an existing alley even after the growth limit is lowered', () => {
    const exhibits = [
      slot(0, 0), slot(0, 1), slot(0, 2),
      slot(1, 0), slot(1, 1), slot(1, 2),
      slot(2, 0), slot(2, 2),
    ];
    expect(nextWingSlot(exhibits, 3, 2)).toEqual({ alleyIndex: 2, slotIndex: 1, newAlley: false });
  });

  it('rejects an invalid capacity', () => {
    expect(() => nextWingSlot([], 0, 24)).toThrow(/capacity/i);
  });

  it('counts hidden photographs against their frames', () => {
    const rows = [
      { alleyIndex: 0, slotIndex: 0, published: true },
      { alleyIndex: 0, slotIndex: 1, published: false },
      { alleyIndex: 1, slotIndex: 0, published: false },
    ];
    expect(groupWingRows(rows, 6)).toEqual([
      { index: 0, rows: [rows[0], rows[1]], remaining: 4 },
      { index: 1, rows: [rows[2]], remaining: 5 },
    ]);
  });

  it('counts only frames inside a lowered capacity as taken', () => {
    const rows = [{ alleyIndex: 0, slotIndex: 5, published: true }];
    expect(groupWingRows(rows, 4)[0].remaining).toBe(4);
  });
});
