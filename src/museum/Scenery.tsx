import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, InstancedMesh, Mesh, Object3D, Vector3 } from 'three';
import type { Room } from './layout';
import { entranceZ, pyramid } from './layout';
import { PyramidDoors } from './PyramidDoors';
import { useSurfaceDetail } from './SurfaceDetail';
import { CourtyardReflection, GlassMaterial } from './ReflectiveGlass';

export function Architecture({ room, scene }: { room: Room; scene: Object3D }) {
  const invalidate = useThree((state) => state.invalidate);
  useSurfaceDetail(scene, room, invalidate);
  useLayoutEffect(() => {
    if (room !== 'courtyard') return;
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.receiveShadow = true;
      object.castShadow = object.name !== 'Pavers' && object.name !== 'Pool';
    });
  }, [room, scene]);
  return <primitive object={scene} />;
}

export function AimLight({ position, target, color, intensity, angle, distance }: {
  position: [number, number, number]; target: [number, number, number]; color: string;
  intensity: number; angle: number; distance: number;
}) {
  const aim = useMemo(() => new Object3D(), []);
  return <>
    <primitive object={aim} position={target} />
    <spotLight position={position} target={aim} color={color} intensity={intensity} angle={angle} distance={distance} decay={2} penumbra={0.83} />
  </>;
}

function Sky() {
  return <mesh renderOrder={-10}>
    <sphereGeometry args={[90, 32, 18]} />
    <shaderMaterial side={DoubleSide} depthWrite={false} vertexShader={`
      varying vec3 direction;
      void main() {
        direction = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `} fragmentShader={`
      varying vec3 direction;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }
      void main() {
        vec3 d = normalize(direction);
        float t = smoothstep(-0.06, 0.64, d.y);
        vec3 sky = mix(vec3(0.44, 0.37, 0.41), vec3(0.055, 0.11, 0.22), t);
        float glow = pow(max(0.0, dot(d, normalize(vec3(-0.9, 0.05, -0.7)))), 7.0);
        sky += glow * vec3(0.16, 0.11, 0.068) * (1.0 - t);
        vec2 cloudUV = vec2(atan(d.x, -d.z) * 4.4, d.y * 20.0);
        float clouds = noise(cloudUV) * 0.56 + noise(cloudUV * 2.12) * 0.27 + noise(cloudUV * 4.28) * 0.12;
        float haze = 1.0 - smoothstep(0.1, 0.65, d.y);
        sky += (smoothstep(0.42, 0.70, clouds) - 0.35) * haze * vec3(0.15, 0.12, 0.13);
        gl_FragColor = vec4(sky, 1.0);
      }
    `} />
  </mesh>;
}

const { halfWidth, centerZ, height, doorHalfWidth, doorHeight } = pyramid;
const corners = [[-halfWidth, -halfWidth], [halfWidth, -halfWidth], [halfWidth, halfWidth], [-halfWidth, halfWidth]];
const vertical = new Vector3(0, 1, 0);

function pyramidMeshes() {
  const bars: { from: Vector3; to: Vector3; radius: number }[] = [];
  const glazing: BufferGeometry[] = [];
  const n = 10;
  const openingTop = doorHeight / height;
  const addBar = (from: Vector3, to: Vector3, radius = 0.018) => {
    if (from.distanceToSquared(to) > 0.000001) bars.push({ from, to, radius });
  };

  for (let side = 0; side < 4; side++) {
    const panes: number[] = [];
    const [ax, az] = corners[side];
    const [bx, bz] = corners[(side + 1) % 4];
    const point = (u: number, v: number) => new Vector3(ax * (1 - u - v) + bx * u, Math.max(0.1, height * v), centerZ + az * (1 - u - v) + bz * u);
    const front = side === 2;
    const triangle = (a: Vector3, b: Vector3, c: Vector3) => panes.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    if (front) {
      const left = 0.5 - doorHalfWidth / (2 * halfWidth);
      const right = 1 - left;
      const tl = left - openingTop / 2;
      const tr = right - openingTop / 2;
      triangle(point(0, 0), point(left, 0), point(tl, openingTop));
      triangle(point(0, 0), point(tl, openingTop), point(0, openingTop));
      triangle(point(right, 0), point(1, 0), point(tr, openingTop));
      triangle(point(1, 0), point(1 - openingTop, openingTop), point(tr, openingTop));
      triangle(point(0, openingTop), point(1 - openingTop, openingTop), point(0, 1));
      addBar(point(left, 0), point(tl, openingTop), 0.036);
      addBar(point(right, 0), point(tr, openingTop), 0.036);
      addBar(point(tl, openingTop), point(tr, openingTop), 0.036);
    } else triangle(point(0, 0), point(1, 0), point(0, 1));

    function addGridBar(from: Vector3, to: Vector3) {
      if (!front) { addBar(from, to); return; }
      const limits = [0, 1];
      for (const [at, start, end] of [[-doorHalfWidth, from.x, to.x], [doorHalfWidth, from.x, to.x], [doorHeight, from.y, to.y]]) {
        const cut = (at - start) / (end - start);
        if (cut > 0 && cut < 1) limits.push(cut);
      }
      limits.sort((a, b) => a - b);
      for (let i = 1; i < limits.length; i++) {
        const middle = from.clone().lerp(to, (limits[i - 1] + limits[i]) / 2);
        if (Math.abs(middle.x) >= doorHalfWidth || middle.y >= doorHeight) addBar(from.clone().lerp(to, limits[i - 1]), from.clone().lerp(to, limits[i]));
      }
    }

    addBar(point(0, 0), point(0, 1), 0.048);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      addGridBar(point(t, 0), point(t, 1 - t));
      addGridBar(point(1 - t, 0), point(0, 1 - t));
      if (i % 2 === 0) addGridBar(point(0, t), point(1 - t, t));
    }
    const pane = new BufferGeometry();
    pane.setAttribute('position', new Float32BufferAttribute(panes, 3));
    pane.computeVertexNormals();
    pane.computeBoundingSphere();
    glazing.push(pane);
  }
  return { bars, glazing };
}

function Pyramid() {
  const { bars, glazing } = useMemo(pyramidMeshes, []);
  useEffect(() => () => { for (const pane of glazing) pane.dispose(); }, [glazing]);
  const metal = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!metal.current) return;
    const member = new Object3D();
    const direction = new Vector3();
    for (const [index, { from, to, radius }] of bars.entries()) {
      direction.subVectors(to, from);
      member.position.copy(from).lerp(to, 0.5);
      member.quaternion.setFromUnitVectors(vertical, direction.clone().normalize());
      member.scale.set(radius, direction.length(), radius);
      member.updateMatrix();
      metal.current.setMatrixAt(index, member.matrix);
    }
    metal.current.instanceMatrix.needsUpdate = true;
    metal.current.computeBoundingSphere();
  }, [bars]);
  return <group>
    <instancedMesh ref={metal} args={[undefined, undefined, bars.length]}>
      <cylinderGeometry args={[1, 1, 1, 5]} /><meshStandardMaterial color="#9b9a94" metalness={0.56} roughness={0.45} />
    </instancedMesh>
    {glazing.map((pane) => <mesh key={pane.uuid} geometry={pane}><GlassMaterial /></mesh>)}
    {[-1, 1].map((side) => <mesh key={side} position={[side * (doorHalfWidth + 0.03), doorHeight / 2, entranceZ + 0.035]}>
      <boxGeometry args={[0.092, doorHeight, 0.075]} /><meshStandardMaterial color="#a28255" metalness={0.62} roughness={0.38} />
    </mesh>)}
    <mesh position={[0, doorHeight, entranceZ + 0.035]}><boxGeometry args={[2.48, 0.09, 0.075]} /><meshStandardMaterial color="#a28255" metalness={0.62} roughness={0.38} /></mesh>
    {[-1, 1].map((side) => <group key={side} position={[side * 3.25, 0.176, centerZ]}>
      <mesh><boxGeometry args={[0.112, 0.043, 7.43]} /><meshStandardMaterial color="#403a30" metalness={0.5} roughness={0.46} /></mesh>
      <mesh position={[0, 0.026, 0]}><boxGeometry args={[0.058, 0.012, 7.39]} /><meshBasicMaterial color="#dc9d57" /></mesh>
    </group>)}
  </group>;
}

export function CourtyardLight({ unlocking, onDoorOpened }: { unlocking: boolean; onDoorOpened: () => void }) {
  return <>
    <Sky />
    <CourtyardReflection />
    <hemisphereLight color="#a4bce9" groundColor="#8a725c" intensity={0.73} />
    <directionalLight color="#e5def0" position={[-22, 22, 14]} intensity={0.88} castShadow
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-37} shadow-camera-right={37}
      shadow-camera-top={29} shadow-camera-bottom={-29} shadow-camera-far={110} shadow-normalBias={0.055} />
    {[-16, -8, 0, 8, 16].map((x) => <AimLight key={x} position={[x, 0.6, -12.6]} target={[x, 6.8, -16.5]} color="#ffbd76" intensity={122} angle={0.63} distance={20} />)}
    <AimLight position={[0, 2, -1.4]} target={[0, 0, 5]} color="#ffb66b" intensity={111} angle={0.76} distance={14} />
    <AimLight position={[-0.86, 3.06, 4.47]} target={[0, 1.2, entranceZ]} color="#ffd6a7" intensity={49} angle={0.6} distance={7} />
    <Pyramid />
    <PyramidDoors unlocking={unlocking} onOpened={onDoorOpened} />
  </>;
}

export function GalleryLight() {
  return <>
    <color attach="background" args={['#14151c']} />
    <hemisphereLight color="#b8c0d4" groundColor="#90725b" intensity={0.37} />
    <directionalLight color="#bacce9" position={[-3, 9, 2]} intensity={0.16} />
  </>;
}
