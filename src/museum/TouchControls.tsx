import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';
import type { WalkInput } from './useWalkInput';

const centered = 'translate(0px, 0px)';

export function TouchControls({ input, active, requestFrame }: {
  input: RefObject<WalkInput>; active: boolean; requestFrame: () => void;
}) {
  const held = useRef<{ pointer: number; x: number; y: number; radius: number }>(undefined);
  const knob = useRef<HTMLSpanElement>(null);
  const release = useCallback(() => {
    if (!held.current) return;
    held.current = undefined;
    input.current.stick.x = 0;
    input.current.stick.z = 0;
    if (knob.current) knob.current.style.transform = centered;
    requestFrame();
  }, [input, requestFrame]);

  useEffect(() => {
    if (!active) release();
    window.addEventListener('blur', release);
    window.addEventListener('pagehide', release);
    window.addEventListener('orientationchange', release);
    window.addEventListener('resize', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('blur', release);
      window.removeEventListener('pagehide', release);
      window.removeEventListener('orientationchange', release);
      window.removeEventListener('resize', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [active, release]);

  function move(event: PointerEvent<HTMLDivElement>) {
    const drag = held.current;
    if (!drag || drag.pointer !== event.pointerId) return;
    const { radius } = drag;
    const x = event.clientX - drag.x;
    const y = event.clientY - drag.y;
    const scale = Math.max(radius, Math.hypot(x, y));
    input.current.stick.x = x / scale;
    input.current.stick.z = y / scale;
    if (knob.current) knob.current.style.transform = `translate(${x * radius / scale}px, ${y * radius / scale}px)`;
    requestFrame();
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (held.current?.pointer === event.pointerId) release();
  }

  return <div className="touch-controls" hidden={!active}>
    <div className="joystick" data-testid="joystick" aria-hidden="true"
      onPointerDown={(event) => {
        if (!active || held.current !== undefined) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        held.current = { pointer: event.pointerId, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2, radius: bounds.width * 0.33 };
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }} onPointerMove={move} onPointerUp={endDrag} onLostPointerCapture={endDrag} onPointerCancel={endDrag}>
      <span className="joystick-cross" /><span className="joystick-knob" ref={knob} style={{ transform: centered }} />
    </div>
  </div>;
}
