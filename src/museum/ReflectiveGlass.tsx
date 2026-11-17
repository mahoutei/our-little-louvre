import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { DoubleSide, EquirectangularReflectionMapping, SRGBColorSpace, TextureLoader } from 'three';
import type { MeshStandardMaterial } from 'three';

const fresnel: MeshStandardMaterial['onBeforeCompile'] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
    #include <normal_fragment_begin>
    float grazing = 1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
    diffuseColor.a = mix(diffuseColor.a, 0.87, pow(grazing, 2.4));
  `);
};

export function GlassMaterial({ door = false }: { door?: boolean }) {
  return <meshStandardMaterial transparent depthWrite={false} side={DoubleSide} forceSinglePass
    color={door ? '#78828b' : '#9db7c8'} opacity={door ? 0.24 : 0.085}
    metalness={0.75} roughness={door ? 0.15 : 0.09} onBeforeCompile={fresnel} />;
}

export function CourtyardReflection() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let active = true;
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const probe = new TextureLoader().load('/materials/courtyard-reflection.webp', (texture) => {
      if (!active) return;
      texture.mapping = EquirectangularReflectionMapping;
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      scene.environment = texture;
      scene.environmentIntensity = 1.12;
      invalidate();
    });
    return () => {
      active = false;
      if (scene.environment === probe) {
        scene.environment = previous;
        scene.environmentIntensity = previousIntensity;
      }
      probe.dispose();
    };
  }, [invalidate, scene]);
  return null;
}
