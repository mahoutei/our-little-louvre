import type { Pose, Wall } from './layout';
import { galleryBackZ } from './layout';

export const WING = {
  entryHalfWidth: 2.2,
  roomHalfWidth: 3.3,
  openingHalfWidth: 1.6,
  entryDepth: 3.8,
  alleyDepth: 9.6,
  passageDepth: 2.2,
  height: 4.8,
  frameHeight: 1.74,
  frameSpacing: 3.1,
  wallThickness: 0.26,
  capacity: 6,
  maxAlleys: 24,
} as const;

const wall = (minX: number, maxX: number, minZ: number, maxZ: number): Wall => ({ minX, maxX, minZ, maxZ });

export function alleyStartZ(index: number): number {
  return galleryBackZ - WING.entryDepth - index * (WING.alleyDepth + WING.passageDepth);
}

export function alleyEndZ(index: number): number {
  return alleyStartZ(index) - WING.alleyDepth;
}

export function alleyCenterZ(index: number): number {
  return alleyStartZ(index) - WING.alleyDepth / 2;
}

export function wingSpawn(): Pose {
  return { x: 0, z: galleryBackZ - WING.entryDepth + 0.8, yaw: 0, pitch: 0.025 };
}

/**
 * Collision for the whole built wing. The gallery's back wall stays sealed;
 * entering the wing is a threshold transition, and this is the space behind it.
 */
export function wingWalls(alleyCount: number): Wall[] {
  const count = Math.max(1, Math.min(WING.maxAlleys, Math.floor(alleyCount) || 1));
  const walls: Wall[] = [
    wall(-WING.entryHalfWidth, WING.entryHalfWidth, galleryBackZ - 0.45, galleryBackZ - 0.08),
    wall(-WING.entryHalfWidth - 0.3, -WING.entryHalfWidth, galleryBackZ - WING.entryDepth, galleryBackZ),
    wall(WING.entryHalfWidth, WING.entryHalfWidth + 0.3, galleryBackZ - WING.entryDepth, galleryBackZ),
  ];

  for (let index = 0; index < count; index++) {
    const start = alleyStartZ(index);
    const end = alleyEndZ(index);
    walls.push(
      wall(-WING.roomHalfWidth - 0.3, -WING.roomHalfWidth, end, start),
      wall(WING.roomHalfWidth, WING.roomHalfWidth + 0.3, end, start),
      wall(-WING.roomHalfWidth, -WING.openingHalfWidth, start - 0.14, start + 0.14),
      wall(WING.openingHalfWidth, WING.roomHalfWidth, start - 0.14, start + 0.14),
    );

    if (index < count - 1) {
      const nextStart = alleyStartZ(index + 1);
      walls.push(
        wall(-WING.roomHalfWidth, -WING.openingHalfWidth, end - 0.14, end + 0.14),
        wall(WING.openingHalfWidth, WING.roomHalfWidth, end - 0.14, end + 0.14),
        wall(-WING.openingHalfWidth - 0.3, -WING.openingHalfWidth, nextStart, end),
        wall(WING.openingHalfWidth, WING.openingHalfWidth + 0.3, nextStart, end),
      );
    } else {
      walls.push(wall(-WING.roomHalfWidth - 0.3, WING.roomHalfWidth + 0.3, end - 0.3, end));
    }
  }
  return walls;
}

export function wingLayout(alleyCount: number) {
  return {
    alleyCount: Math.max(1, Math.min(WING.maxAlleys, Math.floor(alleyCount) || 1)),
    spawn: wingSpawn(),
    walls: wingWalls(alleyCount),
  };
}
