import React, { useEffect, useRef, useState, useCallback } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';
import GazeCursor from './GazeCursor';

const MAX_LINES = 1000;
const SIDEBAR_W = 230;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function sha256Hex(arrayBuffer) {
  const buf = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function ForensicMode({ faceDetected, onBack }) {
  const [files,      setFiles]      = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Güvenli kilit: yüz kaybolunca anında kilitler, yüz 800ms kesintisiz görününce açar.
  // Başlangıçta kilitli — yüz onaylanmadan içerik görünmez.
  const [isLocked,    setIsLocked]    = useState(true);
  const unlockTimerRef = useRef(null);

  useEffect(() => {
    if (!faceDetected) {
      // Yüz yok → anında kilitle, bekleme iptal
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
      setIsLocked(true);
    } else {
      // Yüz var → 800ms boyunca kesintisiz kalırsa aç
      if (!unlockTimerRef.current) {
        unlockTimerRef.current = setTimeout(() => {
          unlockTimerRef.current = null;
          setIsLocked(false);
        }, 800);
      }
    }
    return () => {};
  }, [faceDetected]);

  const isContentBlurred = isLocked;

  const fileIdRef     = useRef(0);
  const faceRef       = useRef(faceDetected);
  const lastTargetRef = useRef(null);

  // HUD DOM refs
  const hudStatusRef = useRef(null);
  const hudDotRef    = useRef(null);
  const hudNameRef   = useRef(null);
  const hudSizeRef   = useRef(null);
  const hudTypeRef   = useRef(null);
  const hudHashRef   = useRef(null);

  useEffect(() => { faceRef.current = faceDetected; }, [faceDetected]);

  // Yüklenen son dosyayı otomatik seç
  useEffect(() => {
    if (files.length === 0) { setSelectedId(null); return; }
    setSelectedId((prev) => (files.find((f) => f.id === prev) ? prev : files[files.length - 1].id));
  }, [files]);

  // ── HUD direct-DOM helpers ─────────────────────────────────────────────────
  const hudLock = (el) => {
    if (!hudStatusRef.current) return;
    hudStatusRef.current.textContent = '█ KİLİTLENDİ';
    hudStatusRef.current.style.color = '#00ff88';
    if (hudDotRef.current) {
      hudDotRef.current.style.background = '#00ff88';
      hudDotRef.current.style.boxShadow  = '0 0 8px #00ff88';
    }
    if (hudNameRef.current) hudNameRef.current.textContent = el.dataset.evidenceName || '—';
    if (hudSizeRef.current) hudSizeRef.current.textContent = el.dataset.evidenceSize || '—';
    if (hudTypeRef.current) hudTypeRef.current.textContent = el.dataset.evidenceType || '—';
    if (hudHashRef.current) {
      const h = el.dataset.evidenceHash || '—';
      hudHashRef.current.textContent = h;
      hudHashRef.current.title = h;
    }
  };

  const hudUnlock = () => {
    if (!hudStatusRef.current) return;
    hudStatusRef.current.textContent = '○ HEDEF ARANIYOR...';
    hudStatusRef.current.style.color = '#22d3ee';
    if (hudDotRef.current) {
      hudDotRef.current.style.background = '#22d3ee';
      hudDotRef.current.style.boxShadow  = '0 0 4px #22d3ee';
    }
    if (hudNameRef.current) hudNameRef.current.textContent = '—';
    if (hudSizeRef.current) hudSizeRef.current.textContent = '—';
    if (hudTypeRef.current) hudTypeRef.current.textContent = '—';
    if (hudHashRef.current) { hudHashRef.current.textContent = '—'; hudHashRef.current.title = ''; }
  };

  // ── Gaze → HUD RAF ─────────────────────────────────────────────────────────
  useEffect(() => {
    let rafId;
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!faceRef.current) {
        if (lastTargetRef.current) { lastTargetRef.current = null; hudUnlock(); }
        return;
      }
      const { x, y } = _gazePositionRef.current;
      const hit    = document.elementFromPoint(x, y);
      const target = hit?.closest?.('.evidence-item') ?? null;
      if (target !== lastTargetRef.current) {
        lastTargetRef.current = target;
        target ? hudLock(target) : hudUnlock();
      }
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dosya okuma — SHA-256 dahil ───────────────────────────────────────────
  const readFiles = useCallback((fileList) => {
    Array.from(fileList).forEach((file) => {
      const id = ++fileIdRef.current;
      const abReader = new FileReader();
      abReader.onload = async (abEv) => {
        const hash     = await sha256Hex(abEv.target.result);
        const size     = formatBytes(file.size);
        const fileType = file.type || 'application/octet-stream';

        if (file.type.startsWith('image/')) {
          const r = new FileReader();
          r.onload = (e) =>
            setFiles((prev) => [...prev, { id, type: 'image', name: file.name, data: e.target.result, size, fileType, hash }]);
          r.readAsDataURL(file);
        } else {
          const r = new FileReader();
          r.onload = (e) =>
            setFiles((prev) => [...prev, { id, type: 'text', name: file.name, data: e.target.result, size, fileType, hash }]);
          r.readAsText(file, 'UTF-8');
        }
      };
      abReader.readAsArrayBuffer(file);
    });
  }, []);

  const handleFileInput = (e) => readFiles(e.target.files);
  const handleDrop      = (e) => { e.preventDefault(); setIsDragOver(false); readFiles(e.dataTransfer.files); };
  const handleClear     = () => { setFiles([]); setSelectedId(null); };

  const selectedFile = files.find((f) => f.id === selectedId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050510' }}>
      <GazeCursor faceDetected={faceDetected} visible={true} />

      {/* ── Cyber HUD ── */}
      <div id="cyber-hud" style={{
        position: 'fixed', top: 58, right: 16, zIndex: 600,
        width: 340,
        background: 'rgba(0,8,4,0.93)',
        border: '1px solid rgba(0,255,136,0.22)',
        borderRadius: 8,
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '.78rem',
        boxShadow: '0 0 18px rgba(0,255,136,0.08), inset 0 0 30px rgba(0,255,136,0.03)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '.38rem .75rem',
          background: 'rgba(0,255,136,0.07)',
          borderBottom: '1px solid rgba(0,255,136,0.15)',
          display: 'flex', alignItems: 'center', gap: '.45rem',
        }}>
          <div ref={hudDotRef} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#22d3ee', boxShadow: '0 0 4px #22d3ee', flexShrink: 0,
          }} />
          <span style={{ color: '#00ff88', fontWeight: 700, letterSpacing: '.08em', fontSize: '.68rem' }}>
            ADLİ HUD / v1.0
          </span>
          <span style={{ marginLeft: 'auto', color: '#1f4e3a', fontSize: '.6rem' }}>CANLI</span>
        </div>
        <div style={{ padding: '.55rem .75rem', display: 'flex', flexDirection: 'column', gap: '.42rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ color: '#1a5c42', minWidth: 100 }}>HEDEF DURUMU</span>
            <span ref={hudStatusRef} style={{ color: '#22d3ee', fontWeight: 700, letterSpacing: '.04em' }}>
              ○ HEDEF ARANIYOR...
            </span>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,255,136,0.07)' }} />
          {[
            { label: 'DOSYA ADI', ref: hudNameRef },
            { label: 'BOYUT',     ref: hudSizeRef },
            { label: 'TÜR',       ref: hudTypeRef },
          ].map(({ label, ref }) => (
            <div key={label} style={{ display: 'flex', gap: '.5rem' }}>
              <span style={{ color: '#1a5c42', minWidth: 100, flexShrink: 0 }}>{label}</span>
              <span ref={ref} style={{ color: '#67e8a0', wordBreak: 'break-all' }}>—</span>
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem', marginTop: '.1rem' }}>
            <span style={{ color: '#1a5c42' }}>SHA-256</span>
            <span ref={hudHashRef} title="" style={{
              color: '#34d399', fontSize: '.72rem', letterSpacing: '.06em',
              background: 'rgba(0,255,136,0.04)', borderRadius: 4,
              padding: '.28rem .5rem', wordBreak: 'break-all', lineHeight: 1.6,
            }}>—</span>
          </div>
        </div>
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.35), transparent)',
          animation: 'hudScan 3s linear infinite',
        }} />
      </div>

      {/* ── Top bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        padding: '.65rem 1.4rem',
        background: 'rgba(4,4,14,0.92)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.8rem' }}>
          <button onClick={onBack} style={{
            padding: '.3rem .85rem', borderRadius: 9,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
            cursor: 'pointer', fontSize: '.74rem', fontWeight: 600,
          }}>← Geri</button>
          <span style={{ fontSize: '.85rem', fontWeight: 700 }}>
            🔍 Adli Bilişim Delil İnceleme Sistemi
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '.38rem',
            padding: '.26rem .72rem', borderRadius: 100,
            fontSize: '.72rem', fontWeight: 600,
            background: faceDetected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color:      faceDetected ? '#34d399'               : '#f87171',
            border: `1px solid ${faceDetected ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            {faceDetected ? 'İzleme Aktif' : '⛔ Güvenlik: Bulanıklaştırıldı'}
          </div>
          {files.length > 0 && (
            <button onClick={handleClear} style={{
              padding: '.26rem .7rem', borderRadius: 7, cursor: 'pointer',
              border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)',
              color: '#f87171', fontSize: '.72rem', fontWeight: 600,
            }}>✕ Temizle</button>
          )}
        </div>
      </div>

      {/* ── Ana layout: sidebar + görüntüleyici ── */}
      <div style={{ position: 'fixed', inset: '48px 0 0', display: 'flex' }}>

        {/* ── Sol sidebar ── */}
        <div style={{
          width: SIDEBAR_W, flexShrink: 0,
          background: 'rgba(4,4,14,0.97)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Upload alanı */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            style={{
              padding: '.75rem',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: isDragOver ? 'rgba(99,102,241,0.07)' : 'transparent',
              transition: 'background .2s',
              flexShrink: 0,
            }}
          >
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem',
              padding: '.55rem', borderRadius: 8, cursor: 'pointer',
              border: `1.5px dashed ${isDragOver ? '#6366f1' : 'rgba(255,255,255,0.12)'}`,
              background: 'rgba(99,102,241,0.06)',
              color: '#818cf8', fontSize: '.74rem', fontWeight: 600,
              transition: 'border-color .2s',
            }}>
              📁 Dosya Ekle
              <input
                type="file" multiple
                accept=".txt,.log,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </label>
            {files.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '.45rem', fontSize: '.65rem', color: '#475569' }}>
                {files.length} dosya yüklendi
              </div>
            )}
          </div>

          {/* Dosya listesi */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '.5rem' }}>
            {files.length === 0 ? (
              <div style={{ padding: '1.5rem .5rem', textAlign: 'center', color: '#334155', fontSize: '.7rem' }}>
                Henüz dosya yok
              </div>
            ) : (
              files.map((f) => {
                const active = f.id === selectedId;
                return (
                  <div
                    key={f.id}
                    onClick={() => setSelectedId(f.id)}
                    style={{
                      borderRadius: 7, marginBottom: '.35rem', cursor: 'pointer',
                      border: `1px solid ${active ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.05)'}`,
                      background: active ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                      overflow: 'hidden',
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    {f.type === 'image' ? (
                      <img
                        src={f.data} alt={f.name} draggable={false}
                        style={{ width: '100%', display: 'block', maxHeight: 110, objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{
                        padding: '.55rem .6rem',
                        fontSize: '1.5rem', textAlign: 'center',
                        background: 'rgba(6,182,212,0.06)',
                      }}>📄</div>
                    )}
                    <div style={{
                      padding: '.3rem .5rem',
                      fontSize: '.62rem', color: active ? '#a5b4fc' : '#475569',
                      fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{f.name}</div>
                    <div style={{
                      padding: '0 .5rem .3rem',
                      fontSize: '.58rem', color: '#334155', fontFamily: 'monospace',
                    }}>{f.size}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Büyük görüntüleyici ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {/* İçerik — blur burada uygulanır */}
          <div
            className={selectedFile ? 'evidence-item' : undefined}
            data-evidence-name={selectedFile?.name}
            data-evidence-size={selectedFile?.size}
            data-evidence-type={selectedFile?.fileType}
            data-evidence-hash={selectedFile?.hash}
            style={{
              position: 'absolute', inset: 0,
              filter: isContentBlurred ? 'blur(20px)' : 'none',
              transition: 'filter .15s ease',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {!selectedFile ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#1e293b', gap: '1rem',
              }}>
                <div style={{ fontSize: '3.5rem', opacity: .35 }}>🔍</div>
                <div style={{ fontSize: '.88rem' }}>Sol panelden incelemek istediğiniz dosyayı seçin</div>
              </div>
            ) : selectedFile.type === 'image' ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '1.5rem',
                background: 'rgba(0,0,0,0.25)',
              }}>
                <img
                  src={selectedFile.data}
                  alt={selectedFile.name}
                  draggable={false}
                  style={{
                    maxWidth: '100%', maxHeight: '100%',
                    objectFit: 'contain',
                    borderRadius: 8,
                    boxShadow: '0 0 40px rgba(0,0,0,0.6)',
                  }}
                />
                <div style={{
                  marginTop: '.75rem', fontSize: '.72rem',
                  color: '#475569', fontFamily: 'monospace',
                }}>
                  {selectedFile.name} · {selectedFile.size}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '.55rem 1rem',
                  background: 'rgba(6,182,212,0.07)',
                  borderBottom: '1px solid rgba(6,182,212,0.12)',
                  fontSize: '.74rem', fontWeight: 700, color: '#06b6d4',
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  📄 {selectedFile.name}
                  <span style={{ marginLeft: '1rem', fontWeight: 400, color: '#334155', fontSize: '.65rem' }}>
                    {selectedFile.data.split('\n').length} satır · {selectedFile.size}
                  </span>
                </div>
                <div style={{
                  flex: 1, overflowY: 'auto',
                  fontFamily: '"Courier New", Courier, monospace',
                  background: 'rgba(0,0,0,0.35)',
                }}>
                  {selectedFile.data.split('\n').slice(0, MAX_LINES).map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        borderBottom: '1px solid rgba(255,255,255,0.018)',
                      }}
                    >
                      <span style={{
                        minWidth: 52, padding: '.2rem .7rem',
                        fontSize: '.7rem', color: '#1e3a4a',
                        background: 'rgba(0,0,0,0.22)',
                        borderRight: '1px solid rgba(255,255,255,0.04)',
                        userSelect: 'none', textAlign: 'right', flexShrink: 0,
                      }}>{idx + 1}</span>
                      <span style={{
                        padding: '.2rem .9rem', fontSize: '.78rem', color: '#cbd5e1',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1,
                        lineHeight: 1.55,
                      }}>{line || ' '}</span>
                    </div>
                  ))}
                  {selectedFile.data.split('\n').length > MAX_LINES && (
                    <div style={{
                      padding: '.5rem 1rem', fontSize: '.72rem', color: '#f59e0b',
                      background: 'rgba(245,158,11,0.07)',
                      borderTop: '1px solid rgba(245,158,11,0.15)',
                    }}>
                      ⚠ İlk {MAX_LINES} satır gösteriliyor
                      ({selectedFile.data.split('\n').length - MAX_LINES} satır gizlendi)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Blur overlay mesajı */}
          {isContentBlurred && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(239,68,68,0.93)', color: '#fff',
                padding: '.9rem 2.2rem', borderRadius: 12, textAlign: 'center',
                fontWeight: 800, fontSize: '1rem',
                boxShadow: '0 0 32px rgba(239,68,68,0.5)',
              }}>
                ⛔ YETKİSİZ ERİŞİM ENGELLENDİ<br />
                <span style={{ fontSize: '.74rem', fontWeight: 400, opacity: .9 }}>
                  Göz algılaması bekleniyor...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes hudScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
