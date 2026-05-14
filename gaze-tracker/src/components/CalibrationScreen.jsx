import React, { useEffect, useRef } from 'react';
import { ptToPx } from '../utils/gazeUtils';
import { useGazeAccuracyTest } from '../utils/gazeAccuracyTest';
import {
  VALIDATION_POINTS, valPtToPx,
  accuracyGrade, stabilityGrade, ptAccuracyColor,
} from '../utils/accuracyValidation';
import { _gazePositionRef } from '../hooks/useWebGazer';

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

  // Validation hook — React kuralı: her render'da çağrılmalı
  const valTest = useGazeAccuracyTest({ active: phase === 'validating' });

  // Validation görselleştirme için DOM ref'ler
  const gazeVisRef = useRef(null);
  const lineRef    = useRef(null);
  const errorRef   = useRef(null);

  // RAF loop: gaze dot, line ve hata mesafesini ekran yenileme hızında günceller
  useEffect(() => {
    if (phase !== 'validating' || valTest.step === 'results') return;
    const currentPt = VALIDATION_POINTS[Math.min(valTest.ptIndex, VALIDATION_POINTS.length - 1)];
    const targetPx  = valPtToPx(currentPt);
    let rafId;
    const loop = () => {
      const { x, y } = _gazePositionRef.current;
      if (gazeVisRef.current) {
        gazeVisRef.current.style.transform = `translate3d(${x - 6}px, ${y - 6}px, 0)`;
      }
      if (lineRef.current) {
        lineRef.current.setAttribute('x1', x);
        lineRef.current.setAttribute('y1', y);
        lineRef.current.setAttribute('x2', targetPx.x);
        lineRef.current.setAttribute('y2', targetPx.y);
      }
      if (errorRef.current) {
        const d = Math.round(Math.sqrt((x - targetPx.x) ** 2 + (y - targetPx.y) ** 2));
        errorRef.current.textContent = `${d}px`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [phase, valTest.step, valTest.ptIndex]);

  /* ── PHASE: idle ─────────────────────────────────────────────────── */
  if (phase === 'idle') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-40" style={{ background: '#050510' }}>
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
            {['① Kameraya izin verin', '② Her noktaya bakın ve 5 kez tıklayın', '③ Kalibrasyon sonrası doğruluk testi yapılır'].map((s, i) => (
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

  /* ── PHASE: validating ───────────────────────────────────────────── */
  if (phase === 'validating') {

    /* Sonuç ekranı */
    if (valTest.step === 'results') {
      const res    = valTest.result;
      if (!res) return null;
      const aGrade = accuracyGrade(res.accuracy);
      const sGrade = stabilityGrade(res.stability);
      const isGood = res.accuracy >= 65;
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
            position: 'relative', zIndex: 10,
            width: 370, padding: '2.2rem',
            background: 'rgba(13,13,32,0.97)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(99,102,241,0.12)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '.92rem', fontWeight: 700, color: '#94a3b8', marginBottom: '1.4rem' }}>
              🎯 Kalibrasyon Doğruluk Testi
            </div>

            {/* Doğruluk çemberi */}
            <div style={{
              width: 110, height: 110, borderRadius: '50%', margin: '0 auto 1.1rem',
              background: `radial-gradient(circle, ${aGrade.color}18 0%, transparent 70%)`,
              border: `3px solid ${aGrade.color}`,
              boxShadow: `0 0 28px ${aGrade.color}44`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: aGrade.color, lineHeight: 1 }}>
                {res.accuracy}%
              </div>
              <div style={{ fontSize: '.68rem', color: aGrade.color, opacity: 0.85, marginTop: 2 }}>
                {aGrade.label}
              </div>
            </div>

            {/* İstatistikler */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1.2rem' }}>
              {[
                ['Ortalama Hata', `${res.meanError}px`, '#f8fafc'],
                ['Stabilite', `${res.stability}% — ${sGrade.label}`, sGrade.color],
                ['Güven Skoru', `${confidence}%`, confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444'],
              ].map(([label, value, color]) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '.45rem .75rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10,
                }}>
                  <span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{label}</span>
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Nokta bazlı gösterge */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              {VALIDATION_POINTS.map((pt, i) => {
                const color = ptAccuracyColor(res.pointStats[i]);
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 11, height: 11, borderRadius: '50%',
                      background: color, boxShadow: `0 0 6px ${color}88`,
                    }} />
                    <div style={{ fontSize: '.58rem', color: '#64748b' }}>
                      {pt.label.charAt(0)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Butonlar */}
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
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
                    fontWeight: 700, fontSize: '.8rem',
                  }}
                >
                  ↺ Yeniden Kalibre Et
                </button>
              )}
              <button
                onClick={finishValidation}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 12, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: '.8rem',
                  boxShadow: '0 2px 14px rgba(99,102,241,0.4)',
                }}
              >
                Devam Et →
              </button>
            </div>

            <p style={{ marginTop: '.85rem', fontSize: '.72rem', lineHeight: 1.5, color: isGood ? '#10b981' : '#94a3b8' }}>
              {isGood ? '✓ Kalibrasyon başarılı, devam edebilirsiniz.' : 'Doğruluk düşük — yeniden kalibre etmenizi öneririz.'}
            </p>
          </div>
        </div>
      );
    }

    /* Validation overlay (waiting / sampling) */
    const safeIdx   = Math.min(valTest.ptIndex, VALIDATION_POINTS.length - 1);
    const currentPt = VALIDATION_POINTS[safeIdx];
    const targetPx  = valPtToPx(currentPt);
    const sampling  = valTest.step === 'sampling';

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#06060f', zIndex: 40 }}>
        {/* Üst bar */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '.7rem 1.25rem',
          background: 'rgba(4,4,14,0.92)', backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontWeight: 700, fontSize: '.88rem' }}>🎯 Doğruluk Testi</span>
          <div style={{ display: 'flex', gap: '.45rem', alignItems: 'center' }}>
            {VALIDATION_POINTS.map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i < valTest.allStats.length
                  ? '#10b981'
                  : i === safeIdx
                    ? '#6366f1'
                    : 'rgba(255,255,255,0.14)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <span style={{ fontSize: '.78rem', color: '#64748b' }}>
            {safeIdx + 1} / {VALIDATION_POINTS.length}
          </span>
        </div>

        {/* SVG — gaze ↔ target çizgisi */}
        <svg style={{
          position: 'fixed', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 6,
        }}>
          <line
            ref={lineRef}
            x1="0" y1="0" x2="0" y2="0"
            stroke="rgba(99,102,241,0.35)"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        </svg>

        {/* Gaze göstergesi */}
        <div
          ref={gazeVisRef}
          style={{
            position: 'fixed', left: 0, top: 0, zIndex: 8,
            width: 12, height: 12, borderRadius: '50%',
            background: 'rgba(99,102,241,0.9)',
            boxShadow: '0 0 8px rgba(99,102,241,0.8)',
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        />

        {/* Validation hedef noktası */}
        <div style={{
          position: 'fixed',
          left: targetPx.x,
          top: targetPx.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
          pointerEvents: 'none',
        }}>
          <div style={{ position: 'relative', width: 70, height: 70,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Pulse halkası */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: `2px solid ${sampling ? '#10b981' : '#6366f1'}`,
              animation: 'valPulse 1.4s ease-out infinite',
            }} />
            {/* Ana çember */}
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: sampling ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.12)',
              border: `3px solid ${sampling ? '#10b981' : '#6366f1'}`,
              boxShadow: sampling ? '0 0 22px rgba(16,185,129,0.55)' : '0 0 22px rgba(99,102,241,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: sampling ? '#10b981' : '#818cf8',
              }} />
            </div>
          </div>

          {/* Etiket */}
          <div style={{
            padding: '.28rem .8rem', borderRadius: 100,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.09)',
            fontSize: '.76rem', fontWeight: 600, color: '#94a3b8',
            whiteSpace: 'nowrap',
          }}>
            {sampling ? '⚡ Ölçülüyor...' : `${currentPt.label}'a bakın`}
          </div>
        </div>

        {/* Alt: anlık hata */}
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '.4rem',
          padding: '.38rem .9rem', borderRadius: 100,
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.07)',
          fontSize: '.72rem', color: '#64748b',
          whiteSpace: 'nowrap',
        }}>
          Anlık hata:&nbsp;
          <span ref={errorRef} style={{ color: '#818cf8', fontWeight: 700 }}>—</span>
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

  /* ── PHASE: active (kalibrasyon noktaları) ───────────────────────── */
  return (
    <div className="fixed inset-0 z-40" style={{
      background: '#06060f', cursor: 'crosshair',
      backgroundImage: 'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
      backgroundSize: '50px 50px',
    }}>
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
            {active && !done && (
              <>
                <div style={{
                  position: 'absolute',
                  width: size * 2.4, height: size * 2.4,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(251,191,36,0.45)',
                  top: '50%', left: '50%',
                  animation: 'calRingPulse 1.6s ease-out infinite',
                  pointerEvents: 'none',
                }} />
                <ProgressRing
                  progress={(clicks / clicksPerPoint) * 100}
                  size={size}
                  stroke={3}
                  color="#fbbf24"
                />
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
