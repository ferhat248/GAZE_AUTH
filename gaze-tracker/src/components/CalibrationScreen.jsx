import React, { useEffect, useRef } from 'react';
import { ptToPx } from '../utils/gazeUtils';
import { useGazeAccuracyTest } from '../utils/gazeAccuracyTest';
import {
  VALIDATION_POINTS, valPtToPx,
  accuracyGrade, stabilityGrade,
} from '../utils/accuracyValidation';
import { _gazePositionRef } from '../hooks/useWebGazer';

const DOT_LIFE  = 2500;  // ms a prediction dot lives
const DOT_RATE  = 33;    // ms between dots (~30 dots/sec, matches WebGazer prediction rate)
const PREC_R    = 100;   // px radius used for live precision %

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
  const {
    phase, activeIndex, clickMap, doneSet, progress,
    points, clicksPerPoint, start, handleDotClick, finishValidation,
  } = cal;

  const valTest = useGazeAccuracyTest({ active: phase === 'validating' });

  // Canvas-based scatter system refs
  const canvasRef  = useRef(null);
  const dotPoolRef = useRef([]);   // { x, y, t }[]
  const liveAccRef = useRef(null); // DOM span for live precision %

  // ── Validation scatter: real gaze predictions plotted as blue dots ──────────
  // Matches WebGazer demo behaviour: every prediction → dot, dots fade over DOT_LIFE ms
  useEffect(() => {
    if (phase !== 'validating' || valTest.step === 'results') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const safeIdx    = Math.min(valTest.ptIndex, VALIDATION_POINTS.length - 1);
    const isSampling = valTest.step === 'sampling';

    dotPoolRef.current = [];
    let rafId, lastDotT = 0;

    const loop = (now) => {
      // ── Add a new prediction dot at the current raw gaze position ──────────
      // DOT_RATE gate prevents 60-dot/sec spam; actual WebGazer fires ~15-30/sec
      if (now - lastDotT >= DOT_RATE) {
        const { x, y } = _gazePositionRef.current;
        dotPoolRef.current.push({ x, y, t: now });
        lastDotT = now;
      }

      // ── Remove expired dots ─────────────────────────────────────────────────
      const alive = dotPoolRef.current.filter(d => now - d.t < DOT_LIFE);
      dotPoolRef.current = alive;

      // ── Draw ────────────────────────────────────────────────────────────────
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const dot of alive) {
        const age   = now - dot.t;
        const life  = 1 - age / DOT_LIFE;         // 1→0 over lifetime
        const alpha = life * 0.85;
        const r     = Math.max(2.5, 5 * (0.6 + 0.4 * life)); // shrinks slightly with age

        // Glow halo
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${alpha * 0.2})`;
        ctx.fill();

        // Core prediction dot — matches WebGazer demo's blue dots
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(96,165,250,${alpha})`;
        ctx.fill();
      }

      // ── Live precision: % of recent dots within PREC_R px of target ─────────
      if (liveAccRef.current) {
        if (isSampling && alive.length >= 5) {
          const tpx    = valPtToPx(VALIDATION_POINTS[safeIdx]);
          const recent = alive.filter(d => now - d.t < 2000);
          const within = recent.filter(d => {
            const dx = d.x - tpx.x, dy = d.y - tpx.y;
            return dx * dx + dy * dy < PREC_R * PREC_R;
          });
          liveAccRef.current.textContent =
            recent.length >= 5 ? `${Math.round(within.length / recent.length * 100)}%` : '—';
        } else {
          liveAccRef.current.textContent = '';
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [phase, valTest.step, valTest.ptIndex]);

  /* ── PHASE: idle ─────────────────────────────────────────────────────────── */
  if (phase === 'idle') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-40" style={{ background: '#050510' }}>
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 110% 65% at 8% -12%, rgba(99,102,241,0.16) 0%, transparent 65%), radial-gradient(ellipse 80% 55% at 92% 112%, rgba(139,92,246,0.13) 0%, transparent 65%)',
        }} />
        <div className="scan-line" />
        <div className="relative z-10 text-center p-10 rounded-3xl max-w-md w-11/12" style={{
          background: 'rgba(13,13,32,0.95)', border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(16px)', boxShadow: '0 0 60px rgba(99,102,241,0.1)',
          animation: 'fadeIn 0.4s ease-out',
        }}>
          <div className="text-6xl mb-4">👁️</div>
          <h1 className="text-2xl font-black mb-2" style={{
            background: 'linear-gradient(135deg, #818cf8, #a78bfa, #67e8f9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>GazeTracker</h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: '#94a3b8' }}>
            Göz takibi için önce 9 noktalı kalibrasyon gereklidir.<br />
            Her sarı noktaya <strong className="text-white">bakarak</strong> üzerine{' '}
            <strong className="text-white">5 kez tıklayın</strong>.
          </p>
          <div className="flex flex-col gap-2 mb-8 text-left">
            {[
              '① Kameraya izin verin',
              '② Her noktaya bakın ve 5 kez tıklayın',
              '③ Kalibrasyon sonrası doğruluk testi yapılır',
            ].map((s, i) => (
              <div key={i} className="px-3 py-2 rounded-xl text-sm" style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8',
              }}>{s}</div>
            ))}
          </div>
          <button
            onClick={start}
            className="w-full py-3 rounded-2xl font-bold text-white text-base transition-transform hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}
          >
            Kalibrasyonu Başlat →
          </button>
        </div>
      </div>
    );
  }

  /* ── PHASE: validating ───────────────────────────────────────────────────── */
  if (phase === 'validating') {

    /* Results screen */
    if (valTest.step === 'results') {
      const res    = valTest.result;
      if (!res) return null;
      const aGrade     = accuracyGrade(res.accuracy);
      const sGrade     = stabilityGrade(res.stability);
      const isGood     = res.accuracy >= 65;
      const validPts   = res.pointStats.filter(s => s.count > 0);
      const avgSamples = validPts.length
        ? validPts.reduce((a, s) => a + s.count, 0) / validPts.length : 0;
      const confidence = Math.min(100, Math.round(avgSamples / 30 * 100));

      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#050510', zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'fixed', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(99,102,241,0.08) 0%, transparent 70%)',
          }} />
          <div style={{
            position: 'relative', zIndex: 10, width: 370, padding: '2.2rem',
            background: 'rgba(13,13,32,0.97)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24, backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(99,102,241,0.12)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '.92rem', fontWeight: 700, color: '#94a3b8', marginBottom: '1.4rem' }}>
              🎯 Kalibrasyon Doğruluk Testi
            </div>

            <div style={{
              width: 110, height: 110, borderRadius: '50%', margin: '0 auto 1.1rem',
              background: `radial-gradient(circle, ${aGrade.color}18 0%, transparent 70%)`,
              border: `3px solid ${aGrade.color}`, boxShadow: `0 0 28px ${aGrade.color}44`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: aGrade.color, lineHeight: 1 }}>
                {res.accuracy}%
              </div>
              <div style={{ fontSize: '.68rem', color: aGrade.color, opacity: 0.85, marginTop: 2 }}>
                {aGrade.label}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1.2rem' }}>
              {[
                ['Ortalama Hata', `${res.meanError}px`, '#f8fafc'],
                ['Stabilite',    `${res.stability}% — ${sGrade.label}`, sGrade.color],
                ['Güven Skoru',  `${confidence}%`, confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444'],
              ].map(([label, value, color]) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '.45rem .75rem', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                }}>
                  <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{label}</span>
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '.6rem' }}>
              {!isGood && (
                <button
                  onClick={() => {
                    window.webgazer?.clearData();
                    localStorage.removeItem('webgazerGlobalData');
                    cal.reset();
                    cal.start();
                  }}
                  style={{
                    flex: 1, padding: '.6rem', borderRadius: 12, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                    color: '#f87171', fontWeight: 700, fontSize: '.8rem',
                  }}
                >↺ Yeniden Kalibre Et</button>
              )}
              <button
                onClick={finishValidation}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 12, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: '.8rem',
                  boxShadow: '0 2px 14px rgba(99,102,241,0.4)',
                }}
              >Devam Et →</button>
            </div>

            <p style={{ marginTop: '.85rem', fontSize: '.72rem', lineHeight: 1.5, color: isGood ? '#10b981' : '#94a3b8' }}>
              {isGood
                ? '✓ Kalibrasyon başarılı, devam edebilirsiniz.'
                : 'Doğruluk düşük — yeniden kalibre etmenizi öneririz.'}
            </p>
          </div>
        </div>
      );
    }

    /* Live validation screen (waiting / sampling) */
    const safeIdx   = Math.min(valTest.ptIndex, VALIDATION_POINTS.length - 1);
    const currentPt = VALIDATION_POINTS[safeIdx];
    const targetPx  = valPtToPx(currentPt);
    const sampling  = valTest.step === 'sampling';

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#06060f', zIndex: 40 }}>

        {/* Top bar — single-point layout */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '.7rem 1.25rem',
          background: 'rgba(4,4,14,0.92)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: '.75rem',
        }}>
          <span style={{ fontWeight: 700, fontSize: '.88rem' }}>🎯 Doğruluk Testi</span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: sampling ? '#fbbf24' : 'rgba(255,255,255,0.2)',
            boxShadow: sampling ? '0 0 6px rgba(251,191,36,0.7)' : 'none',
            transition: 'background 0.3s, box-shadow 0.3s',
          }} />
          <span style={{ fontSize: '.78rem', color: sampling ? '#fbbf24' : '#64748b', transition: 'color 0.3s' }}>
            {sampling ? 'Örnekleniyor' : 'Hazırlanıyor'}
          </span>
        </div>

        {/* Canvas: real-time gaze prediction scatter dots */}
        <canvas
          ref={canvasRef}
          style={{ position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 6 }}
        />

        {/* Yellow target — WebGazer demo style */}
        <div style={{
          position: 'fixed',
          left: targetPx.x, top: targetPx.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'relative', width: 70, height: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {/* Pulsing ring */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid rgba(251,191,36,0.55)',
              animation: 'valPulse 1.4s ease-out infinite',
            }} />
            {/* Main circle */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(251,191,36,0.12)',
              border: '3px solid #fbbf24',
              boxShadow: sampling
                ? '0 0 32px rgba(251,191,36,0.8), 0 0 8px rgba(251,191,36,0.5)'
                : '0 0 16px rgba(251,191,36,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'box-shadow 0.3s',
            }}>
              {/* Center dot */}
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
            </div>
          </div>

          <div style={{
            padding: '.28rem .8rem', borderRadius: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.09)',
            fontSize: '.76rem', fontWeight: 600, color: '#94a3b8',
            whiteSpace: 'nowrap',
          }}>
            {sampling ? '⚡ Ölçülüyor...' : `${currentPt.label} noktasına bakın`}
          </div>
        </div>

        {/* Bottom: live precision from real scatter data */}
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '.5rem',
          padding: '.38rem .9rem', borderRadius: 100,
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.07)',
          fontSize: '.72rem', color: '#64748b', whiteSpace: 'nowrap',
        }}>
          {sampling
            ? <><span>Hassasiyet (100px içinde):</span><span ref={liveAccRef} style={{ color: '#60a5fa', fontWeight: 700, fontSize: '.8rem', minWidth: 30, display: 'inline-block' }} /></>
            : <span ref={liveAccRef}>Hazırlanıyor — noktaya bakın...</span>
          }
        </div>

        <style>{`
          @keyframes valPulse {
            0%   { transform: scale(1);   opacity: 0.7; }
            100% { transform: scale(1.9); opacity: 0;   }
          }
        `}</style>
      </div>
    );
  }

  /* ── PHASE: active (calibration dots) ───────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-40" style={{
      background: '#06060f', cursor: 'crosshair',
      backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
      backgroundSize: '50px 50px',
    }}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-3" style={{
        background: 'rgba(4,4,14,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span className="font-semibold text-sm">🎯 Kalibrasyon</span>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#94a3b8' }}>{doneSet.size} / {points.length} nokta</span>
          <div className="w-36 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full" style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span className="text-xs font-bold" style={{ color: '#818cf8' }}>{progress}%</span>
        </div>
      </div>

      {/* Hint */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full text-sm" style={{
        background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.28)', color: '#a5b4fc',
        whiteSpace: 'nowrap',
      }}>
        {phase === 'done'
          ? '✅ Kalibrasyon tamamlandı!'
          : `Nokta ${activeIndex + 1} / ${points.length} — ${clicksPerPoint - (clickMap[activeIndex] ?? 0)} tık kaldı`}
      </div>

      {/* Calibration dots */}
      {points.map((pt, i) => {
        const px     = ptToPx(pt, 48);
        const clicks = clickMap[i] ?? 0;
        const done   = doneSet.has(i);
        const active = i === activeIndex && phase === 'active';
        const size   = 44;

        return (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            className={`cal-dot ${active ? 'cal-dot-active' : ''}`}
            style={{
              left: px.x, top: px.y, width: size, height: size,
              background: done ? 'rgba(16,185,129,0.25)' : active ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.08)',
              border: `3px solid ${done ? '#10b981' : active ? '#fbbf24' : 'rgba(99,102,241,0.3)'}`,
              boxShadow: done ? '0 0 14px rgba(16,185,129,0.6)' : active ? '0 0 20px rgba(251,191,36,0.7)' : 'none',
              cursor: done ? 'default' : 'crosshair',
              pointerEvents: done ? 'none' : 'auto',
            }}
          >
            {active && !done && (
              <>
                <div style={{
                  position: 'absolute', width: size * 2.4, height: size * 2.4,
                  borderRadius: '50%', border: '1.5px solid rgba(251,191,36,0.45)',
                  top: '50%', left: '50%',
                  animation: 'calRingPulse 1.6s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <ProgressRing progress={(clicks / clicksPerPoint) * 100} size={size} stroke={3} color="#fbbf24" />
              </>
            )}
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
