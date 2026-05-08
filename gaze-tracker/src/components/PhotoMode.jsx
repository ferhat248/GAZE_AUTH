import React, { useEffect, useRef, useState } from 'react';
import GazeCursor from './GazeCursor';

const PHOTOS = [
  { seed: 42, w: 270, h: 185 }, { seed: 17, w: 225, h: 155 }, { seed: 88, w: 255, h: 175 },
  { seed: 55, w: 205, h: 145 }, { seed: 31, w: 295, h: 200 }, { seed: 76, w: 235, h: 160 },
  { seed: 13, w: 250, h: 170 }, { seed: 67, w: 220, h: 150 }, { seed: 94, w: 265, h: 180 },
];
const POS = [
  { lp: 14, tp: 8  }, { lp: 50, tp: 7  }, { lp: 82, tp: 8  },
  { lp: 11, tp: 42 }, { lp: 50, tp: 40 }, { lp: 85, tp: 41 },
  { lp: 14, tp: 73 }, { lp: 50, tp: 72 }, { lp: 83, tp: 71 },
];
const BAR_H = 48;

function getPhotoStyle(idx) {
  const W = window.innerWidth, H = window.innerHeight;
  const f = PHOTOS[idx], p = POS[idx];
  let left = (p.lp / 100) * W - f.w / 2;
  let top  = BAR_H + (p.tp / 100) * (H - BAR_H) - f.h / 2;
  left = Math.max(4, Math.min(W - f.w - 4, left));
  top  = Math.max(BAR_H + 4, Math.min(H - f.h - 4, top));
  return { left, top, width: f.w, height: f.h };
}

function calcCoverage(records) {
  if (!records.length) return '—';
  const CELL = 80;
  const cells = new Set();
  records.forEach(pt => cells.add(`${Math.floor(pt.x / CELL)},${Math.floor(pt.y / CELL)}`));
  const total = Math.ceil(window.innerWidth / CELL) * Math.ceil(window.innerHeight / CELL);
  return Math.round((cells.size / total) * 100) + '%';
}

/* Isı haritası: yoğun bölge kırmızı, seyrek sarı, boş şeffaf */
function drawHeatmap(canvas, records) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const SCALE = 0.3; // performans için küçültülmüş çözünürlük
  const SW = Math.ceil(W * SCALE);
  const SH = Math.ceil(H * SCALE);
  const R  = 70 * SCALE;

  // Adım 1: yoğunluk katmanı (beyaz blob'lar, lighter mod)
  const tmp = document.createElement('canvas');
  tmp.width  = SW;
  tmp.height = SH;
  const tc = tmp.getContext('2d');
  tc.globalCompositeOperation = 'lighter';

  records.forEach(pt => {
    const sx = pt.x * SCALE;
    const sy = pt.y * SCALE;
    const g  = tc.createRadialGradient(sx, sy, 0, sx, sy, R);
    g.addColorStop(0,    'rgba(255,255,255,0.55)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    tc.fillStyle = g;
    tc.beginPath();
    tc.arc(sx, sy, R, 0, Math.PI * 2);
    tc.fill();
  });

  // Adım 2: piksel renklendirme (şeffaf → mavi → sarı → kırmızı)
  const src = tc.getImageData(0, 0, SW, SH);
  const dst = tc.createImageData(SW, SH);

  for (let i = 0; i < src.data.length; i += 4) {
    const v = Math.min(src.data[i] / 255, 1); // yoğunluk 0-1
    if (v < 0.02) { dst.data[i + 3] = 0; continue; } // görünmez

    let r, g, b;
    if (v < 0.25) {
      // mavi → camgöbeği
      const t = v / 0.25;
      r = 0; g = Math.round(t * 128); b = 255;
    } else if (v < 0.50) {
      // camgöbeği → sarı
      const t = (v - 0.25) / 0.25;
      r = Math.round(t * 255); g = 200; b = Math.round((1 - t) * 255);
    } else if (v < 0.75) {
      // sarı → turuncu
      const t = (v - 0.50) / 0.25;
      r = 255; g = Math.round(200 - t * 120); b = 0;
    } else {
      // turuncu → kırmızı (en çok bakılan)
      const t = (v - 0.75) / 0.25;
      r = 255; g = Math.round(80 - t * 80); b = 0;
    }

    const a = Math.min(255, Math.round(v * 220 + 35));
    dst.data[i]     = r;
    dst.data[i + 1] = g;
    dst.data[i + 2] = b;
    dst.data[i + 3] = a;
  }

  tc.putImageData(dst, 0, 0);

  // Adım 3: tam ekrana büyüt
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled  = true;
  ctx.imageSmoothingQuality  = 'high';
  ctx.drawImage(tmp, 0, 0, W, H);
}

function PhotoGrid({ opacity = 1 }) {
  return (
    <>
      {PHOTOS.map((f, i) => {
        const { left, top, width, height } = getPhotoStyle(i);
        return (
          <img
            key={i}
            src={`https://picsum.photos/seed/${f.seed}/${f.w}/${f.h}`}
            width={width} height={height} alt=""
            style={{
              position: 'absolute', left, top,
              borderRadius: 12, objectFit: 'cover', opacity,
              boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
              border: '2px solid rgba(255,255,255,0.08)',
            }}
          />
        );
      })}
    </>
  );
}

export default function PhotoMode({ gazePoint, faceDetected, onBack }) {
  const [phase, setPhase]             = useState('recording');
  const [recordCount, setRecordCount] = useState(0);
  const [stats, setStats]             = useState(null);

  const gazeRef      = useRef(gazePoint);
  const recordsRef   = useRef([]);
  const startTimeRef = useRef(Date.now());
  const canvasRef    = useRef(null);

  useEffect(() => { gazeRef.current = gazePoint; }, [gazePoint]);

  /* Kayıt — her 100ms */
  useEffect(() => {
    if (phase !== 'recording') return;
    const iv = setInterval(() => {
      if (faceDetected) {
        const { x, y } = gazeRef.current;
        recordsRef.current.push({ x: Math.round(x), y: Math.round(y) });
        setRecordCount(recordsRef.current.length);
      }
    }, 100);
    return () => clearInterval(iv);
  }, [phase, faceDetected]);

  /* Isı haritasını canvas'a çiz (phase değişince) */
  useEffect(() => {
    if (phase !== 'heatmap' || !canvasRef.current) return;
    drawHeatmap(canvasRef.current, recordsRef.current);
  }, [phase]);

  const stopAndShowHeatmap = () => {
    setStats({
      nokta: recordsRef.current.length,
      sure:  Math.round((Date.now() - startTimeRef.current) / 1000),
      alan:  calcCoverage(recordsRef.current),
    });
    setPhase('heatmap');
  };

  const restart = () => {
    recordsRef.current   = [];
    startTimeRef.current = Date.now();
    setRecordCount(0);
    setStats(null);
    setPhase('recording');
  };

  /* ── ISI HARİTASI: TAM EKRAN ── */
  if (phase === 'heatmap') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050510' }}>

        {/* Arka plan fotoğraflar (soluk) */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <PhotoGrid opacity={0.15} />
        </div>

        {/* Isı haritası — tam ekran */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        />

        {/* Üst bar */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          padding: '.6rem 1.4rem',
          background: 'rgba(5,5,16,0.75)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
            🔥 Isı Haritası
          </div>
          <div style={{ display: 'flex', gap: '.6rem' }}>
            <button onClick={restart} style={{
              padding: '.3rem .85rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              fontWeight: 700, fontSize: '.75rem',
            }}>
              ↺ Tekrar Başlat
            </button>
            <button onClick={onBack} style={{
              padding: '.3rem .85rem', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)', fontWeight: 700, fontSize: '.75rem',
            }}>
              ← Geri
            </button>
          </div>
        </div>

        {/* Alt istatistik pill */}
        {stats && (
          <div style={{
            position: 'fixed', bottom: '4.2rem', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: '1rem', alignItems: 'center', zIndex: 200,
            background: 'rgba(5,5,16,0.8)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100,
            padding: '.5rem 1.5rem', fontSize: '.8rem', color: '#94a3b8', whiteSpace: 'nowrap',
          }}>
            <span>📍 <b style={{ color: '#818cf8' }}>{stats.nokta}</b> nokta</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span>⏱ <b style={{ color: '#818cf8' }}>{stats.sure}sn</b></span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
            <span>📊 <b style={{ color: '#818cf8' }}>{stats.alan}</b> kapsama</span>
          </div>
        )}

        {/* Renk lejantı */}
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: '.8rem', zIndex: 200,
          background: 'rgba(5,5,16,0.8)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 100, padding: '.4rem 1rem',
        }}>
          <span style={{ fontSize: '.7rem', color: '#94a3b8' }}>Az</span>
          <div style={{
            width: 140, height: 11, borderRadius: 100,
            background: 'linear-gradient(to right,#0050ff,#00c8ff,#ffdc00,#ff5000,#ff0000)',
          }} />
          <span style={{ fontSize: '.7rem', color: '#94a3b8' }}>Çok</span>
        </div>
      </div>
    );
  }

  /* ── KAYIT EKRANI ── */
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050510', cursor: 'none' }}>
      {/* Üst bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        padding: '.65rem 1.4rem',
        background: 'rgba(4,4,14,0.88)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{
            padding: '.3rem .85rem', borderRadius: 9,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
            cursor: 'pointer', fontSize: '.74rem', fontWeight: 600,
          }}>← Geri</button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.38rem', padding: '.26rem .72rem',
            borderRadius: 100, fontSize: '.74rem', fontWeight: 600,
            background: faceDetected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: faceDetected ? '#34d399' : '#f87171',
            border: `1px solid ${faceDetected ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
            {faceDetected ? 'Yüz Algılandı' : 'Yüz Bulunamadı'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.5rem',
            padding: '.4rem 1.1rem', borderRadius: 100, fontSize: '.8rem',
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444',
              animation: 'pulseDot 1s ease-in-out infinite' }} />
            Kayıt: {recordCount} nokta
          </div>
          <button onClick={stopAndShowHeatmap} style={{
            padding: '.32rem 1rem', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#ef4444,#f87171)', color: '#fff',
            fontWeight: 700, fontSize: '.74rem',
            boxShadow: '0 2px 12px rgba(239,68,68,0.35)',
          }}>
            ⬛ Durdur &amp; Isı Haritası
          </button>
        </div>
      </div>

      {/* Fotoğraflar */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <PhotoGrid />
      </div>

      {/* Göz imleci */}
      <GazeCursor gazePoint={gazePoint} faceDetected={faceDetected} visible={true} />

      <style>{`
        @keyframes pulseDot {
          0%,100% { opacity:.4; transform:scale(.8); }
          50%      { opacity:1;  transform:scale(1.2); }
        }
      `}</style>
    </div>
  );
}
