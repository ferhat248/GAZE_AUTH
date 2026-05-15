import React, { useEffect, useRef, useState } from 'react';
import { REGIONS } from '../utils/regionDetection';
import { useDwellDetection } from '../hooks/useDwellDetection';
import { _gazePositionRef } from '../hooks/useWebGazer';

const CLICK_MS = 3000;

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function RegionArc({ progress, color, size = 120 }) {
  const r   = size / 2 - 8;
  const c   = 2 * Math.PI * r;
  const off = c - (progress / 100) * c;
  return (
    <svg width={size} height={size} style={{ position: 'absolute', inset: 0, margin: 'auto', opacity: 0.9 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.05s linear' }}
      />
    </svg>
  );
}

function Zone({ regionKey, isActive, isHovered, progress }) {
  const region = REGIONS[regionKey];
  const corners = {
    'top-left':     'rounded-br-3xl',
    'top-right':    'rounded-bl-3xl',
    'bottom-left':  'rounded-tr-3xl',
    'bottom-right': 'rounded-tl-3xl',
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center gap-3 cursor-none select-none transition-all duration-300 ${corners[regionKey]}`}
      style={{
        border: `1.5px solid ${isActive ? region.color + '80' : 'rgba(255,255,255,0.06)'}`,
        background: isHovered
          ? `rgba(${hexToRgb(region.color)},0.12)`
          : isActive
            ? `rgba(${hexToRgb(region.color)},0.06)`
            : 'rgba(13,13,32,0.7)',
        boxShadow: isHovered
          ? `0 0 60px rgba(${hexToRgb(region.color)},0.25), inset 0 0 40px rgba(${hexToRgb(region.color)},0.08)`
          : isActive
            ? `0 0 30px rgba(${hexToRgb(region.color)},0.12)`
            : 'none',
      }}
    >
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, bottom: 16,
        border: `1px solid rgba(${hexToRgb(region.color)},0.1)`,
        borderRadius: 16, pointerEvents: 'none',
      }} />

      {isActive && <RegionArc progress={progress} color={region.color} size={130} />}

      <div style={{ fontSize: '2.5rem', filter: `drop-shadow(0 0 12px ${region.color}80)` }}>
        {region.icon}
      </div>
      <div className="font-bold text-lg" style={{ color: isActive ? '#fff' : '#94a3b8' }}>
        {region.label}
      </div>
      <div style={{ fontSize: '.72rem', color: '#64748b', fontFamily: 'monospace', zIndex: 1 }}>
        {region.url?.replace('https://', '')}
      </div>

      {isActive && (
        <div className="text-xs font-semibold px-3 py-1 rounded-full" style={{
          background: `rgba(${hexToRgb(region.color)},0.2)`,
          color: region.color,
          border: `1px solid rgba(${hexToRgb(region.color)},0.4)`,
        }}>
          {Math.round((progress / 100) * CLICK_MS / 1000 * 10) / 10}s / {CLICK_MS / 1000}s
        </div>
      )}
    </div>
  );
}

const HOME_DWELL_MS = 1500;
const HOME_R        = 22;
const HOME_C        = 2 * Math.PI * HOME_R;

export default function NavigationMode({ gazePoint, faceDetected, onBack }) {
  const { activeRegion, dwellProgress, hoveredRegion, firedRegion, clearFired } =
    useDwellDetection({ gazePoint, isActive: faceDetected });

  const [redirecting, setRedirecting] = useState(null);
  const redirectTimer = useRef(null);

  const homeRef      = useRef(null);
  const homeRingRef  = useRef(null);
  const homeLabelRef = useRef(null);

  useEffect(() => {
    if (!onBack) return;
    let rafId, lastT = 0, elapsed = 0, outMs = 0;

    const tick = (now) => {
      rafId = requestAnimationFrame(tick);
      const dt = lastT ? now - lastT : 0;
      lastT = now;

      const btn = homeRef.current;
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const { x, y } = _gazePositionRef.current;
      const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

      if (inside) {
        outMs = 0;
        elapsed = Math.min(elapsed + dt, HOME_DWELL_MS);
      } else {
        outMs += dt;
        if (outMs > 500) elapsed = 0;
      }

      const pct = elapsed / HOME_DWELL_MS;
      if (homeRingRef.current)
        homeRingRef.current.style.strokeDashoffset = HOME_C * (1 - pct);

      // Glow grows as dwell progresses — direct DOM, no React re-renders
      if (homeRef.current)
        homeRef.current.style.filter = elapsed > 50
          ? `drop-shadow(0 0 ${4 + 8 * pct}px rgba(99,102,241,${0.35 + 0.45 * pct}))`
          : 'none';

      // Label: "Ana Sayfa" at rest → countdown when dwelling
      if (homeLabelRef.current)
        homeLabelRef.current.textContent = elapsed > 50
          ? `${((HOME_DWELL_MS - elapsed) / 1000).toFixed(1)}s`
          : 'Ana Sayfa';

      if (elapsed >= HOME_DWELL_MS) {
        elapsed = 0;
        onBack();
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onBack]);

  useEffect(() => {
    if (!firedRegion) return;
    const region = REGIONS[firedRegion];
    clearFired();
    if (region?.url) {
      setRedirecting({ icon: region.icon, label: region.label, url: region.url });
      redirectTimer.current = setTimeout(() => {
        window.location.href = region.url;
      }, 1500);
    }
  }, [firedRegion, clearFired]);

  const cancelRedirect = () => {
    clearTimeout(redirectTimer.current);
    setRedirecting(null);
  };

  return (
    <>
      <div
        className="fixed inset-0"
        style={{ paddingTop: 48, cursor: 'default', background: '#050510' }}
      >

        {/* 2×2 grid */}
        <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-3 p-3">
          {Object.keys(REGIONS).map((key) => (
            <Zone
              key={key}
              regionKey={key}
              isActive={activeRegion === key}
              isHovered={hoveredRegion === key}
              progress={activeRegion === key ? dwellProgress : 0}
            />
          ))}
        </div>

        {/* Merkez crosshair */}
        <div style={{ position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 10 }}>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.08)',
            position: 'absolute', top: -20, left: 0 }} />
          <div style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.08)',
            position: 'absolute', top: 0, left: -20 }} />
        </div>

        {/* Geri butonu — sağ üst, hem tıklanabilir hem gaze-dwell */}
        {onBack && (
          <div
            ref={homeRef}
            onClick={onBack}
            style={{
              position: 'fixed', top: 8, right: 16, zIndex: 9999,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 2, cursor: 'pointer',
            }}
          >
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              <svg width={48} height={48} style={{ position: 'absolute', inset: 0 }}>
                <circle cx={24} cy={24} r={HOME_R} fill="none"
                  stroke="rgba(255,255,255,0.07)" strokeWidth={2.5} />
                <circle
                  ref={homeRingRef}
                  cx={24} cy={24} r={HOME_R}
                  fill="none" stroke="#6366f1" strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={HOME_C}
                  strokeDashoffset={HOME_C}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, margin: 8,
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.22)',
                fontSize: '.88rem',
              }}>
                ←
              </div>
            </div>
            <div
              ref={homeLabelRef}
              style={{ fontSize: '.58rem', color: '#6366f1', fontWeight: 600, minWidth: 40, textAlign: 'center' }}
            >
              Geri
            </div>
          </div>
        )}

        {/* Alt bilgi */}
        <div style={{ position: 'fixed', bottom: '1.2rem', left: '50%', transform: 'translateX(-50%)',
          padding: '.45rem 1.2rem', background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 100,
          fontSize: '.74rem', color: '#94a3b8', zIndex: 500 }}>
          Bir bölgeye 3 saniye bakın → yönlendirme &nbsp;|&nbsp; Sağ üste 1.5s bakın → geri
        </div>
      </div>

      {/* Yönlendirme overlay */}
      {redirecting && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(5,5,16,0.97)', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.4rem',
        }}>
          <div style={{ fontSize: '5rem', animation: 'bounce .55s ease-in-out infinite alternate' }}>
            {redirecting.icon}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>
            {redirecting.label}&apos;a Yönlendiriliyor...
          </div>
          <div style={{ fontSize: '.9rem', color: '#94a3b8', fontFamily: 'monospace' }}>
            {redirecting.url}
          </div>
          <button
            onClick={cancelRedirect}
            style={{
              marginTop: '.5rem', padding: '.55rem 1.4rem', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
              cursor: 'pointer', fontSize: '.85rem',
            }}
          >
            ✕ İptal Et
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce { to { transform: scale(1.1); } }
      `}</style>
    </>
  );
}
