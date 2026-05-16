import React, { useEffect, useRef } from 'react';
import { useGazeAccuracyTest } from '../utils/gazeAccuracyTest';
import { VALIDATION_POINTS, valPtToPx, accuracyGrade, stabilityGrade } from '../utils/accuracyValidation';
import { _gazePositionRef } from '../hooks/useWebGazer';

const CENTER_INDEX = 4;
const DOT_LIFE     = 3000; // ms — validation scatter yaşam süresi
const DOT_RATE     = 40;   // ms — scatter örnekleme aralığı

// ── WebGazer demo birebir: 10px kırmızı prediction noktası ─────────────────
// webgazer.showPredictionPoints(true) davranışı — RAF ile native hız
function GazeDot() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let rafId;
    let shown = false;

    const loop = () => {
      const { x, y } = _gazePositionRef.current;
      if (x !== 0 || y !== 0) {
        // WebGazer GazeDot: left = x - 5, top = y - 5 (5 = yarıçap)
        el.style.transform = `translate3d(${x - 5}px,${y - 5}px,0)`;
        if (!shown) {
          el.style.opacity = '1';
          shown = true;
        }
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position:      'fixed',
        left:          0,
        top:           0,
        width:         10,
        height:        10,
        borderRadius:  '100%',
        backgroundColor: 'red', // WebGazer demo kırmızısı (#f00)
        pointerEvents: 'none',
        zIndex:        9999,
        willChange:    'transform',
        opacity:       0, // ilk prediction gelince görünür olur
      }}
    />
  );
}

// ── Kalibrasyon sırasında kamera önizlemesi (WebGazer demo davranışı) ───────
// DOM üzerinden WebGazer'ın video elementini köşede gösterir
function useCameraPreview(active, faceDetected) {
  useEffect(() => {
    if (!active) return;

    const SHOW_STYLE =
      'position:fixed!important;bottom:14px!important;right:14px!important;' +
      'width:136px!important;height:102px!important;' +
      'border-radius:8px!important;opacity:0.88!important;' +
      'pointer-events:none!important;z-index:6!important;display:block!important;' +
      'transform:scaleX(-1)!important;';   // ayna görünüm (selfie)

    const HIDE_STYLE =
      'position:fixed!important;top:-9999px!important;left:-9999px!important;' +
      'width:320px!important;height:240px!important;' +
      'pointer-events:none!important;z-index:-1!important;display:block!important;';

    const video = document.getElementById('webgazerVideoFeed');
    if (video) video.style.cssText = SHOW_STYLE;

    return () => {
      if (video) video.style.cssText = HIDE_STYLE;
    };
  }, [active]);

  // Yüz algılama durumuna göre çerçeve rengi
  useEffect(() => {
    if (!active) return;
    const video = document.getElementById('webgazerVideoFeed');
    if (!video) return;
    video.style.setProperty(
      'outline',
      faceDetected
        ? '2px solid rgba(34,197,94,0.75)'   // yeşil — yüz algılandı
        : '2px solid rgba(100,116,139,0.5)',  // gri — bekleniyor
      'important',
    );
  }, [active, faceDetected]);
}

// ────────────────────────────────────────────────────────────────────────────
export default function CalibrationScreen({ cal, faceDetected = false }) {
  const {
    phase, clickMap, centerVisible,
    points, clicksPerPoint, start, handleDotClick, finishValidation,
  } = cal;

  const valTest = useGazeAccuracyTest({ active: phase === 'validating' });

  // Kamera önizlemesi — sadece active calibration sırasında
  useCameraPreview(phase === 'active', faceDetected);

  // Validation canvas
  const canvasRef  = useRef(null);
  const dotPoolRef = useRef([]);

  // ── Validation scatter (WebGazer demo: mavi prediction scatter) ───────────
  useEffect(() => {
    if (phase !== 'validating' || valTest.step === 'results') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    dotPoolRef.current = [];
    let rafId, lastDotT = 0;

    const loop = (now) => {
      if (now - lastDotT >= DOT_RATE) {
        const { x, y } = _gazePositionRef.current;
        if (x !== 0 || y !== 0) dotPoolRef.current.push({ x, y, t: now });
        lastDotT = now;
      }

      dotPoolRef.current = dotPoolRef.current.filter(d => now - d.t < DOT_LIFE);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const dot of dotPoolRef.current) {
        const age   = (now - dot.t) / DOT_LIFE;
        const alpha = (1 - age) * 0.92;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${alpha})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [phase, valTest.step]);

  /* ── PHASE: idle ─────────────────────────────────────────────────────────── */
  if (phase === 'idle') {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-40" style={{ background: '#050510' }}>
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 110% 65% at 8% -12%, rgba(99,102,241,0.16) 0%, transparent 65%),' +
            'radial-gradient(ellipse 80% 55% at 92% 112%, rgba(139,92,246,0.13) 0%, transparent 65%)',
        }} />
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
            Her noktaya <strong className="text-white">bakarak</strong> üzerine{' '}
            <strong className="text-white">5 kez tıklayın</strong>.
          </p>
          <div className="flex flex-col gap-2 mb-8 text-left">
            {[
              '① Kameraya izin verin',
              '② 8 dış noktaya herhangi sırayla 5\'er kez tıklayın',
              '③ Merkez nokta son olarak belirir — onu da tıklayın',
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
      const aGrade = accuracyGrade(res.accuracy);
      const sGrade = stabilityGrade(res.stability);
      const isGood = res.accuracy >= 50;

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
                ['Ort. Hata',  `${res.meanError}px`,             '#f8fafc'],
                ['Stabilite', `${res.stability}% — ${sGrade.label}`, sGrade.color],
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
              <button
                onClick={() => { window.webgazer?.clearData(); localStorage.removeItem('webgazerGlobalData'); cal.reset(); cal.start(); }}
                style={{
                  flex: 1, padding: '.6rem', borderRadius: 12, cursor: 'pointer',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#f87171', fontWeight: 700, fontSize: '.8rem',
                }}
              >↺ Yeniden Kalibre Et</button>
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

    /* Validation — merkez nokta + scatter + live gaze dot */
    const targetPx = valPtToPx(VALIDATION_POINTS[0]);
    const sampling = valTest.step === 'sampling';

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#06060f', zIndex: 40, cursor: 'none' }}>

        {/* Canvas: mavi prediction scatter dots */}
        <canvas ref={canvasRef} style={{ position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 6 }} />

        {/* Kırmızı live prediction dot (WebGazer demo gibi) */}
        <GazeDot />

        {/* Üst talimat */}
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          color: '#f8fafc', fontSize: '0.82rem', textAlign: 'center',
          background: 'rgba(0,0,0,0.55)', padding: '0.4rem 1.1rem', borderRadius: 20,
          pointerEvents: 'none', zIndex: 50, whiteSpace: 'nowrap',
        }}>
          {sampling ? 'Ölçülüyor — mavi noktaları izleyin' : 'Merkezdeki noktaya bakın ve hareketsiz durun'}
        </div>

        {/* Merkez hedef nokta */}
        <div style={{
          position: 'fixed',
          left: targetPx.x, top: targetPx.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 10, pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute', width: 60, height: 60, borderRadius: '50%',
            border: '2px solid rgba(251,191,36,0.5)',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            animation: 'valPulse 1.6s ease-out infinite',
            pointerEvents: 'none',
          }} />
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            backgroundColor: 'rgb(222,240,10)',
            boxShadow: sampling
              ? '0 0 24px rgba(222,240,10,0.9),0 0 6px rgba(222,240,10,0.6)'
              : '0 0 12px rgba(222,240,10,0.55)',
            transition: 'box-shadow 0.3s',
          }} />
        </div>

        <style>{`
          @keyframes valPulse {
            0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.7; }
            100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
          }
        `}</style>
      </div>
    );
  }

  /* ── PHASE: active — WebGazer demo birebir kalibrasyon ──────────────────── */
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#06060f', cursor: 'crosshair' }}>

      {/* WebGazer demo: 10px kırmızı live prediction dot */}
      <GazeDot />

      {/* Talimat */}
      <div style={{
        position: 'fixed', top: '2%', left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.75)', fontSize: '0.8rem', textAlign: 'center',
        background: 'rgba(0,0,0,0.45)', padding: '0.35rem 1rem', borderRadius: 20,
        pointerEvents: 'none', zIndex: 50, whiteSpace: 'nowrap',
      }}>
        Her noktaya 5 kez tıklayın — sarıya dönünce tamamdır
      </div>

      {/* Kamera önizleme etiketi */}
      <div style={{
        position: 'fixed', bottom: 120, right: 14,
        color: 'rgba(255,255,255,0.45)', fontSize: '0.65rem',
        pointerEvents: 'none', zIndex: 7, textAlign: 'center', width: 136,
      }}>
        {faceDetected ? '● Yüz algılandı' : '○ Yüz aranıyor...'}
      </div>

      {/* WebGazer demo 9 kalibrasyon noktası */}
      {points.map((pt, i) => {
        const clicks   = clickMap[i] ?? 0;
        const done     = clicks >= clicksPerPoint;
        const isCenter = i === CENTER_INDEX;
        const visible  = !isCenter || centerVisible;

        if (!visible) return null;

        // WebGazer demo opacity formülü: 0.2 * clicks + 0.2
        const opacity = Math.min(1, 0.2 * clicks + 0.2);

        return (
          <button
            key={i}
            onClick={() => handleDotClick(i)}
            disabled={done}
            style={{
              position:        'fixed',
              left:            `${pt.x * 100}%`,
              top:             `${pt.y * 100}%`,
              transform:       'translate(-50%, -50%)',
              width:           20,
              height:          20,
              borderRadius:    '50%',
              backgroundColor: done ? 'rgb(222,240,10)' : 'rgb(248,83,83)',
              opacity,
              border:          'none',
              padding:         0,
              cursor:          done ? 'default' : 'pointer',
              transition:      'background-color 0.25s, opacity 0.1s',
              zIndex:          40,
            }}
          />
        );
      })}
    </div>
  );
}
