import { useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { BufferGeometry, Color, Float32BufferAttribute, Quaternion, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three';
import type { Ray } from 'three';
import type { DisplayExhibit, Manifest } from '../exhibits/manifest';
import { modelUrl } from './layout';
import { AimLight } from './Scenery';

export type FramePlacement = { exhibit: DisplayExhibit; position: Vector3; orientation: Quaternion; finale: boolean };

export function useFramePlacements(manifest: Manifest | undefined): FramePlacement[] {
  const { scene } = useGLTF(modelUrl('gallery'), false);
  return useMemo(() => {
    if (!manifest) return [];
    scene.updateMatrixWorld(true);
    return manifest.exhibits.map((exhibit) => {
      const anchors: import('three').Object3D[] = [];
      scene.traverse((object) => { if (object.name === exhibit.anchor) anchors.push(object); });
      if (anchors.length !== 1) throw new Error(`Expected one model anchor for ${exhibit.anchor}.`);
      return {
        exhibit, position: anchors[0].getWorldPosition(new Vector3()), orientation: anchors[0].getWorldQuaternion(new Quaternion()),
        finale: exhibit.id === manifest.finale.exhibitId,
      };
    });
  }, [manifest, scene]);
}

function PhotoSurface({ url, size }: { url: string; size: number }) {
  const [map, setMap] = useState<Texture>();
  useEffect(() => {
    let cancelled = false;
    const texture = new TextureLoader().load(url, (result) => {
      result.colorSpace = SRGBColorSpace;
      result.anisotropy = 4;
      if (!cancelled) setMap(result);
    }, undefined, () => { if (!cancelled) setMap(undefined); });
    return () => { cancelled = true; texture.dispose(); };
  }, [url]);

  const image = map?.image as HTMLImageElement | undefined;
  const ratio = image ? image.width / image.height : 1;
  return <mesh position={[0, 0, 0.08]}>
    <planeGeometry args={[size * Math.min(1, ratio), size * Math.min(1, 1 / ratio)]} />
    <meshStandardMaterial key={map ? 'photograph' : 'placeholder'} map={map ?? null} color={map ? '#fdf9f2' : '#625246'} roughness={0.85} />
  </mesh>;
}

function frameMolding(edge: number, width: number) {
  // Follow the profile of the gilt molding from the outer back to the inner lip.
  const profile = [
    [0, 0.015, '#533b24'], [0, 0.067, '#80623e'], [0.12, 0.105, '#b08a55'],
    [0.27, 0.132, '#d4af70'], [0.38, 0.126, '#ad8150'], [0.58, 0.108, '#775532'],
    [0.76, 0.093, '#9a7547'], [0.9, 0.109, '#d6b278'], [1, 0.1, '#947147'], [1, 0.075, '#624529'],
  ] as const;
  const rings = profile.map(([inset, depth, color]) => {
    const half = edge + 0.021 - width * inset;
    return { color: new Color(color), corners: [[-half, -half, depth], [half, -half, depth], [half, half, depth], [-half, half, depth]] };
  });
  const vertices: number[] = [];
  const colors: number[] = [];
  for (let row = 0; row < rings.length - 1; row++) {
    const outer = rings[row];
    const inner = rings[row + 1];
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      vertices.push(...outer.corners[side], ...outer.corners[next], ...inner.corners[next],
        ...outer.corners[side], ...inner.corners[next], ...inner.corners[side]);
      for (const ring of [outer, outer, inner, outer, inner, inner]) colors.push(ring.color.r, ring.color.g, ring.color.b);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function PictureLight({ edge, finale }: { edge: number; finale: boolean }) {
  const height = edge + (finale ? 0.53 : 0.36);
  const reach = finale ? 1.03 : 0.84;
  const length = edge * 1.12;
  return <>
    <mesh position={[0, height + 0.10, 0.018]}>
      <boxGeometry args={[0.23, 0.15, 0.07]} />
      <meshStandardMaterial color="#594632" metalness={0.38} roughness={0.47} />
    </mesh>
    <mesh position={[0, height + 0.088, reach * 0.47]} rotation={[Math.PI / 2 - 0.14, 0, 0]}>
      <cylinderGeometry args={[0.019, 0.019, reach * 0.95, 8]} />
      <meshStandardMaterial color="#ad8b58" metalness={0.48} roughness={0.42} />
    </mesh>
    <mesh position={[0, height + 0.023, reach]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.047, 0.047, length, 12]} />
      <meshStandardMaterial color="#a28252" metalness={0.51} roughness={0.35} />
    </mesh>
    <mesh position={[0, height - 0.021, reach + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[length * 0.9, 0.038]} />
      <meshBasicMaterial color="#ffe5bb" toneMapped={false} />
    </mesh>
    <AimLight position={[0, height - 0.07, reach]} target={[0, -0.13, 0.075]} color={finale ? '#ffe1b4' : '#ffead2'}
      intensity={finale ? 26 : 16} angle={0.84} distance={finale ? 5.5 : 4.3} />
  </>;
}

export function ExhibitFrame({ placement, onInspect, enabled, size: customSize, lit = true }: {
  placement: FramePlacement; onInspect: (exhibit: DisplayExhibit) => void; enabled: (ray: Ray, point: Vector3) => boolean;
  size?: number; lit?: boolean;
}) {
  const { exhibit, position, orientation, finale } = placement;
  const size = customSize ?? (finale ? 2.38 : 1.66);
  const edge = size / 2;
  const frameWidth = finale ? 0.16 : 0.106;
  const molding = useMemo(() => frameMolding(edge, frameWidth), [edge, frameWidth]);
  useEffect(() => () => molding.dispose(), [molding]);

  return <group position={position} quaternion={orientation} onClick={(event) => {
    event.stopPropagation();
    if (enabled(event.ray, event.point)) onInspect(exhibit);
  }}>
    <mesh position={[0, 0, -0.005]}><boxGeometry args={[size + 0.025, size + 0.025, 0.10]} /><meshStandardMaterial color="#37271d" roughness={0.82} /></mesh>
    <mesh position={[0, 0, 0.064]}><boxGeometry args={[size - 0.045, size - 0.045, 0.026]} /><meshStandardMaterial color="#d2c5ad" roughness={0.93} /></mesh>
    {exhibit.published && <PhotoSurface key={exhibit.thumbnailUrl} url={exhibit.thumbnailUrl} size={size - frameWidth * 3.25} />}
    <mesh geometry={molding}><meshStandardMaterial vertexColors roughness={0.41} metalness={0.41} /></mesh>
    <mesh position={[0, -edge - 0.22, 0.004]}><boxGeometry args={[0.41, 0.12, 0.032]} /><meshStandardMaterial color="#9c805b" metalness={0.27} roughness={0.55} /></mesh>
    {lit && <PictureLight edge={edge} finale={finale} />}
  </group>;
}
