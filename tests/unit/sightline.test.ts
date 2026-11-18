import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Raycaster, Scene, Vector3 } from 'three';
import { hasClearSightline } from '../../src/museum/sightline';

const origin = new Vector3(0, 1.5, 0);
const target = new Vector3(0, 1.5, -5);
const direction = new Vector3().subVectors(target, origin).normalize();
const distance = origin.distanceTo(target);

function wallAt(z: number) {
  const scene = new Scene();
  const wall = new Mesh(new BoxGeometry(6, 4, 0.2), new MeshBasicMaterial());
  wall.position.set(0, 1.5, z);
  scene.add(wall);
  scene.updateMatrixWorld(true);
  return scene;
}

describe('museum sightlines', () => {
  it('sees a frame when the path is clear', () => {
    expect(hasClearSightline(new Raycaster(), origin, direction, distance, wallAt(-12))).toBe(true);
  });

  it('stops at a wall between the visitor and the frame', () => {
    expect(hasClearSightline(new Raycaster(), origin, direction, distance, wallAt(-2))).toBe(false);
  });

  it('does not need a room model to allow a click', () => {
    expect(hasClearSightline(new Raycaster(), origin, direction, distance, null)).toBe(true);
  });
});
