import React, { useEffect, useRef } from 'react';

export default function GazeCursor({ gazePoint, faceDetected, visible }) {
  const ref = useRef(null);

  // CSS transition yerine transform kullan — daha akıcı
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.left = gazePoint.x + 'px';
    ref.current.style.top  = gazePoint.y + 'px';
  }, [gazePoint]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="gaze-cursor"
      style={{
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
      {/* İç nokta */}
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
