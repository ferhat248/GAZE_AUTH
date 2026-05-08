import React from 'react';
import { ptToPx } from '../utils/gazeUtils';

function ProgressRing({ progress, size = 40, stroke = 3, color = '#fbbf24' }) {
  const r   = (size - stroke * 2) / 2;
  const c   = 2 * Math.PI * r;
  const off = c - (progress / 100) * c;
  return (
    <svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transition: 'stroke-dashoffset 0.1s linear' }}
      />
    </svg>
  );
}

export default function CalibrationScreen({ cal }) {
  const { phase, activeIndex, clickMap, doneSet, progress, points, clicksPerPoint, start, handleDotClick } = cal;

  if (phase === 'idle') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-40" style={{ background: '#050510' }}>
        {/* Arka plan efekti */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 110% 65% at 8% -12%, rgba(99,102,241,0.16) 0%, transparent 65%), radial-gradient(ellipse 80% 55% at 92% 112%, rgba(139,92,246,0.13) 0%, transparent 65%)',
        }} />
        <div className="scan-line" />

        <div className="relative z-10 text-center p-10 rounded-3xl max-w-md w-11/12" style={{
          background: 'rgba(13,13,32,0.95)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 0 60px rgba(99,102,241,0.1)',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          <div className="text-6xl mb-4">👁️</div>
          <h1 className="text-2xl font-black mb-2" style={{
            background: 'linear-gradient(135deg, #818cf8, #a78bfa, #67e8f9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            GazeTracker
          </h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: '#94a3b8' }}>
            Göz takibi için önce 9 noktalı kalibrasyon gereklidir.<br />
            Her sarı noktaya <strong className="text-white">bakarak</strong> üzerine <strong className="text-white">5 kez tıklayın</strong>.
          </p>

          <div className="flex flex-col gap-2 mb-8 text-left">
            {['① Kameraya izin verin', '② Her noktaya bakın ve 5 kez tıklayın', '③ Kalibrasyon sonrası gözünüzle navigasyon yapın'].map((s, i) => (
              <div key={i} className="px-3 py-2 rounded-xl text-sm" style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8',
              }}>
                {s}
              </div>
            ))}
          </div>

          <button
            onClick={start}
            className="w-full py-3 rounded-2xl font-bold text-white text-base transition-transform hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.45)',
            }}
          >
            Kalibrasyonu Başlat →
          </button>
        </div>
      </div>
    );
  }

  // Aktif kalibrasyon
  return (
    <div className="fixed inset-0 z-40" style={{ background: '#06060f', cursor: 'crosshair' }}>
      {/* Üst bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3" style={{
        background: 'rgba(4,4,14,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span className="font-semibold text-sm">🎯 Kalibrasyon</span>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            {doneSet.size} / {points.length} nokta
          </span>
          {/* İlerleme çubuğu */}
          <div className="w-36 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: '#818cf8' }}>{progress}%</span>
        </div>
      </div>

      {/* İpucu */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full text-sm" style={{
        background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.28)', color: '#a5b4fc',
        whiteSpace: 'nowrap',
      }}>
        {phase === 'done'
          ? '✅ Kalibrasyon tamamlandı!'
          : `Nokta ${activeIndex + 1} / ${points.length} — ${clicksPerPoint - (clickMap[activeIndex] ?? 0)} tık kaldı`}
      </div>

      {/* Kalibrasyon noktaları */}
      {points.map((pt, i) => {
        const px      = ptToPx(pt, 48);
        const clicks  = clickMap[i] ?? 0;
        const done    = doneSet.has(i);
        const active  = i === activeIndex && phase === 'active';
        const size    = 44;

        return (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            className={`cal-dot ${active ? 'cal-dot-active' : ''}`}
            style={{
              left: px.x,
              top:  px.y,
              width:  size,
              height: size,
              background: done
                ? 'rgba(16,185,129,0.25)'
                : active
                  ? 'rgba(251,191,36,0.2)'
                  : 'rgba(99,102,241,0.08)',
              border: `3px solid ${done ? '#10b981' : active ? '#fbbf24' : 'rgba(99,102,241,0.3)'}`,
              boxShadow: done
                ? '0 0 14px rgba(16,185,129,0.6)'
                : active
                  ? '0 0 20px rgba(251,191,36,0.7)'
                  : 'none',
              cursor: done ? 'default' : 'crosshair',
              pointerEvents: done ? 'none' : 'auto',
            }}
          >
            {/* Progress ring */}
            {active && !done && (
              <ProgressRing
                progress={(clicks / clicksPerPoint) * 100}
                size={size}
                stroke={3}
                color="#fbbf24"
              />
            )}
            {/* İç nokta */}
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: done ? '#10b981' : active ? '#fbbf24' : 'rgba(99,102,241,0.5)',
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
            }} />
          </button>
        );
      })}
    </div>
  );
}
