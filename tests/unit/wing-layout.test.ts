import { describe, expect, it } from 'vitest';
import type { WingAlley, WingExhibit } from '../../shared/types';
import { moveOnFloor } from '../../src/museum/movement';
import { gallery, hall } from '../../src/museum/layout';
import { alleyEndZ, alleyStartZ, visibleWingRooms, wingFramePosition, wingPoint, wingRoomAt, wingWalls, WING } from '../../src/museum/wingLayout';

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

  it('lets visitors walk into the alcove and back through the same arch', () => {
    const walls = [...gallery.walls, ...wingWalls(1)];
    const start = wingPoint(0, 1.7);
    expect(wingRoomAt(start, 1)).toBe(-1);
    const inside = moveOnFloor(start, { x: WING.entryDepth + 3, z: 0 }, walls);
    expect(inside.x).toBeGreaterThan(hall.halfWidth + WING.entryDepth);
    expect(moveOnFloor(inside, { x: start.x - inside.x, z: 0 }, walls).x).toBeCloseTo(start.x);
    const beside = wingPoint(hall.salon.halfWidth + 0.16, 1.7);
    expect(moveOnFloor(beside, { x: 4, z: 0 }, walls).x).toBeLessThan(hall.halfWidth);
  });

  it('keeps the display wall solid beside the passage to the next room', () => {
    const hero = wingFramePosition(0, 5, true);
    expect(hero.z).toBeGreaterThan(alleyEndZ(0));
    expect(hero.x).toBeGreaterThan(WING.passageCenter + WING.passageHalfWidth + 0.65);
    const walls = wingWalls(2);
    const near = alleyEndZ(0) + 1;
    const blocked = moveOnFloor(wingPoint(hero.x, near), { x: 5, z: 0 }, walls);
    expect(wingRoomAt(blocked, 2)).toBe(0);
    const through = moveOnFloor(wingPoint(WING.passageCenter, near), { x: 5, z: 0 }, walls);
    expect(wingRoomAt(through, 2)).toBe(1);
    const end = wingPoint(0, alleyEndZ(1));
    expect(moveOnFloor(through, { x: 30, z: 0 }, walls).x).toBeLessThan(end.x);
  });
});
