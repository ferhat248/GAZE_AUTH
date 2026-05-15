import React, { useEffect, useRef, memo } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';

const SIZE     = 20;
const HALF     = SIZE / 2;
const ALPHA    = 0.65;  // EMA convergence: 0.65 → ~2 frame lag @ 60fps, noticeably less jitter
const DEADZONE = 4;     // px: wider quiet zone suppresses more residual micro-motion

function GazeCursor({ faceDetected, visible }) {
  const elRef = useRef(null);

  // RAF loop: lightweight EMA on display position only.
  // _gazePositionRef stays raw — GazePassword and other consumers are unaffected.
  useEffect(() => {
    if (!elRef.current) return;
    let rafId;
    const el = elRef.current;

    let smX = 0, smY = 0; // EMA-smoothed position
    let dpX = 0, dpY = 0; // last written display position

    const loop = () => {
      const { x, y } = _gazePositionRef.current;

      // EMA: smoothed position moves ALPHA of the way to raw each frame
      smX += ALPHA * (x - smX);
      smY += ALPHA * (y - smY);

      // Deadzone on smoothed output: ignore micro-residual movement
      const dx = smX - dpX;
      const dy = smY - dpY;
      if (dx * dx + dy * dy > DEADZONE * DEADZONE) {
        dpX = smX;
        dpY = smY;
        el.style.transform = `translate3d(${dpX - HALF}px,${dpY - HALF}px,0)`;
      }

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

// Re-render only when face-detection state or visibility changes.
// Gaze position is updated via direct DOM manipulation in the RAF loop.
export default memo(GazeCursor, (prev, next) =>
  prev.faceDetected === next.faceDetected && prev.visible === next.visible
);
