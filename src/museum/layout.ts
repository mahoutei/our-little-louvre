import architecture from './architecture.json';

export type Point = { x: number; z: number };
export type Pose = Point & { yaw: number; pitch: number };
export type Wall = { minX: number; maxX: number; minZ: number; maxZ: number };
export type Room = 'courtyard' | 'gallery' | 'wing';
export type BuiltRoom = Exclude<Room, 'wing'>;

const wall = (minX: number, maxX: number, minZ: number, maxZ: number): Wall => ({ minX, maxX, minZ, maxZ });
export const { pyramid, hall } = architecture;
export const entranceZ = pyramid.centerZ + pyramid.halfWidth;
export const doorPose: Pose = { x: 0, z: entranceZ + 2.4, yaw: 0, pitch: 0 };
const pyramidBack = pyramid.centerZ - pyramid.halfWidth;

export const courtyard = {
  spawn: { x: -3.5, z: 21.5, yaw: -0.14, pitch: 0.105 },
  walls: [
    wall(-30, -21, -25, 31), wall(21, 30, -25, 31),
    wall(-30, 30, 28, 31), wall(-30, 30, -25, -16.4),
    wall(-pyramid.halfWidth, -pyramid.doorHalfWidth, entranceZ - 0.22, entranceZ + 0.06),
    wall(pyramid.doorHalfWidth, pyramid.halfWidth, entranceZ - 0.22, entranceZ + 0.06),
    wall(-pyramid.doorHalfWidth, pyramid.doorHalfWidth, entranceZ - 0.025, entranceZ + 0.105),
    wall(-5.6, -5.4, pyramidBack, entranceZ), wall(5.4, 5.6, pyramidBack, entranceZ),
    wall(-5.6, 5.6, pyramidBack - 0.05, pyramidBack + 0.2),
    wall(-13.3, -7.2, -1.7, 4.5), wall(7.2, 13.3, -1.7, 4.5),
  ],
};

function sideWall(side: number, inner: number, outer: number, minZ: number, maxZ: number) {
  return side > 0 ? wall(inner, outer, minZ, maxZ) : wall(-outer, -inner, minZ, maxZ);
}

const gallerySideWalls = hall.wings.flatMap(({ side, outerX, nearZ, farZ, doorZ }) => {
  const { halfWidth: doorHalfWidth } = hall.wingDoor;
  const hallSide = (minZ: number, maxZ: number) => sideWall(side, hall.halfWidth - 0.23, hall.halfWidth + 0.48, minZ, maxZ);
  return [
    ...doorZ.map((z, index) => hallSide(z + doorHalfWidth, index === 0 ? hall.frontZ : doorZ[index - 1] - doorHalfWidth)),
    hallSide(hall.alcoveZ, doorZ[doorZ.length - 1] - doorHalfWidth),
    sideWall(side, outerX - 0.07, outerX + 0.6, farZ - 0.45, nearZ + 0.45),
    sideWall(side, hall.halfWidth, outerX + 0.6, nearZ, nearZ + 0.45),
    sideWall(side, hall.halfWidth, outerX + 0.6, farZ - 0.45, farZ),
  ];
});

export const gallery = {
  spawn: { x: 0, z: 5.6, yaw: 0, pitch: 0.035 },
  walls: [
    ...gallerySideWalls,
    wall(-7, 7, hall.frontZ, hall.frontZ + 1),
    wall(-7, -hall.alcoveHalfWidth, hall.alcoveZ - 0.48, hall.alcoveZ + 0.25),
    wall(hall.alcoveHalfWidth, 7, hall.alcoveZ - 0.48, hall.alcoveZ + 0.25),
    wall(-7, -hall.alcoveHalfWidth, hall.backZ, hall.alcoveZ),
    wall(hall.alcoveHalfWidth, 7, hall.backZ, hall.alcoveZ),
    wall(-7, 7, hall.backZ - 1, hall.backZ + 0.15),
    ...hall.bayLines.flatMap((z) => [
      wall(-hall.halfWidth, -hall.halfWidth + 0.46, z - 0.36, z + 0.36),
      wall(hall.halfWidth - 0.46, hall.halfWidth, z - 0.36, z + 0.36),
    ]),
  ],
};

export const rooms: Record<BuiltRoom, { spawn: Pose; walls: Wall[] }> = { courtyard, gallery };

/** Standing in the alcove, facing back down the main hall. */
export const galleryReturnPose: Pose = { x: 0, z: hall.backZ + 2.6, yaw: Math.PI, pitch: 0.02 };

export const galleryBackZ = hall.backZ;

export function isAtEntrance({ x, z }: Point) {
  return Math.abs(x) <= pyramid.doorHalfWidth && z <= entranceZ + 2.65 && z >= entranceZ;
}

export function isNearEntrance({ x, z }: Point) {
  return Math.abs(x) < 6 && z > entranceZ - 1 && z < entranceZ + 8;
}
