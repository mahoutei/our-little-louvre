import type { RefObject } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

export function useMuseumMotion(scope: RefObject<HTMLElement | null>, setup: () => void, dependencies: unknown[] = []) {
  useGSAP(() => {
    const media = gsap.matchMedia(scope.current ?? undefined);
    media.add('(prefers-reduced-motion: no-preference)', setup);
    return () => media.revert();
  }, { scope, dependencies, revertOnUpdate: true });
}

export { gsap };
