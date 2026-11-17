import { useEffect } from 'react';
import type { RefObject } from 'react';
import { clearInput, isMovementKey } from './movement';
import type { Input } from './movement';

export type WalkInput = Input & { lastDrag: number };

export function requestMouseLook(canvas: HTMLCanvasElement) {
  try {
    const result = canvas.requestPointerLock?.();
    if (result) void result.catch(() => {});
  } catch {
    // Drag is available when the browser rejects pointer lock.
  }
}

export function useWalkInput(canvas: HTMLCanvasElement, input: RefObject<WalkInput>, active: boolean, inspect: () => void) {
  useEffect(() => {
    const clear = () => clearInput(input.current);
    if (!active) {
      clear();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      return;
    }

    let drag: { id: number; x: number; y: number; travel: number } | undefined;
    const stop = () => { drag = undefined; clear(); };
    const keyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      if ((event.target as Element | null)?.closest?.('input,textarea,select,[contenteditable]')) return;
      if (event.code === 'Escape' && document.pointerLockElement === canvas) {
        document.exitPointerLock();
        stop();
      }
      if (isMovementKey(event.code)) { event.preventDefault(); input.current.keys.add(event.code); }
      if (event.code === 'KeyE' && !event.repeat) inspect();
    };
    const keyUp = (event: KeyboardEvent) => input.current.keys.delete(event.code);
    const lockedMotion = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      input.current.look.x += event.movementX * 0.0024;
      input.current.look.y += event.movementY * 0.0024;
    };
    const beginDrag = (event: PointerEvent) => {
      if (document.pointerLockElement === canvas || event.button !== 0 || drag) return;
      if (event.pointerType === 'touch' && event.clientX < canvas.getBoundingClientRect().left + canvas.clientWidth * 0.39) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 };
    };
    const dragLook = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.travel += Math.hypot(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (drag.travel < 5) return;
      const factor = event.pointerType === 'mouse' ? 0.0038 : 0.005;
      input.current.look.x += dx * factor;
      input.current.look.y += dy * factor;
    };
    const endDrag = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      if (drag.travel >= 5) input.current.lastDrag = performance.now();
      drag = undefined;
    };
    const lockChanged = () => { if (document.pointerLockElement !== canvas) stop(); };
    const lockedClick = (event: MouseEvent) => {
      if (event.button === 0 && document.pointerLockElement === canvas) inspect();
    };
    const events = new AbortController();
    const { signal } = events;
    window.addEventListener('keydown', keyDown, { signal });
    window.addEventListener('keyup', keyUp, { signal });
    window.addEventListener('blur', stop, { signal });
    window.addEventListener('pagehide', stop, { signal });
    window.addEventListener('orientationchange', stop, { signal });
    window.addEventListener('resize', stop, { signal });
    window.addEventListener('pointerup', endDrag, { signal });
    window.addEventListener('pointercancel', stop, { signal });
    window.addEventListener('pointermove', dragLook, { signal });
    canvas.addEventListener('pointerdown', beginDrag, { signal });
    canvas.addEventListener('click', lockedClick, { signal });
    document.addEventListener('mousemove', lockedMotion, { signal });
    document.addEventListener('pointerlockchange', lockChanged, { signal });
    document.addEventListener('visibilitychange', stop, { signal });
    return () => {
      events.abort();
      stop();
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [active, canvas, input, inspect]);
}
