import { useEffect } from 'react';
import { Mesh, MeshStandardMaterial, NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import type { Object3D, Texture } from 'three';
import type { Room } from './layout';

export const galleryLightUrl = '/materials/gallery-light.webp';

const details: Record<string, { map: string; scale: number }> = {
  Pavers: { map: 'paving', scale: 0.49 },
  Limestone: { map: 'limestone', scale: 0.59 },
  'Warm Plaster': { map: 'plaster', scale: 0.33 },
  Parquet: { map: 'oak', scale: 0.49 },
};

export function useSurfaceDetail(scene: Object3D, room: Room, invalidate: () => void) {
  useEffect(() => {
    const loader = new TextureLoader();
    const materials = new Set<MeshStandardMaterial>();
    const bakedMaterials = new Set<MeshStandardMaterial>();
    const textures: Texture[] = [];
    const restore: (() => void)[] = [];
    let active = true;

    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of list) {
        if (!(material instanceof MeshStandardMaterial)) continue;
        materials.add(material);
        if (room === 'gallery' && object.geometry.hasAttribute('uv1')) bakedMaterials.add(material);
      }
    });

    if (bakedMaterials.size) {
      textures.push(loader.load(galleryLightUrl, (atlas) => {
        if (!active) return;
        atlas.flipY = false;
        atlas.channel = 1;
        atlas.colorSpace = SRGBColorSpace;
        atlas.anisotropy = 4;
        atlas.needsUpdate = true;
        for (const material of bakedMaterials) {
          const { lightMap, lightMapIntensity } = material;
          material.lightMap = atlas;
          material.lightMapIntensity = 1.55;
          material.needsUpdate = true;
          restore.push(() => {
            material.lightMap = lightMap;
            material.lightMapIntensity = lightMapIntensity;
            material.needsUpdate = true;
          });
        }
        invalidate();
      }));
    }

    for (const material of materials) {
      if (material.name === 'Skylight') {
        const glow = material.emissiveIntensity;
        const tint = material.color.clone();
        material.emissiveIntensity = 0.055;
        material.color.set('#647285');
        restore.push(() => { material.emissiveIntensity = glow; material.color.copy(tint); });
      }

      const detail = details[material.name];
      if (!detail) continue;
      const { normalMap, roughnessMap, roughness } = material;
      const originalScale = material.normalScale.clone();
      restore.push(() => {
        material.normalMap = normalMap;
        material.roughnessMap = roughnessMap;
        material.roughness = roughness;
        material.normalScale.copy(originalScale);
        material.needsUpdate = true;
      });

      for (const channel of ['normal', 'roughness'] as const) {
        const texture = loader.load(`/materials/${detail.map}-${channel}.webp`, (loaded) => {
          if (!active) return;
          loaded.flipY = false;
          loaded.colorSpace = NoColorSpace;
          loaded.wrapS = loaded.wrapT = RepeatWrapping;
          loaded.anisotropy = 4;
          loaded.needsUpdate = true;
          if (channel === 'normal') {
            material.normalMap = loaded;
            material.normalScale.setScalar(detail.scale);
          } else {
            material.roughnessMap = loaded;
            material.roughness = 1;
          }
          material.needsUpdate = true;
          invalidate();
        });
        textures.push(texture);
      }
    }
    return () => {
      active = false;
      for (const reset of restore) reset();
      for (const texture of textures) texture.dispose();
    };
  }, [invalidate, room, scene]);
}
