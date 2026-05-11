import React, { useEffect, useState } from 'react';
import { useWebGazer }      from '../hooks/useWebGazer';
import { useCalibration }   from '../hooks/useCalibration';
import CalibrationScreen    from './CalibrationScreen';
import NavigationMode       from './NavigationMode';
import PhotoMode            from './PhotoMode';
import GazeCursor           from './GazeCursor';
import StatusPanel          from './StatusPanel';

export default function EyeTracker() {
  const wg = useWebGazer();
  const cal = useCalibration({
    recordCalibrationPoint: wg.recordCalibrationPoint,
    updateAccuracy:         wg.updateAccuracy,
  });

  // splash | loading | calibrating | mode-select | photo | tracking
  const [appPhase, setAppPhase] = useState('splash');

  const handleStart = async () => {
    setAppPhase('loading');
    await wg.init(cal.isCalibrated);
    if (cal.isCalibrated) {
      setAppPhase('mode-select');
    } else {
      cal.start();
      setAppPhase('calibrating');
    }
  };

  useEffect(() => {
    if (cal.phase === 'done') setAppPhase('mode-select');
  }, [cal.phase]);

  const handleRecalibrate = () => {
    wg.clearCalibrationData();
    cal.reset();
    cal.start();
    setAppPhase('calibrating');
  };

  /* ── Splash ── */
  if (appPhase === 'splash') {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#050510' }}>
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
          <div className="text-6xl mb-4" style={{ animation: 'pulseGlow 2s ease-in-out infinite' }}>👁️</div>
          <h1 className="text-3xl font-black mb-2" style={{
            background: 'linear-gradient(135deg, #818cf8, #a78bfa, #67e8f9)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            GazeTracker
          </h1>
          <p className="text-sm mb-8 leading-relaxed" style={{ color: '#94a3b8' }}>
            Göz hareketinizle ekranı kontrol edin.<br />
            WebGazer.js destekli gerçek zamanlı göz takibi.
          </p>
          <button
            onClick={handleStart}
            className="w-full py-3 rounded-2xl font-bold text-white text-base transition-transform hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 4px 20px rgba(99,102,241,0.45)' }}
          >
            Başlat →
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (appPhase === 'loading') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6" style={{ background: '#06060f' }}>
        <div className="text-5xl" style={{ animation: 'pulseGlow 1.2s ease-in-out infinite' }}>👁️</div>
        <div className="text-xl font-bold">WebGazer Başlatılıyor...</div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{
              background: ['#6366f1','#8b5cf6','#06b6d4'][i],
              animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
        {wg.status === 'error' && (
          <p className="text-sm text-red-400 max-w-sm text-center">
            Kamera erişimi reddedildi veya WebGazer yüklenemedi.<br />
            Sayfayı yenileyin ve kameraya izin verin.
          </p>
        )}
      </div>
    );
  }

  /* ── Calibrating ── */
  if (appPhase === 'calibrating') {
    return <CalibrationScreen cal={cal} />;
  }

  /* ── Mode Select ── */
  if (appPhase === 'mode-select') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-8" style={{ background: '#050510' }}>
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 110% 65% at 8% -12%, rgba(99,102,241,0.14) 0%, transparent 65%), radial-gradient(ellipse 80% 55% at 92% 112%, rgba(139,92,246,0.11) 0%, transparent 65%)',
        }} />

        <GazeCursor gazePoint={wg.gazePoint} faceDetected={wg.faceDetected} visible={true} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.4rem' }}>👁️</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginBottom: '.4rem' }}>
            Mod Seçin
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '.9rem' }}>Kalibrasyon tamamlandı — bir mod seçin</p>
        </div>

        <div style={{
          position: 'relative', zIndex: 10,
          display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center', padding: '0 1.5rem',
        }}>
          {/* Fotoğraf Modu */}
          <button
            onClick={() => setAppPhase('photo')}
            style={{
              width: 280, padding: '2rem', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10,10,24,0.92)', cursor: 'pointer', textAlign: 'center',
              backdropFilter: 'blur(14px)', transition: 'transform .2s, box-shadow .2s',
              boxShadow: '0 0 0 rgba(99,102,241,0)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.boxShadow = '0 0 40px rgba(99,102,241,0.22)';
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 0 rgba(99,102,241,0)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '.75rem' }}>📸</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '.5rem' }}>
              Fotoğraf Modu
            </div>
            <div style={{ fontSize: '.84rem', color: '#94a3b8', lineHeight: 1.65 }}>
              Ekrana fotoğraflar gelir, gözünüz takip edilir. Durdurunca nerelere baktığınız ısı haritasıyla gösterilir.
            </div>
          </button>

          {/* Navigasyon Modu */}
          <button
            onClick={() => setAppPhase('tracking')}
            style={{
              width: 280, padding: '2rem', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10,10,24,0.92)', cursor: 'pointer', textAlign: 'center',
              backdropFilter: 'blur(14px)', transition: 'transform .2s, box-shadow .2s',
              boxShadow: '0 0 0 rgba(139,92,246,0)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.boxShadow = '0 0 40px rgba(139,92,246,0.22)';
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 0 rgba(139,92,246,0)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '.75rem' }}>🎯</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '.5rem' }}>
              Navigasyon Modu
            </div>
            <div style={{ fontSize: '.84rem', color: '#94a3b8', lineHeight: 1.65 }}>
              Ekran 4 bölgeye ayrılır. Bir bölgeye 3 saniye bakarak YouTube, Google, GitHub veya ChatGPT&apos;ye gidebilirsiniz.
            </div>
          </button>
        </div>

        <button
          onClick={handleRecalibrate}
          style={{
            position: 'relative', zIndex: 10,
            padding: '.5rem 1.3rem', borderRadius: 9,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)', color: '#64748b',
            cursor: 'pointer', fontSize: '.8rem', fontWeight: 600,
          }}
        >
          ↺ Yeniden Kalibre Et
        </button>
      </div>
    );
  }

  /* ── Photo Mode ── */
  if (appPhase === 'photo') {
    return (
      <PhotoMode
        gazePoint={wg.gazePoint}
        faceDetected={wg.faceDetected}
        onBack={() => setAppPhase('mode-select')}
      />
    );
  }

  /* ── Tracking (Navigation) ── */
  return (
    <>
      <StatusPanel
        faceDetected={wg.faceDetected}
        fps={wg.fps}
        accuracy={wg.accuracy}
        onRecalibrate={handleRecalibrate}
      />
      <NavigationMode
        gazePoint={wg.gazePoint}
        faceDetected={wg.faceDetected}
        onBack={() => setAppPhase('mode-select')}
      />
      <GazeCursor
        gazePoint={wg.gazePoint}
        faceDetected={wg.faceDetected}
        visible={true}
      />
    </>
  );
}
