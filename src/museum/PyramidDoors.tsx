import { useLayoutEffect, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import type { Group } from 'three';
import { gsap } from '../motion';
import { entranceZ, pyramid } from './layout';
import { GlassMaterial } from './ReflectiveGlass';

const { doorHalfWidth, doorHeight } = pyramid;
const openDuration = 0.78;

export function PyramidDoors({ unlocking, onOpened }: { unlocking: boolean; onOpened: () => void }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);

  useLayoutEffect(() => {
    if (!unlocking || !left.current || !right.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onOpened();
      return;
    }
    const leftDoor = left.current;
    const rightDoor = right.current;
    const motion = gsap.timeline({ paused: true, defaults: { duration: openDuration, ease: 'power2.inOut' } })
      .to(leftDoor.rotation, { y: Math.PI * 0.42 }, 0)
      .to(rightDoor.rotation, { y: -Math.PI * 0.42 }, 0);
    // Base the room handoff on elapsed time even when rendering misses several frames.
    const start = performance.now();
    let frame: number;
    function open(timestamp: number) {
      const progress = Math.max(0, Math.min(1, (timestamp - start) / (openDuration * 1000)));
      motion.progress(progress);
      if (progress === 1) onOpened();
      else frame = requestAnimationFrame(open);
    }
    frame = requestAnimationFrame(open);
    return () => {
      cancelAnimationFrame(frame);
      motion.kill();
    };
  }, [onOpened, unlocking]);

  return <group position={[0, 0.02, entranceZ + 0.05]}>
    {[-1, 1].map((side) => {
      const width = doorHalfWidth - 0.028;
      const center = -side * width / 2;
      const latch = -side * (width - 0.083);
      return <group key={side} ref={side < 0 ? left : right} position={[side * doorHalfWidth, 0, 0]}>
        <mesh position={[center, doorHeight / 2, 0]}>
          <boxGeometry args={[width, doorHeight - 0.13, 0.045]} />
          <GlassMaterial door />
        </mesh>
        {[0.089, 0.13 + doorHeight * 0.30, doorHeight - 0.09].map((y) => (
          <RoundedBox key={y} args={[width, 0.084, 0.066]} radius={0.007} smoothness={1} position={[center, y, 0.022]}>
            <meshStandardMaterial color="#9f8154" metalness={0.66} roughness={0.38} />
          </RoundedBox>
        ))}
        {[-side * 0.035, -side * (width - 0.035)].map((x) => (
          <RoundedBox key={x} args={[0.064, doorHeight - 0.11, 0.081]} radius={0.008} smoothness={1} position={[x, doorHeight / 2, 0.03]}>
            <meshStandardMaterial color="#a68756" metalness={0.67} roughness={0.34} />
          </RoundedBox>
        ))}
        <group position={[latch, 1.32, 0.076]}>
          <RoundedBox args={[0.119, 0.39, 0.035]} radius={0.011} smoothness={2}>
            <meshStandardMaterial color="#b99861" metalness={0.72} roughness={0.37} />
          </RoundedBox>
          <mesh position={[0, 0.055, 0.098]}>
            <capsuleGeometry args={[0.018, 0.193, 4, 10]} />
            <meshStandardMaterial color="#caa86d" metalness={0.7} roughness={0.24} />
          </mesh>
          {[-0.027, 0.139].map((y) => <mesh key={y} position={[0, y, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.021, 0.091, 10]} />
            <meshStandardMaterial color="#b3925f" metalness={0.73} roughness={0.28} />
          </mesh>)}
          {side === 1 && <group position={[0, -0.125, 0.018]}>
            <mesh position={[0, 0, 0.004]}><ringGeometry args={[0.017, 0.028, 18]} /><meshStandardMaterial color="#ceb17c" metalness={0.72} roughness={0.29} /></mesh>
            <mesh position={[0, 0, 0.003]}><circleGeometry args={[0.017, 18]} /><meshStandardMaterial color="#6e5739" metalness={0.48} roughness={0.48} /></mesh>
            <mesh position={[0, 0.003, 0.005]}><circleGeometry args={[0.007, 12]} /><meshBasicMaterial color="#211a15" /></mesh>
            <mesh position={[0, -0.006, 0.005]}><planeGeometry args={[0.007, 0.014]} /><meshBasicMaterial color="#211a15" /></mesh>
          </group>}
        </group>
      </group>;
    })}
  </group>;
}
