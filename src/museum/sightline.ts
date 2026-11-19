import type { Object3D, Raycaster, Vector3 } from 'three';

/**
 * True when the room model does not block the view from `origin` towards
 * `direction` before it reaches `distance`.
 */
export function hasClearSightline(
  raycaster: Raycaster,
  origin: Vector3,
  direction: Vector3,
  distance: number,
  occluders: Object3D | null,
): boolean {
  if (!occluders) return true;
  raycaster.set(origin, direction);
  raycaster.far = distance - 0.015;
  return raycaster.intersectObject(occluders, true).length === 0;
}
