import React, { useEffect, useRef, memo } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';

const SIZE = 20;
const HALF = SIZE / 2;

function GazeCursor({ faceDetected, visible }) {
  const elRef = useRef(null);

  useEffect(() => {
    if (!elRef.current) return;
    let rafId;
    const el = elRef.current;

    const loop = () => {
      const { x, y } = _gazePositionRef.current;
      el.style.transform = `translate3d(${x - HALF}px,${y - HALF}px,0)`;
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={elRef}
      style={{
        position:      'fixed',
        left:          0,
        top:           0,
        width:         SIZE,
        height:        SIZE,
        borderRadius:  '50%',
        pointerEvents: 'none',
        zIndex:        9999,
        willChange:    'transform',
        background: faceDetected
          ? 'rgba(99,102,241,0.85)'
          : 'rgba(239,68,68,0.7)',
        border: `2px solid ${faceDetected ? 'rgba(129,140,248,0.9)' : 'rgba(248,113,113,0.8)'}`,
        boxShadow: faceDetected
          ? '0 0 10px rgba(99,102,241,0.7)'
          : '0 0 8px rgba(239,68,68,0.55)',
        opacity: faceDetected ? 1 : 0.65,
      }}
    />
  );
}

export default memo(GazeCursor, (prev, next) =>
  prev.faceDetected === next.faceDetected && prev.visible === next.visible
);
