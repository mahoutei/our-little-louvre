import type { Point, Wall } from './layout';

export const EYE_HEIGHT = 1.6;
export const WALK_SPEED = 1.6;
const PLAYER_RADIUS = 0.28;
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export type Input = { keys: Set<string>; stick: Point; look: { x: number; y: number } };

export function createInput(): Input {
  return { keys: new Set(), stick: { x: 0, z: 0 }, look: { x: 0, y: 0 } };
}

export function clearInput(input: Input) {
  input.keys.clear();
  input.stick.x = 0;
  input.stick.z = 0;
  input.look.x = 0;
  input.look.y = 0;
}

export function isMovementKey(code: string) {
  return movementKeys.has(code);
}

export function movementVector({ keys, stick }: Input, yaw: number): Point {
  const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + stick.x;
  const back = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + stick.z;
  const scale = Math.max(1, Math.hypot(right, back));
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return { x: (right * cos + back * sin) / scale, z: (-right * sin + back * cos) / scale };
}

function intersects(x: number, z: number, walls: readonly Wall[]) {
  return walls.some((wall) => {
    const dx = x - Math.max(wall.minX, Math.min(x, wall.maxX));
    const dz = z - Math.max(wall.minZ, Math.min(z, wall.maxZ));
    return dx * dx + dz * dz < PLAYER_RADIUS * PLAYER_RADIUS;
  });
}

export function moveOnFloor(start: Point, delta: Point, walls: readonly Wall[]): Point {
  if (!delta.x && !delta.z) return start;
  let { x, z } = start;
  const steps = Math.ceil(Math.hypot(delta.x, delta.z) / (PLAYER_RADIUS / 2));
  const stepX = delta.x / steps;
  const stepZ = delta.z / steps;
  for (let step = 0; step < steps; step++) {
    if (!intersects(x + stepX, z, walls)) x += stepX;
    if (!intersects(x, z + stepZ, walls)) z += stepZ;
  }
  return { x, z };
}
