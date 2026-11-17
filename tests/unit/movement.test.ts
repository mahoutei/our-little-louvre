import { describe, expect, it } from 'vitest';
import { clearInput, createInput, moveOnFloor, movementVector } from '../../src/museum/movement';
import { courtyard, entranceZ, gallery, isAtEntrance } from '../../src/museum/layout';

describe('walking', () => {
  it('normalizes a diagonal and rotates it with the camera', () => {
    const input = createInput();
    input.keys.add('KeyW');
    input.keys.add('KeyD');
    const direction = movementVector(input, Math.PI / 2);
    expect(Math.hypot(direction.x, direction.z)).toBeCloseTo(1);
    expect(direction.x).toBeCloseTo(-Math.SQRT1_2);
    expect(direction.z).toBeCloseTo(-Math.SQRT1_2);
  });

  it('keeps analog speed proportional to the thumbstick', () => {
    const input = createInput();
    input.stick.z = -0.35;
    expect(movementVector(input, 0)).toEqual({ x: 0, z: -0.35 });
  });

  it('stops at a doorway jamb and slides along it', () => {
    const jamb = { minX: 1, maxX: 4, minZ: -1, maxZ: 0 };
    const result = moveOnFloor({ x: 0.65, z: 0.1 }, { x: 0.3, z: -0.5 }, [jamb]);
    expect(result.x).toBeLessThan(0.73);
    expect(result.z).toBeCloseTo(-0.4);
  });

  it('passes through the center of the gallery alcove opening', () => {
    const start = { x: 0, z: -22 };
    expect(moveOnFloor(start, { x: 0, z: -3 }, gallery.walls).z).toBeCloseTo(-25);
    expect(moveOnFloor({ ...start, x: 4 }, { x: 0, z: -3 }, gallery.walls).z).toBeGreaterThan(-23);
  });

  it.each([
    { side: -1, nearDoor: 2.72, farDoor: -8.62 },
    { side: 1, nearDoor: -8.92, farDoor: -16.62 },
  ])('can enter and return from the side gallery on side $side through separate arches', ({ side, nearDoor, farDoor }) => {
    const threshold = { x: side * 4.2, z: nearDoor };
    const wing = moveOnFloor(threshold, { x: side * 3.6, z: 0 }, gallery.walls);
    expect(wing.x).toBeCloseTo(side * 7.8);
    const farEnd = moveOnFloor(wing, { x: 0, z: farDoor - nearDoor }, gallery.walls);
    expect(farEnd.z).toBeCloseTo(farDoor);
    expect(moveOnFloor(farEnd, { x: -side * 5.8, z: 0 }, gallery.walls).x).toBeCloseTo(side * 2);

    const midWing = { x: wing.x, z: (nearDoor + farDoor) / 2 };
    expect(moveOnFloor(midWing, { x: -side * 7, z: 0 }, gallery.walls).x * side).toBeGreaterThan(5.3);
    expect(moveOnFloor(midWing, { x: side * 9, z: 0 }, gallery.walls).x * side).toBeLessThan(10.8);
    expect(moveOnFloor(farEnd, { x: 0, z: -9 }, gallery.walls).z).toBeGreaterThan(farDoor - 3);
  });

  it('brings the visitor into key range without letting them walk through the locked door', () => {
    const center = moveOnFloor({ x: 0, z: 4 }, { x: 0, z: -1.5 }, courtyard.walls);
    const side = moveOnFloor({ x: 3, z: 4 }, { x: 0, z: -1.5 }, courtyard.walls);
    expect(isAtEntrance(center)).toBe(true);
    expect(center.z).toBeGreaterThan(entranceZ + 0.23);
    expect(isAtEntrance(side)).toBe(false);
    expect(side.z).toBeGreaterThan(2.5);
  });

  it('clears all held input and pending look changes', () => {
    const input = createInput();
    input.keys.add('KeyW');
    input.stick = { x: 1, z: 0.5 };
    input.look = { x: 12, y: 5 };
    clearInput(input);
    expect(input).toEqual(createInput());
  });
});
