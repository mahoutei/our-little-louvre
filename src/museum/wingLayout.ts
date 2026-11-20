import type { Wing, WingAlley } from '../../shared/types';
import type { Point, Wall } from './layout';
import { hall } from './layout';

export const WING = {
  entryHalfWidth: hall.salon.halfWidth,
  roomHalfWidth: 1.85,
  passageCenter: -0.78,
  passageHalfWidth: 0.76,
  entryDepth: 2.35,
  alleyDepth: 9.6,
  passageDepth: 2.2,
  height: 4.2,
  frameHeight: 1.82,
  frameSpacing: 3.1,
  wallThickness: 0.26,
  maxAlleys: 24,
} as const;

const wall = (minX: number, maxX: number, minZ: number, maxZ: number): Wall => ({ minX, maxX, minZ, maxZ });

export function alleyStartZ(index: number): number {
  return -WING.entryDepth - index * (WING.alleyDepth + WING.passageDepth);
}

export function alleyEndZ(index: number): number {
  return alleyStartZ(index) - WING.alleyDepth;
}

export function alleyCenterZ(index: number): number {
  return alleyStartZ(index) - WING.alleyDepth / 2;
}

export function visibleWingRooms(wing?: Wing): WingAlley[] {
  return (wing?.alleys ?? []).flatMap((alley) => {
    const exhibits = alley.exhibits.filter(({ published }) => published).sort((a, b) => a.slotIndex - b.slotIndex);
    return exhibits.length ? [{ ...alley, exhibits }] : [];
  }).sort((a, b) => a.index - b.index);
}

export function wingFramePosition(room: number, slot: number, featured: boolean) {
  if (featured) return { x: 0.79, y: 1.77, z: alleyEndZ(room) + 0.22, yaw: 0 };
  const side = slot % 2 === 0 ? -1 : 1;
  return {
    x: side * (WING.roomHalfWidth - 0.1),
    y: WING.frameHeight,
    z: alleyCenterZ(room) + (1 - Math.floor(slot / 2)) * WING.frameSpacing,
    yaw: -side * Math.PI / 2,
  };
}

// The annex extends right from the hall. Its local -Z points along world +X.
export function wingPoint(x: number, z: number): Point {
  return { x: hall.halfWidth - z, z: hall.salon.z + x };
}

export function wingRoomAt(point: Point, count: number): number {
  if (!count || point.x < hall.halfWidth || Math.abs(point.z - hall.salon.z) > WING.roomHalfWidth) return -1;
  const relative = point.x - hall.halfWidth + alleyStartZ(0) + WING.passageDepth / 2;
  return Math.max(0, Math.min(count - 1, Math.floor(relative / (WING.alleyDepth + WING.passageDepth))));
}

/** Collision for the wing in the shared gallery coordinate system. */
export function wingWalls(alleyCount: number): Wall[] {
  const count = Math.max(1, Math.min(WING.maxAlleys, Math.floor(alleyCount) || 1));
  const walls: Wall[] = [
    wall(-WING.entryHalfWidth - 0.3, -WING.entryHalfWidth, -WING.entryDepth, 0),
    wall(WING.entryHalfWidth, WING.entryHalfWidth + 0.3, -WING.entryDepth, 0),
  ];
  const passageLeft = WING.passageCenter - WING.passageHalfWidth;
  const passageRight = WING.passageCenter + WING.passageHalfWidth;
  const doorway = (z: number, left: number, right: number) => [
    wall(-WING.roomHalfWidth, left, z - 0.14, z + 0.14),
    wall(right, WING.roomHalfWidth, z - 0.14, z + 0.14),
  ];

  for (let index = 0; index < count; index++) {
    const start = alleyStartZ(index);
    const end = alleyEndZ(index);
    walls.push(
      wall(-WING.roomHalfWidth - 0.3, -WING.roomHalfWidth, end, start),
      wall(WING.roomHalfWidth, WING.roomHalfWidth + 0.3, end, start),
      ...doorway(start, index ? passageLeft : -WING.entryHalfWidth, index ? passageRight : WING.entryHalfWidth),
    );

    if (index < count - 1) {
      const nextStart = alleyStartZ(index + 1);
      walls.push(
        ...doorway(end, passageLeft, passageRight),
        wall(passageLeft - 0.26, passageLeft, nextStart, end),
        wall(passageRight, passageRight + 0.26, nextStart, end),
      );
    } else {
      walls.push(wall(-WING.roomHalfWidth - 0.3, WING.roomHalfWidth + 0.3, end - 0.3, end));
    }
  }
  return walls.map(({ minX, maxX, minZ, maxZ }) => wall(
    hall.halfWidth - maxZ, hall.halfWidth - minZ, hall.salon.z + minX, hall.salon.z + maxX,
  ));
}
