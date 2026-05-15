import React, { useEffect, useState } from 'react';
import { useWebGazer }      from '../hooks/useWebGazer';
import { useCalibration }   from '../hooks/useCalibration';
import CalibrationScreen    from './CalibrationScreen';
import NavigationMode       from './NavigationMode';
import PhotoMode            from './PhotoMode';
import GazeCursor           from './GazeCursor';
import GazePassword         from './GazePassword';
import StatusPanel          from './StatusPanel';

export default function EyeTracker() {
  const wg = useWebGazer();
  const cal = useCalibration({
    recordCalibrationPoint: wg.recordCalibrationPoint,
    updateAccuracy:         wg.updateAccuracy,
  });

  // loading | calibrating | mode-select | photo | tracking | forensic
  const [appPhase, setAppPhase] = useState('loading');

  // Site açılır açılmaz tracking başlar
  useEffect(() => {
    (async () => {
      const ok = await wg.init(cal.isCalibrated);
      if (!ok) return; // init başarısız — loading ekranı error mesajıyla kalır
      if (cal.isCalibrated) {
        setAppPhase('mode-select');
      } else {
        cal.start();
        setAppPhase('calibrating');
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cal.phase === 'done') setAppPhase('mode-select');
  }, [cal.phase]);

  const handleRecalibrate = () => {
    wg.clearCalibrationData();
    cal.reset();
    cal.start();
    setAppPhase('calibrating');
  };

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

          {/* Biyometrik Giriş */}
          <button
            onClick={() => setAppPhase('forensic')}
            style={{
              width: 280, padding: '2rem', borderRadius: 22, border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10,10,24,0.92)', cursor: 'pointer', textAlign: 'center',
              backdropFilter: 'blur(14px)', transition: 'transform .2s, box-shadow .2s',
              boxShadow: '0 0 0 rgba(99,102,241,0)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.boxShadow = '0 0 45px rgba(99,102,241,0.28)';
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 0 rgba(99,102,241,0)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '.75rem' }}>🔐</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', marginBottom: '.5rem' }}>
              Biyometrik Giriş
            </div>
            <div style={{ fontSize: '.84rem', color: '#94a3b8', lineHeight: 1.65 }}>
              Göz hareketiyle şifre oluştur ve kimliğini doğrula. Düğüm dizisine bakarak giriş yap.
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

  /* ── Gaze Password ── */
  if (appPhase === 'forensic') {
    return (
      <GazePassword
        gazePoint={wg.gazePoint}
        faceDetected={wg.faceDetected}
        onBack={() => setAppPhase('mode-select')}
      />
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
