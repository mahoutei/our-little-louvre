import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { preload } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { ACESFilmicToneMapping, PerspectiveCamera, Raycaster, Vector3 } from 'three';
import type { Ray } from 'three';
import type { Exhibit, Manifest } from '../exhibits/manifest';
import { Icon } from '../Icons';
import { ExhibitFrame, useFramePlacements } from './ExhibitFrames';
import type { FramePlacement } from './ExhibitFrames';
import { doorPose, isAtEntrance, isNearEntrance, rooms } from './layout';
import type { Pose, Room } from './layout';
import { clearInput, createInput, EYE_HEIGHT, movementVector, moveOnFloor, WALK_SPEED } from './movement';
import { Architecture, CourtyardLight, GalleryLight, modelUrl } from './Scenery';
import { galleryLightUrl } from './SurfaceDetail';
import { TouchControls } from './TouchControls';
import { requestMouseLook, useWalkInput } from './useWalkInput';
import type { WalkInput } from './useWalkInput';

type Props = {
  room: Room; manifest?: Manifest; active: boolean; visible: boolean; reset: number;
  doorRequest: number; unlocking: boolean; onDoorProximity: (near: boolean) => void; onUnlock: () => void;
  onReady: (room: Room) => void; onDoorOpened: () => void; onOpen: (exhibit: Exhibit) => void; onFailure: () => void;
};

type RoomProps = Omit<Props, 'visible'> & { input: RefObject<WalkInput>; setTarget: (exhibit?: Exhibit) => void; target: RefObject<Exhibit | undefined> };
const INSPECT_RANGE = 4.7;
const WALKTHROUGH_FOV = 56;

export function clearRoomModel(room: Room) {
  useGLTF.clear(modelUrl(room));
}

function LoadedRoom(props: RoomProps) {
  return props.room === 'courtyard' ? <World {...props} /> : <GalleryWorld {...props} />;
}

function GalleryWorld(props: RoomProps) {
  const frames = useFramePlacements(props.manifest);
  return <World {...props} frames={frames} />;
}

function World({ room, input, active, reset, doorRequest, unlocking, onDoorProximity, onUnlock, target, setTarget, onReady, onDoorOpened, onOpen, onFailure, frames = [] }: RoomProps & { frames?: FramePlacement[] }) {
  const { camera, gl, size } = useThree();
  const { scene: building } = useGLTF(modelUrl(room), false);
  const canvas = gl.domElement;
  const pose = useRef({ ...rooms[room].spawn });
  const nearDoor = useRef(false);
  const appliedDoorRequest = useRef(doorRequest);
  const lastTargetCheck = useRef(0);
  const prefetchStarted = useRef(false);
  const vectors = useMemo(() => ({ forward: new Vector3(), offset: new Vector3(), front: new Vector3() }), []);
  const sightline = useMemo(() => new Raycaster(), []);

  function canClickFrame(ray: Ray, point: Vector3) {
    if (!active || document.pointerLockElement === canvas || performance.now() - input.current.lastDrag <= 250) return false;
    const distance = ray.origin.distanceTo(point);
    if (distance > INSPECT_RANGE) return false;
    sightline.ray.copy(ray);
    sightline.far = distance - 0.015;
    return sightline.intersectObject(building, true).length === 0;
  }

  const inspect = useCallback(() => {
    if (room === 'courtyard' && isAtEntrance(pose.current)) onUnlock();
    else if (target.current) onOpen(target.current);
  }, [onOpen, onUnlock, room, target]);
  useWalkInput(canvas, input, active, inspect);

  const placePlayer = useCallback((destination: Pose) => {
    pose.current = { ...destination };
    const { x, z, yaw, pitch } = destination;
    camera.position.set(x, EYE_HEIGHT, z);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    clearInput(input.current);
    setTarget();
    if (room === 'courtyard') {
      nearDoor.current = isAtEntrance(destination);
      onDoorProximity(nearDoor.current);
    }
  }, [camera, input, onDoorProximity, room, setTarget]);

  useLayoutEffect(() => { placePlayer(rooms[room].spawn); }, [placePlayer, reset, room]);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || size.height <= 0) return;
    const aspect = size.width / size.height;
    camera.fov = WALKTHROUGH_FOV + Math.max(0, 1 - aspect) * 32;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  useLayoutEffect(() => {
    if (room !== 'courtyard' || appliedDoorRequest.current === doorRequest) return;
    appliedDoorRequest.current = doorRequest;
    placePlayer(doorPose);
  }, [doorRequest, placePlayer, room]);

  useEffect(() => { onReady(room); }, [onReady, room]);
  useLayoutEffect(() => { if (room === 'courtyard') gl.shadowMap.needsUpdate = true; }, [gl, room]);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [canvas, onFailure]);

  useFrame((state, delta) => {
    if (!active) return;
    const player = pose.current;
    const controls = input.current;
    player.pitch = Math.max(-1.28, Math.min(1.28, player.pitch - controls.look.y));
    player.yaw -= controls.look.x;
    controls.look.x = 0;
    controls.look.y = 0;
    const direction = movementVector(controls, player.yaw);
    const distance = WALK_SPEED * Math.min(delta, 0.35);
    const moved = moveOnFloor(player, { x: direction.x * distance, z: direction.z * distance }, rooms[room].walls);
    player.x = moved.x;
    player.z = moved.z;
    camera.position.set(player.x, EYE_HEIGHT, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');

    if (room === 'courtyard') {
      if (!prefetchStarted.current && isNearEntrance(player)) {
        prefetchStarted.current = true;
        useGLTF.preload(modelUrl('gallery'), false);
        preload(galleryLightUrl, { as: 'image', crossOrigin: 'anonymous' });
      }
      const arrived = isAtEntrance(player);
      if (nearDoor.current !== arrived) {
        nearDoor.current = arrived;
        onDoorProximity(arrived);
      }
      return;
    }

    if (state.clock.elapsedTime - lastTargetCheck.current < 0.08) return;
    lastTargetCheck.current = state.clock.elapsedTime;
    camera.getWorldDirection(vectors.forward);
    let bestDot = 0.925;
    let best: Exhibit | undefined;
    for (const { exhibit, position, orientation } of frames) {
      vectors.offset.subVectors(position, camera.position);
      if (vectors.offset.lengthSq() > INSPECT_RANGE ** 2) continue;
      vectors.front.set(0, 0, 1).applyQuaternion(orientation);
      if (vectors.offset.dot(vectors.front) >= 0) continue;
      const distance = vectors.offset.length();
      vectors.offset.divideScalar(distance);
      const dot = vectors.offset.dot(vectors.forward);
      if (dot <= bestDot) continue;
      sightline.set(camera.position, vectors.offset);
      sightline.far = distance - 0.015;
      if (sightline.intersectObject(building, true).length > 0) continue;
      bestDot = dot;
      best = exhibit;
    }
    if (target.current?.id !== best?.id) setTarget(best);
  });

  return <>
    <Architecture room={room} scene={building} />
    {room === 'courtyard' ? <CourtyardLight unlocking={unlocking} onDoorOpened={onDoorOpened} /> : <GalleryLight />}
    {frames.map((placement) => <ExhibitFrame key={placement.exhibit.id} placement={placement} onInspect={onOpen}
      enabled={canClickFrame} />)}
  </>;
}

export default function Museum(props: Props) {
  const { active, visible, room, onOpen } = props;
  const input = useRef<WalkInput>({ ...createInput(), lastDrag: -Infinity });
  const target = useRef<Exhibit | undefined>(undefined);
  const exhibitTap = useRef<{ pointer: number; x: number; y: number; exhibitId: string } | undefined>(undefined);
  const [focusedExhibit, setFocusedExhibit] = useState<Exhibit>();
  const [locked, setLocked] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const maxDpr = window.matchMedia('(pointer: coarse)').matches ? 1.15 : 1.45;
  const setTarget = useCallback((exhibit?: Exhibit) => {
    target.current = exhibit;
    setFocusedExhibit(exhibit);
  }, []);

  useEffect(() => {
    const changed = () => setLocked(document.pointerLockElement === viewport.current?.querySelector('canvas'));
    document.addEventListener('pointerlockchange', changed);
    return () => document.removeEventListener('pointerlockchange', changed);
  }, []);

  const mouseLook = () => {
    if (!active || performance.now() - input.current.lastDrag < 250 || !window.matchMedia('(any-pointer: fine)').matches) return;
    const canvas = viewport.current?.querySelector('canvas');
    if (canvas && document.pointerLockElement !== canvas) requestMouseLook(canvas);
  };

  return <div className="museum-world">
    <div className="viewport" ref={viewport} onContextMenu={(event) => event.preventDefault()} data-room={room}>
      <Canvas shadows="percentage" dpr={[1, maxDpr]} camera={{ fov: WALKTHROUGH_FOV, near: 0.075, far: 120 }} frameloop={(active || props.unlocking) && visible ? 'always' : 'demand'}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.04 }}
        onCreated={({ gl }) => { gl.shadowMap.autoUpdate = false; }}
        onPointerMissed={(event) => { if ((event as PointerEvent).pointerType !== 'touch') mouseLook(); }} fallback="This browser does not support a canvas.">
        <Suspense fallback={null}>
          <LoadedRoom key={room} {...props} input={input} target={target} setTarget={setTarget} />
        </Suspense>
      </Canvas>
    </div>
    <TouchControls input={input} active={active} />
    {active && <>
      <div className={`reticle${focusedExhibit ? ' reticle--active' : ''}`} aria-hidden="true" />
      <aside className="movement-hints" aria-label="Walking controls">
        <span className="movement-key"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Walk</span>
        {locked ? <span><kbd>Esc</kbd> Release mouse</span> : <button className="mouse-look" onClick={mouseLook}>Click to look around</button>}
      </aside>
      <p className="touch-hint">Drag to look around</p>
    </>}
    {focusedExhibit && <button className="button button--glass inspect-button" hidden={!active && !visible}
      onClick={() => { if (active) onOpen(focusedExhibit); }}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch' && active) {
          exhibitTap.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, exhibitId: focusedExhibit.id };
        }
      }}
      onPointerCancel={() => { exhibitTap.current = undefined; }}
      onPointerUp={(event) => {
        const press = exhibitTap.current;
        if (press?.pointer !== event.pointerId) return;
        exhibitTap.current = undefined;
        if (!active || press.exhibitId !== focusedExhibit.id || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) return;
        // Some browsers suppress the synthesized click immediately after a camera swipe.
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
        onOpen(focusedExhibit);
      }}>
      {locked && <kbd aria-hidden="true">E</kbd>}<Icon name="collection" /> <span>{focusedExhibit.title}</span> <Icon name="arrow" />
    </button>}
  </div>;
}
