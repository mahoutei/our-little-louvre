import { describe, expect, it } from 'vitest';
import type { WingAlley, WingExhibit } from '../../shared/types';
import { EYE_HEIGHT } from '../../src/museum/movement';
import { alleyCenterZ, alleyEndZ, alleyStartZ, visibleWingRooms, wingFramePosition, wingRoomAt, wingSpawn } from '../../src/museum/wingLayout';

const photo = (alleyIndex: number, slotIndex: number, published = true): WingExhibit => ({
  id: `${alleyIndex}-${slotIndex}`, slug: `${alleyIndex}-${slotIndex}`, origin: 'WING',
  title: 'A photograph', caption: 'A memory from the trip.', alt: 'A photograph',
  thumbnailUrl: '/thumb.webp', imageUrl: '/photo.webp', alleyIndex, slotIndex, published,
});
const alley = (index: number, ...exhibits: WingExhibit[]): WingAlley => ({ index, remaining: 6 - exhibits.length, exhibits });

describe('the visitor layout of the New Wing', () => {
  it('skips empty rooms and keeps the original room and frame numbers', () => {
    const rooms = visibleWingRooms({ capacity: 6, total: 4, alleys: [
      alley(0, photo(0, 0, false)), alley(2, photo(2, 4), photo(2, 1)), alley(4, photo(4, 0)),
    ] });
    expect(rooms.map(({ index, exhibits }) => [index, exhibits.map(({ slotIndex }) => slotIndex)])).toEqual([[2, [1, 4]], [4, [0]]]);
    expect(visibleWingRooms({ capacity: 6, total: 1, alleys: [alley(0, photo(0, 0, false))] })).toEqual([]);
  });

  it.each([0, 1, 2, 3, 4, 5])('starts inside the first room facing its first published frame in slot %i', (slot) => {
    const frame = wingFramePosition(0, slot);
    const pose = wingSpawn(slot);
    expect(pose.z).toBeLessThan(alleyStartZ(0));
    expect(pose.z).toBeGreaterThan(alleyEndZ(0));
    const dx = frame.x - pose.x;
    const dz = frame.z - pose.z;
    const distance = Math.hypot(dx, dz);
    expect(Math.hypot(distance, frame.y - EYE_HEIGHT)).toBeLessThan(4.7);
    expect(-Math.sin(pose.yaw)).toBeCloseTo(dx / distance);
    expect(-Math.cos(pose.yaw)).toBeCloseTo(dz / distance);
    expect(Math.tan(pose.pitch)).toBeCloseTo((frame.y - EYE_HEIGHT) / distance);
  });

  it('changes rooms midway through a passage and clamps to the ends', () => {
    const midway = (alleyStartZ(1) + alleyEndZ(0)) / 2;
    expect(wingRoomAt(alleyCenterZ(0), 2)).toBe(0);
    expect(wingRoomAt(midway + 0.01, 2)).toBe(0);
    expect(wingRoomAt(midway - 0.01, 2)).toBe(1);
    expect(wingRoomAt(alleyEndZ(1) - 1, 2)).toBe(1);
    expect(wingRoomAt(alleyStartZ(0) + 1, 2)).toBe(0);
  });
});
