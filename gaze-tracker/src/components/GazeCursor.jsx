import React, { useEffect, useRef, memo } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';

function GazeCursor({ faceDetected, visible }) {
  const ref = useRef(null);

  // RAF loop: React render döngüsünden bağımsız, ekran yenilemesiyle senkron
  useEffect(() => {
    if (!ref.current) return;
    let rafId;
    let lastX = -999, lastY = -999;
    const loop = () => {
      if (ref.current) {
        const { x, y } = _gazePositionRef.current;
        // 0.4px altındaki sub-pixel titremeleri engelle
        if (Math.abs(x - lastX) > 0.4 || Math.abs(y - lastY) > 0.4) {
          ref.current.style.transform = `translate3d(${x - 14}px, ${y - 14}px, 0)`;
          lastX = x; lastY = y;
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="gaze-cursor"
      style={{
        left: 0,
        top: 0,
        willChange: 'transform',
        transition: 'transform 0.025s linear',
        width:  28,
        height: 28,
        background: faceDetected
          ? 'radial-gradient(circle, rgba(99,102,241,0.9) 0%, rgba(99,102,241,0.2) 70%)'
          : 'radial-gradient(circle, rgba(239,68,68,0.7) 0%, rgba(239,68,68,0.1) 70%)',
        border: `2px solid ${faceDetected ? 'rgba(129,140,248,0.9)' : 'rgba(239,68,68,0.7)'}`,
        boxShadow: faceDetected
          ? '0 0 16px rgba(99,102,241,0.8), 0 0 32px rgba(99,102,241,0.3)'
          : '0 0 12px rgba(239,68,68,0.6)',
        opacity: faceDetected ? 1 : 0.5,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: 6, height: 6,
          borderRadius: '50%',
          background: '#fff',
          transform: 'translate(-50%,-50%)',
          boxShadow: '0 0 4px rgba(255,255,255,0.9)',
        }}
      />
    </div>
  );
}

// Sadece faceDetected veya visible değişince re-render et (gazePoint → artık props üzerinden gelmiyor)
export default memo(GazeCursor, (prev, next) =>
  prev.faceDetected === next.faceDetected && prev.visible === next.visible
);
