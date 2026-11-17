import { describe, expect, it } from 'vitest';
import { alleyTotal, highestAlley, nextWingSlot, remainingInAlley, WingFullError } from '../../shared/slots';

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
    expect(alleyTotal(exhibits, 6)).toBe(1);
    expect(remainingInAlley(exhibits, 0, 6)).toBe(0);
  });

  it('fills an earlier gap even when a later alley is already in use', () => {
    const exhibits = [slot(1, 0), slot(1, 2)];
    expect(nextWingSlot(exhibits, 6, 24)).toEqual({ alleyIndex: 0, slotIndex: 0, newAlley: false });
  });

  it('refuses to grow past the safety limit', () => {
    const exhibits = Array.from({ length: 12 }, (_, index) => slot(Math.floor(index / 6), index % 6));
    expect(() => nextWingSlot(exhibits, 6, 2)).toThrow(WingFullError);
  });

  it('rejects an invalid capacity', () => {
    expect(() => nextWingSlot([], 0, 24)).toThrow(/capacity/i);
  });
});
