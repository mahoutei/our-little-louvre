import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import type { WalkInput } from './useWalkInput';

export function TouchControls({ input, active }: { input: RefObject<WalkInput>; active: boolean }) {
  const held = useRef<number | undefined>(undefined);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function release() {
      held.current = undefined;
      input.current.stick = { x: 0, z: 0 };
      setPosition({ x: 0, y: 0 });
    }
    if (!active) release();
    window.addEventListener('blur', release);
    window.addEventListener('orientationchange', release);
    window.addEventListener('resize', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      window.removeEventListener('orientationchange', release);
      window.removeEventListener('resize', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [active, input]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (held.current !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width * 0.33;
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const scale = Math.max(radius, Math.hypot(x, y));
    input.current.stick = { x: x / scale, z: y / scale };
    setPosition({ x: x * radius / scale, y: y * radius / scale });
  }

  function release(event: PointerEvent<HTMLDivElement>) {
    if (held.current !== event.pointerId) return;
    held.current = undefined;
    input.current.stick = { x: 0, z: 0 };
    setPosition({ x: 0, y: 0 });
  }

  return <div className="touch-controls" hidden={!active}>
    <div className="joystick" data-testid="joystick" aria-hidden="true"
      onPointerDown={(event) => {
        if (!active || held.current !== undefined) return;
        held.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }} onPointerMove={move} onPointerUp={release} onLostPointerCapture={release} onPointerCancel={release}>
      <span className="joystick-cross" /><span className="joystick-knob" style={{ transform: `translate(${active ? position.x : 0}px, ${active ? position.y : 0}px)` }} />
    </div>
  </div>;
}
