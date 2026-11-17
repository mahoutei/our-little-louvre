import { useEffect, useMemo } from 'react';
import {
  BoxGeometry, CanvasTexture, Euler, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3,
} from 'three';
import type { Material } from 'three';
import type { Wing } from '../../shared/types';
import type { DisplayExhibit } from '../exhibits/manifest';
import type { FramePlacement } from './ExhibitFrames';
import { ExhibitFrame } from './ExhibitFrames';
import { WING, alleyCenterZ, alleyEndZ, alleyStartZ } from './wingLayout';
import { galleryBackZ } from './layout';

const NUMERALS: readonly [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function roman(value: number): string {
  let remaining = Math.max(1, value);
  let result = '';
  for (const [amount, numeral] of NUMERALS) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}

export function alleyCountOf(wing: Wing | undefined): number {
  if (!wing) return 0;
  return wing.alleys.reduce((highest, alley) => Math.max(highest, alley.index + 1), 0);
}

export function useWingPlacements(wing: Wing | undefined): FramePlacement[] {
  return useMemo(() => {
    if (!wing) return [];
    const left = new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0));
    const right = new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0));
    const placements: FramePlacement[] = [];
    for (const alley of wing.alleys) {
      const center = alleyCenterZ(alley.index);
      for (const exhibit of alley.exhibits) {
        if (!exhibit.published) continue;
        const side = exhibit.slotIndex % 2 === 0 ? -1 : 1;
        const row = Math.floor(exhibit.slotIndex / 2);
        placements.push({
          exhibit,
          position: new Vector3(side * (WING.roomHalfWidth - 0.1), WING.frameHeight, center + (1 - row) * WING.frameSpacing),
          orientation: side < 0 ? left : right,
          finale: false,
        });
      }
    }
    return placements;
  }, [wing]);
}

function Plaque({ text, subtext, position, width = 1.6, height = 0.42, rotationY = 0 }: {
  text: string;
  subtext?: string;
  position: [number, number, number];
  width?: number;
  height?: number;
  rotationY?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.round((1024 * height) / width));
    const context = canvas.getContext('2d');
    if (!context) return null;
    const { width: w, height: h } = canvas;
    context.fillStyle = '#211a13';
    context.fillRect(0, 0, w, h);
    context.strokeStyle = '#8a6840';
    context.lineWidth = Math.max(4, h * 0.025);
    context.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#ead4aa';
    context.font = `${subtext ? Math.round(h * 0.38) : Math.round(h * 0.44)}px Georgia, serif`;
    context.fillText(text, w / 2, subtext ? h * 0.39 : h * 0.51);
    if (subtext) {
      context.fillStyle = '#baa07a';
      context.font = `${Math.round(h * 0.2)}px Georgia, serif`;
      context.fillText(subtext, w / 2, h * 0.72);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [text, subtext, width, height]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return <mesh position={position} rotation={[0, rotationY, 0]}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

function useWingMaterials() {
  const materials = useMemo(() => ({
    floor: new MeshStandardMaterial({ color: '#6f4e31', roughness: 0.72 }),
    stone: new MeshStandardMaterial({ color: '#b8a58b', roughness: 0.9 }),
    plaster: new MeshStandardMaterial({ color: '#cdbaa0', roughness: 0.95 }),
    deep: new MeshStandardMaterial({ color: '#5a4330', roughness: 0.88 }),
    trim: new MeshStandardMaterial({ color: '#ddc7a5', roughness: 0.58, metalness: 0.04 }),
    brass: new MeshStandardMaterial({ color: '#a6814f', roughness: 0.37, metalness: 0.58 }),
    dark: new MeshStandardMaterial({ color: '#241d18', roughness: 0.82 }),
    ceiling: new MeshStandardMaterial({ color: '#d4c4ad', roughness: 0.97 }),
    glow: new MeshBasicMaterial({ color: '#ffe1ae', toneMapped: false }),
  }), []);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  return materials;
}

export function WingArchitecture({ wing }: { wing: Wing }) {
  const count = Math.max(1, alleyCountOf(wing));
  const materials = useWingMaterials();
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  useEffect(() => () => box.dispose(), [box]);

  const boxAt = (position: [number, number, number], scale: [number, number, number], material: Material, key?: string | number) => (
    <mesh key={key} geometry={box} material={material} position={position} scale={scale} receiveShadow />
  );

  const entryCenter = galleryBackZ - WING.entryDepth / 2;
  const lastIndex = count - 1;
  const lastAlley = wing.alleys.find((alley) => alley.index === lastIndex);
  const hanging = lastAlley?.exhibits.length ?? 0;
  const remaining = Math.max(0, wing.capacity - hanging);

  return <group>
    <color attach="background" args={['#171310']} />
    <ambientLight color="#f0e0ca" intensity={0.92} />
    <hemisphereLight color="#d8c7b2" groundColor="#8d6a49" intensity={0.48} />
    <directionalLight color="#ffe6c4" position={[-4, 11, 6]} intensity={0.62} />

    {/* The threshold behind the visitor, set into the gallery's back wall. */}
    {boxAt([0, -0.06, entryCenter], [WING.entryHalfWidth * 2, 0.12, WING.entryDepth], materials.stone)}
    {boxAt([0, WING.height, entryCenter], [WING.entryHalfWidth * 2, 0.2, WING.entryDepth], materials.ceiling)}
    {[-1, 1].map((side) => <group key={`entry-${side}`}>
      {boxAt([side * (WING.entryHalfWidth + 0.13), WING.height / 2, entryCenter], [0.26, WING.height, WING.entryDepth], materials.plaster)}
      {boxAt([side * (WING.entryHalfWidth - 0.02), 0.22, entryCenter], [0.08, 0.44, WING.entryDepth], materials.deep)}
      {boxAt([side * (WING.entryHalfWidth - 0.22), WING.height - 0.3, entryCenter], [0.05, 0.05, WING.entryDepth - 0.4], materials.glow)}
    </group>)}
    {[-1, 1].map((side) => <group key={`door-${side}`}>
      {boxAt([side * 0.62, 1.55, galleryBackZ - 0.12], [1.2, 3.1, 0.12], materials.dark)}
      {boxAt([side * 0.11, 1.45, galleryBackZ - 0.05], [0.05, 0.26, 0.05], materials.brass)}
    </group>)}
    {boxAt([0, 3.2, galleryBackZ - 0.12], [2.76, 0.16, 0.2], materials.trim)}
    {[-1, 1].map((side) => boxAt([side * 1.36, 1.55, galleryBackZ - 0.12], [0.16, 3.1, 0.2], materials.trim))}
    {boxAt([0, 0.035, galleryBackZ - 0.06], [2.5, 0.05, 0.03], materials.glow)}

    {Array.from({ length: count }, (_, index) => {
      const start = alleyStartZ(index);
      const end = alleyEndZ(index);
      const center = alleyCenterZ(index);
      const alley = wing.alleys.find((candidate) => candidate.index === index);
      const photos = alley?.exhibits.filter((exhibit) => exhibit.published).length ?? 0;
      const last = index === lastIndex;
      return <group key={`alley-${index}`}>
        {boxAt([0, -0.06, center], [WING.roomHalfWidth * 2, 0.12, WING.alleyDepth], materials.stone)}
        {boxAt([0, -0.048, center], [2.5, 0.13, WING.alleyDepth], materials.floor)}
        {[-1, 1].map((side) => boxAt([side * 1.27, -0.04, center], [0.035, 0.02, WING.alleyDepth], materials.brass))}
        {boxAt([0, WING.height, center], [WING.roomHalfWidth * 2, 0.2, WING.alleyDepth], materials.ceiling)}
        {[-1, 1].map((side) => <group key={`side-${index}-${side}`}>
          {boxAt([side * (WING.roomHalfWidth + 0.13), WING.height / 2, center], [0.26, WING.height, WING.alleyDepth], materials.plaster)}
          {boxAt([side * (WING.roomHalfWidth - 0.03), 0.22, center], [0.08, 0.44, WING.alleyDepth], materials.deep)}
          {boxAt([side * (WING.roomHalfWidth - 0.03), 0.82, center], [0.06, 0.08, WING.alleyDepth], materials.trim)}
          {boxAt([side * (WING.roomHalfWidth - 0.04), WING.height - 0.24, center], [0.16, 0.18, WING.alleyDepth], materials.trim)}
          {boxAt([side * 2.9, WING.height - 0.3, center], [0.05, 0.05, WING.alleyDepth - 0.5], materials.glow)}
          {[-4.5, -1.55, 1.55, 4.5].map((offset) => <group key={`pilaster-${index}-${side}-${offset}`}>
            {boxAt([side * (WING.roomHalfWidth - 0.06), 1.66, center + offset], [0.14, 3.32, 0.32], materials.plaster)}
            {boxAt([side * (WING.roomHalfWidth - 0.065), 3.36, center + offset], [0.2, 0.16, 0.42], materials.trim)}
            {boxAt([side * (WING.roomHalfWidth - 0.065), 0.16, center + offset], [0.2, 0.2, 0.42], materials.deep)}
          </group>)}
        </group>)}
        {[-2.4, 0, 2.4].map((offset) => boxAt([0, WING.height - 0.18, center + offset], [WING.roomHalfWidth * 2, 0.16, 0.14], materials.trim))}

        {/* Doorway into this alley, with a lintel and its name above. */}
        {[-1, 1].map((side) => boxAt([side * ((WING.roomHalfWidth + WING.openingHalfWidth) / 2), WING.height / 2, start], [WING.roomHalfWidth - WING.openingHalfWidth, WING.height, 0.26], materials.plaster))}
        {boxAt([0, (3.2 + WING.height) / 2, start], [WING.openingHalfWidth * 2, WING.height - 3.2, 0.26], materials.plaster)}
        {boxAt([0, 3.2, start], [WING.openingHalfWidth * 2 + 0.3, 0.16, 0.34], materials.trim)}
        <Plaque text={`ALLEY ${roman(index + 1)}`} subtext={`${photos} photograph${photos === 1 ? '' : 's'}`}
          position={[0, 3.72, start + 0.145]} width={1.65} height={0.4} />

        {last ? <group>
          {boxAt([0, WING.height / 2, end], [WING.roomHalfWidth * 2, WING.height, 0.26], materials.plaster)}
          {[-1, 1].map((side) => boxAt([side * 0.63, 1.52, end + 0.16], [1.22, 3.04, 0.12], materials.dark))}
          {[-1, 1].map((side) => boxAt([side * 0.12, 1.42, end + 0.24], [0.05, 0.26, 0.05], materials.brass))}
          {[-1, 1].map((side) => boxAt([side * 1.31, 1.6, end + 0.16], [0.16, 3.2, 0.2], materials.trim))}
          {boxAt([0, 3.18, end + 0.16], [2.78, 0.16, 0.2], materials.trim)}
          {boxAt([0, 0.04, end + 0.2], [2.5, 0.05, 0.03], materials.glow)}
          <Plaque text={remaining ? 'THE NEXT ALLEY' : 'THIS ALLEY IS FULL'}
            subtext={remaining ? `${remaining} frame${remaining === 1 ? '' : 's'} remain` : 'The next photograph opens a new one'}
            position={[0, 3.75, end + 0.18]} width={2.7} height={0.62} />
        </group> : <group>
          {[-1, 1].map((side) => boxAt([side * ((WING.roomHalfWidth + WING.openingHalfWidth) / 2), WING.height / 2, end], [WING.roomHalfWidth - WING.openingHalfWidth, WING.height, 0.26], materials.plaster))}
          {boxAt([0, (3.2 + WING.height) / 2, end], [WING.openingHalfWidth * 2, WING.height - 3.2, 0.26], materials.plaster)}
          {boxAt([0, 3.2, end], [WING.openingHalfWidth * 2 + 0.3, 0.16, 0.34], materials.trim)}
          {boxAt([0, WING.height, end - WING.passageDepth / 2], [WING.openingHalfWidth * 2, 0.2, WING.passageDepth], materials.ceiling)}
          {[-1, 1].map((side) => boxAt([side * (WING.openingHalfWidth + 0.13), WING.height / 2, end - WING.passageDepth / 2], [0.26, WING.height, WING.passageDepth], materials.plaster))}
          {[-1, 1].map((side) => boxAt([side * (WING.openingHalfWidth - 0.03), 0.22, end - WING.passageDepth / 2], [0.08, 0.44, WING.passageDepth], materials.deep))}
          {boxAt([0, -0.06, end - WING.passageDepth / 2], [WING.openingHalfWidth * 2, 0.12, WING.passageDepth], materials.stone)}
        </group>}
      </group>;
    })}
  </group>;
}

export function WingFrames({ wing, onOpen, enabled }: {
  wing: Wing;
  onOpen: (exhibit: DisplayExhibit) => void;
  enabled: (ray: import('three').Ray, point: Vector3) => boolean;
}) {
  const placements = useWingPlacements(wing);
  return <>{placements.map((placement) => <ExhibitFrame key={placement.exhibit.id} placement={placement} onInspect={onOpen}
    enabled={enabled} size={1.5} lit={false} />)}</>;
}
