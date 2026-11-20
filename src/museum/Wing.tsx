import { useEffect, useMemo } from 'react';
import {
  BoxGeometry, CanvasTexture, Euler, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SRGBColorSpace, Vector3,
} from 'three';
import type { Material } from 'three';
import type { WingAlley } from '../../shared/types';
import type { FramePlacement } from './ExhibitFrames';
import { WING, alleyCenterZ, alleyEndZ, alleyStartZ, wingFramePosition, wingPoint } from './wingLayout';
import { hall } from './layout';
import { AimLight } from './Scenery';

export function useWingPlacements(rooms: readonly WingAlley[]): (FramePlacement & { wingRoom: number; featured: boolean })[] {
  return useMemo(() => {
    return rooms.flatMap(({ exhibits }, room) => exhibits.map((exhibit, index) => {
      const featured = index === 0;
      const { x, y, z, yaw } = wingFramePosition(room, exhibit.slotIndex, featured);
      const point = wingPoint(x, z);
      const orientation = new Quaternion().setFromEuler(new Euler(0, yaw - Math.PI / 2, 0));
      return { exhibit, position: new Vector3(point.x, y, point.z), orientation, finale: false, wingRoom: room, featured };
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
    floor: new MeshStandardMaterial({ color: '#5e3e30', roughness: 0.8 }),
    stone: new MeshStandardMaterial({ color: '#968373', roughness: 0.91 }),
    plaster: new MeshStandardMaterial({ color: '#51383b', roughness: 0.95 }),
    deep: new MeshStandardMaterial({ color: '#3e2c2a', roughness: 0.88 }),
    trim: new MeshStandardMaterial({ color: '#b49a76', roughness: 0.58 }),
    brass: new MeshStandardMaterial({ color: '#a6814f', roughness: 0.37, metalness: 0.58 }),
    ceiling: new MeshStandardMaterial({ color: '#62534c', roughness: 0.97 }),
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

  const entryCenter = -WING.entryDepth / 2;
  const passage = { center: WING.passageCenter, half: WING.passageHalfWidth };
  const doorway = (z: number, center: number, half: number) => {
    const left = center - half;
    const right = center + half;
    const top = 2.76;
    return <>
      {boxAt([(left - WING.roomHalfWidth) / 2, WING.height / 2, z], [left + WING.roomHalfWidth, WING.height, 0.26], materials.plaster)}
      {boxAt([(right + WING.roomHalfWidth) / 2, WING.height / 2, z], [WING.roomHalfWidth - right, WING.height, 0.26], materials.plaster)}
      {boxAt([center, (top + WING.height) / 2, z], [half * 2, WING.height - top, 0.26], materials.plaster)}
      {boxAt([center, top, z], [half * 2 + 0.24, 0.12, 0.32], materials.trim)}
    </>;
  };

  return <group position={[hall.halfWidth, 0, hall.salon.z]} rotation={[0, -Math.PI / 2, 0]}>
    {boxAt([1.68, 3.02, 0.52], [0.055, 0.055, 1.12], materials.brass)}
    <Plaque text="The New Wing →" position={[1.72, 2.76, 0.76]} width={1.12} height={0.36} rotationY={Math.PI / 2} />
    <Plaque text="The New Wing" position={[0, 3.74, 0.28]} width={1.9} />
    <AimLight position={[0, 3.32, -0.8]} target={[0, 0, 0.65]} color="#ffc590" intensity={35} angle={0.72} distance={7} />
    {boxAt([0, -0.06, entryCenter], [WING.entryHalfWidth * 2, 0.12, WING.entryDepth], materials.stone)}
    {boxAt([0, WING.height, entryCenter], [WING.entryHalfWidth * 2, 0.2, WING.entryDepth], materials.ceiling)}
    {[-1, 1].map((side) => <group key={`entry-${side}`}>
      {boxAt([side * (WING.entryHalfWidth + 0.13), WING.height / 2, entryCenter], [0.26, WING.height, WING.entryDepth], materials.plaster)}
      {boxAt([side * (WING.entryHalfWidth - 0.02), 0.22, entryCenter], [0.08, 0.44, WING.entryDepth], materials.deep)}
    </group>)}

    {Array.from({ length: Math.max(1, rooms.length) }, (_, index) => {
      const room = rooms[index];
      const start = alleyStartZ(index);
      const end = alleyEndZ(index);
      const center = alleyCenterZ(index);
      const nextRoom = rooms[index + 1];
      return <group key={room?.index ?? index}>
        {boxAt([0, -0.06, center], [WING.roomHalfWidth * 2, 0.12, WING.alleyDepth], materials.stone)}
        {boxAt([0, -0.048, center], [2.5, 0.13, WING.alleyDepth], materials.floor)}
        {[-1, 1].map((side) => boxAt([side * 1.27, -0.04, center], [0.035, 0.02, WING.alleyDepth], materials.brass))}
        {boxAt([0, WING.height, center], [WING.roomHalfWidth * 2, 0.2, WING.alleyDepth], materials.ceiling)}
        {[-1, 1].map((side) => <group key={`side-${index}-${side}`}>
          {boxAt([side * (WING.roomHalfWidth + 0.13), WING.height / 2, center], [0.26, WING.height, WING.alleyDepth], materials.plaster)}
          {boxAt([side * (WING.roomHalfWidth - 0.03), 0.22, center], [0.08, 0.44, WING.alleyDepth], materials.deep)}
          {boxAt([side * (WING.roomHalfWidth - 0.03), 0.82, center], [0.06, 0.08, WING.alleyDepth], materials.trim)}
          {boxAt([side * (WING.roomHalfWidth - 0.04), WING.height - 0.24, center], [0.16, 0.18, WING.alleyDepth], materials.trim)}
          {[-4.5, -1.55, 1.55, 4.5].map((offset) => <group key={`pilaster-${index}-${side}-${offset}`}>
            {boxAt([side * (WING.roomHalfWidth - 0.06), 1.66, center + offset], [0.14, 3.32, 0.32], materials.plaster)}
            {boxAt([side * (WING.roomHalfWidth - 0.065), 3.36, center + offset], [0.2, 0.16, 0.42], materials.trim)}
            {boxAt([side * (WING.roomHalfWidth - 0.065), 0.16, center + offset], [0.2, 0.2, 0.42], materials.deep)}
          </group>)}
        </group>)}
        {[-2.4, 0, 2.4].map((offset) => boxAt([0, WING.height - 0.18, center + offset], [WING.roomHalfWidth * 2, 0.16, 0.14], materials.trim))}

        {doorway(start, index ? passage.center : 0, index ? passage.half : WING.entryHalfWidth)}
        {room && index > 0 && <Plaque text={`Room ${room.index + 1}`} position={[passage.center, 3.13, start + 0.145]} />}

        {!nextRoom ? <group>
          {boxAt([0, WING.height / 2, end], [WING.roomHalfWidth * 2, WING.height, 0.26], materials.plaster)}
          {boxAt([0, 0.41, end + 0.16], [WING.roomHalfWidth * 2, 0.82, 0.08], materials.deep)}
          {boxAt([0, 0.85, end + 0.17], [WING.roomHalfWidth * 2, 0.07, 0.11], materials.trim)}
          <Plaque text={room ? 'End of the New Wing' : 'New memories will hang here'}
            position={[room ? 0 : 0.1, room ? 3.37 : 1.8, end + 0.145]} width={2.4} height={0.4} />
          {!room && <AimLight position={[0, 3, end + 2.5]} target={[0, 1.8, end]} color="#ffcf9a" intensity={45} angle={0.65} distance={5} />}
        </group> : <group>
          {doorway(end, passage.center, passage.half)}
          <Plaque text={`Room ${nextRoom.index + 1}`} position={[passage.center, 3.13, end + 0.145]} width={1.35} />
          <Plaque text={`Room ${room!.index + 1}`} position={[passage.center, 3.13, alleyStartZ(index + 1) - 0.145]} width={1.35} rotationY={Math.PI} />
          {boxAt([passage.center, WING.height, end - WING.passageDepth / 2], [passage.half * 2, 0.2, WING.passageDepth], materials.ceiling)}
          {[-1, 1].map((side) => boxAt([passage.center + side * (passage.half + 0.13), WING.height / 2, end - WING.passageDepth / 2], [0.26, WING.height, WING.passageDepth], materials.plaster, side))}
          {boxAt([passage.center, -0.06, end - WING.passageDepth / 2], [passage.half * 2, 0.12, WING.passageDepth], materials.stone)}
        </group>}
      </group>;
    })}
  </group>;
}
