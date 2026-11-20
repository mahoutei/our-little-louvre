import { useEffect, useMemo } from 'react';
import {
  BoxGeometry, CanvasTexture, Euler, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3,
} from 'three';
import type { Material } from 'three';
import type { WingAlley } from '../../shared/types';
import type { FramePlacement } from './ExhibitFrames';
import { WING, alleyCenterZ, alleyEndZ, alleyStartZ, wingFramePosition } from './wingLayout';
import { galleryBackZ } from './layout';

export function useWingPlacements(rooms: readonly WingAlley[]): FramePlacement[] {
  return useMemo(() => {
    const left = new Quaternion().setFromEuler(new Euler(0, Math.PI / 2, 0));
    const right = new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0));
    return rooms.flatMap(({ exhibits }, room) => exhibits.map((exhibit) => {
      const { x, y, z } = wingFramePosition(room, exhibit.slotIndex);
      return { exhibit, position: new Vector3(x, y, z), orientation: x < 0 ? left : right, finale: false };
    }));
  }, [rooms]);
}

function Plaque({ text, position, width = 1.6, height = 0.42, rotationY = 0 }: {
  text: string;
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
    context.font = `${Math.round(h * 0.44)}px Georgia, serif`;
    context.fillText(text, w / 2, h * 0.51, w * 0.88);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [text, width, height]);

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
    ceiling: new MeshStandardMaterial({ color: '#d4c4ad', roughness: 0.97 }),
    glow: new MeshBasicMaterial({ color: '#ffe1ae', toneMapped: false }),
  }), []);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  return materials;
}

export function WingArchitecture({ rooms }: { rooms: readonly WingAlley[] }) {
  const materials = useWingMaterials();
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  useEffect(() => () => box.dispose(), [box]);

  const boxAt = (position: [number, number, number], scale: [number, number, number], material: Material, key?: string | number) => (
    <mesh key={key} geometry={box} material={material} position={position} scale={scale} receiveShadow />
  );

  const entryCenter = galleryBackZ - WING.entryDepth / 2;

  return <group>
    <color attach="background" args={['#171310']} />
    <ambientLight color="#f0e0ca" intensity={0.52} />
    <hemisphereLight color="#d8c7b2" groundColor="#8d6a49" intensity={0.54} />
    <directionalLight color="#ffe6c4" position={[-4, 11, 6]} intensity={0.36} />

    {/* The threshold behind the visitor, set into the gallery's back wall. */}
    {boxAt([0, -0.06, entryCenter], [WING.entryHalfWidth * 2, 0.12, WING.entryDepth], materials.stone)}
    {boxAt([0, WING.height, entryCenter], [WING.entryHalfWidth * 2, 0.2, WING.entryDepth], materials.ceiling)}
    {[-1, 1].map((side) => <group key={`entry-${side}`}>
      {boxAt([side * (WING.entryHalfWidth + 0.13), WING.height / 2, entryCenter], [0.26, WING.height, WING.entryDepth], materials.plaster)}
      {boxAt([side * (WING.entryHalfWidth - 0.02), 0.22, entryCenter], [0.08, 0.44, WING.entryDepth], materials.deep)}
      {boxAt([side * (WING.entryHalfWidth - 0.22), WING.height - 0.3, entryCenter], [0.05, 0.05, WING.entryDepth - 0.4], materials.glow)}
    </group>)}
    {boxAt([0, WING.height / 2, galleryBackZ - 0.32], [WING.entryHalfWidth * 2, WING.height, WING.wallThickness], materials.plaster)}
    {boxAt([0, 0.22, galleryBackZ - 0.46], [WING.entryHalfWidth * 2, 0.44, 0.08], materials.deep)}
    <Plaque text="The Gallery of Us" position={[0, 1.84, galleryBackZ - 0.46]} width={2.2} rotationY={Math.PI} />

    {rooms.map((room, index) => {
      const start = alleyStartZ(index);
      const end = alleyEndZ(index);
      const center = alleyCenterZ(index);
      const nextRoom = rooms[index + 1];
      return <group key={room.index}>
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
        <Plaque text={`Room ${room.index + 1}`} position={[0, 3.55, start + 0.145]} />

        {!nextRoom ? <group>
          {boxAt([0, WING.height / 2, end], [WING.roomHalfWidth * 2, WING.height, 0.26], materials.plaster)}
          {boxAt([0, 0.41, end + 0.16], [WING.roomHalfWidth * 2, 0.82, 0.08], materials.deep)}
          {boxAt([0, 0.85, end + 0.17], [WING.roomHalfWidth * 2, 0.07, 0.11], materials.trim)}
          <Plaque text="End of the New Wing" position={[0, 1.84, end + 0.145]} width={2.5} height={0.45} />
        </group> : <group>
          {[-1, 1].map((side) => boxAt([side * ((WING.roomHalfWidth + WING.openingHalfWidth) / 2), WING.height / 2, end], [WING.roomHalfWidth - WING.openingHalfWidth, WING.height, 0.26], materials.plaster))}
          {boxAt([0, (3.2 + WING.height) / 2, end], [WING.openingHalfWidth * 2, WING.height - 3.2, 0.26], materials.plaster)}
          {boxAt([0, 3.2, end], [WING.openingHalfWidth * 2 + 0.3, 0.16, 0.34], materials.trim)}
          <Plaque text={`Room ${nextRoom.index + 1}`} position={[0, 3.55, end + 0.145]} />
          <Plaque text={`Room ${room.index + 1}`} position={[0, 3.55, alleyStartZ(index + 1) - 0.145]} rotationY={Math.PI} />
          {boxAt([0, WING.height, end - WING.passageDepth / 2], [WING.openingHalfWidth * 2, 0.2, WING.passageDepth], materials.ceiling)}
          {[-1, 1].map((side) => boxAt([side * (WING.openingHalfWidth + 0.13), WING.height / 2, end - WING.passageDepth / 2], [0.26, WING.height, WING.passageDepth], materials.plaster))}
          {[-1, 1].map((side) => boxAt([side * (WING.openingHalfWidth - 0.03), 0.22, end - WING.passageDepth / 2], [0.08, 0.44, WING.passageDepth], materials.deep))}
          {boxAt([0, -0.06, end - WING.passageDepth / 2], [WING.openingHalfWidth * 2, 0.12, WING.passageDepth], materials.stone)}
        </group>}
      </group>;
    })}
  </group>;
}
