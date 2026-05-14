import React, { useEffect, useRef, useState, useCallback } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';
import GazeCursor from './GazeCursor';

const NODES = [
  { id: 0, symbol: '◈', color: '#00d4ff', glow: 'rgba(0,212,255,0.7)'   },
  { id: 1, symbol: '⬡', color: '#a855f7', glow: 'rgba(168,85,247,0.7)'  },
  { id: 2, symbol: '◆', color: '#f59e0b', glow: 'rgba(245,158,11,0.7)'  },
  { id: 3, symbol: '⬢', color: '#10b981', glow: 'rgba(16,185,129,0.7)'  },
  { id: 4, symbol: '◉', color: '#6366f1', glow: 'rgba(99,102,241,0.7)'  },
  { id: 5, symbol: '◐', color: '#ff3355', glow: 'rgba(255,51,85,0.7)'   },
  { id: 6, symbol: '◇', color: '#06b6d4', glow: 'rgba(6,182,212,0.7)'   },
  { id: 7, symbol: '◑', color: '#ec4899', glow: 'rgba(236,72,153,0.7)'  },
  { id: 8, symbol: '◎', color: '#84cc16', glow: 'rgba(132,204,22,0.7)'  },
];

const DWELL_MS = 1500;
const NODE_R   = 54;
const NODE_SZ  = 92;
const MIN_SEQ  = 3;
const MAX_SEQ  = 5;
const LS_KEY   = 'gazePasswordSeq';
const CIRC     = 2 * Math.PI * 40;

function nodeCenter(id) {
  const col = id % 3;
  const row = Math.floor(id / 3);
  const pH  = window.innerWidth * 0.26;
  const gW  = window.innerWidth  - pH * 2;
  const gT  = 88;
  const gH  = Math.max(window.innerHeight - 215 - gT, 180);
  return { x: pH + (col / 2) * gW, y: gT + (row / 2) * gH };
}

function HoloCorners({ color = '#6366f1' }) {
  const b    = `2px solid ${color}`;
  const base = { position: 'absolute', width: 13, height: 13 };
  return (
    <>
      <div style={{ ...base, top: 5, left: 5,    borderTop: b,    borderLeft: b   }} />
      <div style={{ ...base, top: 5, right: 5,   borderTop: b,    borderRight: b  }} />
      <div style={{ ...base, bottom: 5, left: 5,  borderBottom: b, borderLeft: b   }} />
      <div style={{ ...base, bottom: 5, right: 5, borderBottom: b, borderRight: b  }} />
    </>
  );
}

const BTN = {
  primary: {
    padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
    fontSize: '0.78rem', letterSpacing: 1, fontFamily: "'Courier New', monospace",
    border: '1px solid rgba(99,102,241,0.5)',
    background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))',
    color: '#818cf8',
  },
  secondary: {
    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
    fontSize: '0.75rem', letterSpacing: 1, fontFamily: "'Courier New', monospace",
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)', color: '#64748b',
  },
  danger: {
    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600,
    fontSize: '0.75rem', letterSpacing: 1, fontFamily: "'Courier New', monospace",
    border: '1px solid rgba(239,68,68,0.3)',
    background: 'rgba(239,68,68,0.08)', color: '#f87171',
  },
  success: {
    padding: '9px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
    fontSize: '0.78rem', letterSpacing: 1, fontFamily: "'Courier New', monospace",
    border: '1px solid rgba(16,185,129,0.4)',
    background: 'rgba(16,185,129,0.12)', color: '#34d399',
  },
};

export default function GazePassword({ gazePoint, faceDetected, onBack }) {
  const [phase,    setPhase]    = useState('menu');
  const [sequence, setSequence] = useState([]);
  const [saved,    setSaved]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
  });

  const phaseRef = useRef('menu');
  const seqRef   = useRef([]);
  const savedRef = useRef(saved);

  const dwellRef    = useRef({ nodeId: null, elapsed: 0 });
  const cooldownRef = useRef({});

  /* ── Auto-transitions ── */
  useEffect(() => {
    if (phase === 'saved') {
      const t = setTimeout(() => { setPhase('menu'); phaseRef.current = 'menu'; }, 2200);
      return () => clearTimeout(t);
    }
    if (phase === 'denied') {
      const t = setTimeout(() => {
        seqRef.current = [];
        setSequence([]);
        dwellRef.current = { nodeId: null, elapsed: 0 };
        cooldownRef.current = {};
        setPhase('authenticating');
        phaseRef.current = 'authenticating';
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  /* ── RAF gaze loop ── */
  useEffect(() => {
    if (phase !== 'creating' && phase !== 'authenticating') return;

    let rafId;
    let prev = performance.now();

    const loop = (now) => {
      const dt = Math.min(now - prev, 80);
      prev = now;
      const { x, y } = _gazePositionRef.current;

      Object.keys(cooldownRef.current).forEach(k => {
        cooldownRef.current[k] -= dt;
        if (cooldownRef.current[k] <= 0) delete cooldownRef.current[k];
      });

      let hovered = null;
      for (const nd of NODES) {
        const c = nodeCenter(nd.id);
        if (Math.hypot(x - c.x, y - c.y) < NODE_R && !cooldownRef.current[nd.id]) {
          hovered = nd.id;
          break;
        }
      }

      const dw = dwellRef.current;
      if (hovered !== dw.nodeId) {
        if (dw.nodeId !== null) {
          const r = document.getElementById(`gpr-${dw.nodeId}`);
          if (r) r.style.strokeDashoffset = String(CIRC);
        }
        dwellRef.current = { nodeId: hovered, elapsed: 0 };
      } else if (hovered !== null) {
        dw.elapsed += dt;
        const pct = Math.min(dw.elapsed / DWELL_MS, 1);
        const r = document.getElementById(`gpr-${hovered}`);
        if (r) r.style.strokeDashoffset = String(CIRC * (1 - pct));

        if (dw.elapsed >= DWELL_MS) {
          if (r) r.style.strokeDashoffset = String(CIRC);
          cooldownRef.current[hovered] = 700;
          dwellRef.current = { nodeId: null, elapsed: 0 };

          const cp = phaseRef.current;
          const cs = seqRef.current;
          const sv = savedRef.current;

          if (cp === 'creating') {
            if (!cs.includes(hovered) && cs.length < MAX_SEQ) {
              const ns = [...cs, hovered];
              seqRef.current = ns;
              setSequence(ns);
            }
          } else if (cp === 'authenticating' && sv) {
            const expected = sv[cs.length];
            const ns = [...cs, hovered];
            seqRef.current = ns;
            setSequence(ns);
            if (hovered !== expected) {
              phaseRef.current = 'denied';
              setPhase('denied');
            } else if (ns.length === sv.length) {
              phaseRef.current = 'granted';
              setPhase('granted');
            }
          }
        }
      }

      for (const nd of NODES) {
        const el = document.getElementById(`gpn-${nd.id}`);
        if (!el) continue;
        const isSel = seqRef.current.includes(nd.id);
        const isHov = nd.id === dwellRef.current.nodeId;
        const pct   = isHov ? Math.min(dwellRef.current.elapsed / DWELL_MS, 1) : 0;
        if (isSel) {
          el.style.boxShadow   = `0 0 28px ${nd.glow}, 0 0 56px ${nd.glow.replace('0.7', '0.25')}`;
          el.style.borderColor = nd.color;
          el.style.background  = `radial-gradient(circle, ${nd.color}28 0%, ${nd.color}0a 100%)`;
        } else if (isHov) {
          const i = (0.35 + pct * 0.5).toFixed(2);
          el.style.boxShadow   = `0 0 ${14 + pct * 30}px ${nd.glow.replace('0.7', i)}`;
          el.style.borderColor = nd.color + 'aa';
          el.style.background  = `radial-gradient(circle, ${nd.color}18 0%, ${nd.color}06 100%)`;
        } else {
          el.style.boxShadow   = `0 0 6px ${nd.glow.replace('0.7', '0.12')}`;
          el.style.borderColor = nd.color + '30';
          el.style.background  = `radial-gradient(circle, ${nd.color}0c 0%, transparent 100%)`;
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      for (const nd of NODES) {
        const r = document.getElementById(`gpr-${nd.id}`);
        if (r) r.style.strokeDashoffset = String(CIRC);
      }
    };
  }, [phase]);

  /* ── Actions ── */
  const startCreate = useCallback(() => {
    seqRef.current = []; setSequence([]);
    dwellRef.current = { nodeId: null, elapsed: 0 }; cooldownRef.current = {};
    phaseRef.current = 'creating'; setPhase('creating');
  }, []);

  const startAuth = useCallback(() => {
    seqRef.current = []; setSequence([]);
    dwellRef.current = { nodeId: null, elapsed: 0 }; cooldownRef.current = {};
    phaseRef.current = 'authenticating'; setPhase('authenticating');
  }, []);

  const savePassword = useCallback(() => {
    if (seqRef.current.length < MIN_SEQ) return;
    const s = seqRef.current;
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    setSaved(s); savedRef.current = s;
    phaseRef.current = 'saved'; setPhase('saved');
  }, []);

  const deletePassword = useCallback(() => {
    localStorage.removeItem(LS_KEY);
    setSaved(null); savedRef.current = null;
    seqRef.current = []; setSequence([]);
    dwellRef.current = { nodeId: null, elapsed: 0 }; cooldownRef.current = {};
    phaseRef.current = 'menu'; setPhase('menu');
  }, []);

  const goMenu = useCallback(() => {
    seqRef.current = []; setSequence([]);
    dwellRef.current = { nodeId: null, elapsed: 0 }; cooldownRef.current = {};
    phaseRef.current = 'menu'; setPhase('menu');
  }, []);

  const resetSeq = useCallback(() => {
    seqRef.current = []; setSequence([]);
    dwellRef.current = { nodeId: null, elapsed: 0 }; cooldownRef.current = {};
    for (const nd of NODES) {
      const r = document.getElementById(`gpr-${nd.id}`);
      if (r) r.style.strokeDashoffset = String(CIRC);
    }
  }, []);

  /* ── Connection lines ── */
  const connLines = sequence.length >= 2
    ? sequence.slice(1).map((toId, i) => {
        const a = nodeCenter(sequence[i]);
        const b = nodeCenter(toId);
        return { key: `${sequence[i]}-${toId}-${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: NODES[toId].color };
      })
    : [];

  /* ── Overlay helper ── */
  const Overlay = ({ borderColor, glowColor, icon, title, subtitle, children }) => (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(3,3,16,0.88)',
    }}>
      <div style={{
        position: 'relative', textAlign: 'center',
        background: 'rgba(5,5,22,0.97)',
        border: `1px solid ${borderColor}`,
        borderRadius: 22, padding: '44px 64px',
        backdropFilter: 'blur(18px)',
        boxShadow: `0 0 80px ${glowColor}`,
        animation: 'fadeIn 0.3s ease-out',
      }}>
        <HoloCorners color={borderColor.replace('0.35', '1')} />
        <div style={{ fontSize: '3.5rem', marginBottom: 16,
          filter: `drop-shadow(0 0 20px ${glowColor})` }}>{icon}</div>
        <div style={{
          fontSize: '1.5rem', fontWeight: 800, letterSpacing: 4,
          color: borderColor.replace('0.35', '1'), marginBottom: 8,
          textShadow: `0 0 20px ${glowColor}`,
        }}>{title}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b', letterSpacing: 2, marginBottom: 24 }}>{subtitle}</div>
        {children}
      </div>
    </div>
  );

  /* ── Render ── */
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#030310',
      overflow: 'hidden',
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 60% at 50% 50%, rgba(99,102,241,0.07) 0%, transparent 70%), radial-gradient(ellipse 50% 35% at 20% 25%, rgba(0,212,255,0.04) 0%, transparent 55%), radial-gradient(ellipse 50% 35% at 80% 75%, rgba(168,85,247,0.04) 0%, transparent 55%)',
      }} />
      <div className="scan-line" />

      {/* Header */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 22px',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
        background: 'rgba(3,3,16,0.93)',
        backdropFilter: 'blur(14px)',
        zIndex: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.15rem' }}>👁</span>
          <span style={{ color: '#818cf8', fontWeight: 800, fontSize: '0.88rem', letterSpacing: 3 }}>
            GÖZ ŞİFRE SİSTEMİ
          </span>
          <div style={{
            padding: '2px 7px', borderRadius: 4,
            border: '1px solid rgba(99,102,241,0.3)',
            fontSize: '0.58rem', color: '#6366f1', letterSpacing: 2,
          }}>BİYOMETRİK</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: faceDetected ? '#10b981' : '#ef4444',
              boxShadow: faceDetected ? '0 0 6px #10b981' : '0 0 6px #ef4444',
            }} />
            <span style={{ fontSize: '0.68rem', color: faceDetected ? '#10b981' : '#ef4444', letterSpacing: 1 }}>
              {faceDetected ? 'YÜZ ALGILANDI' : 'YÜZ YOK'}
            </span>
          </div>
          <button onClick={onBack} style={BTN.secondary}>← Geri</button>
        </div>
      </div>

      {/* Node Grid */}
      {NODES.map(nd => {
        const c      = nodeCenter(nd.id);
        const selIdx = sequence.indexOf(nd.id);
        const isSel  = selIdx !== -1;
        return (
          <div
            key={nd.id}
            id={`gpn-${nd.id}`}
            style={{
              position: 'fixed',
              left: c.x - NODE_SZ / 2,
              top:  c.y - NODE_SZ / 2,
              width: NODE_SZ, height: NODE_SZ,
              borderRadius: '50%',
              border: `2px solid ${nd.color}30`,
              background: `radial-gradient(circle, ${nd.color}0c 0%, transparent 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10,
              boxShadow: `0 0 6px ${nd.glow.replace('0.7', '0.12')}`,
            }}
          >
            {/* Outer orbit ring */}
            <div style={{
              position: 'absolute', inset: -14, borderRadius: '50%',
              border: `1px solid ${nd.color}18`, pointerEvents: 'none',
            }} />
            {/* SVG dwell ring */}
            <svg
              width={NODE_SZ + 20} height={NODE_SZ + 20}
              style={{ position: 'absolute', top: -10, left: -10, pointerEvents: 'none' }}
            >
              <circle
                cx={(NODE_SZ + 20) / 2} cy={(NODE_SZ + 20) / 2}
                r={40} fill="none" stroke={nd.color + '20'} strokeWidth="3"
              />
              <circle
                id={`gpr-${nd.id}`}
                cx={(NODE_SZ + 20) / 2} cy={(NODE_SZ + 20) / 2}
                r={40} fill="none" stroke={nd.color} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={CIRC} strokeDashoffset={CIRC}
                transform={`rotate(-90 ${(NODE_SZ + 20) / 2} ${(NODE_SZ + 20) / 2})`}
              />
            </svg>
            {/* Symbol */}
            <span style={{
              fontSize: '2rem', color: nd.color, lineHeight: 1,
              textShadow: `0 0 12px ${nd.glow}`,
              position: 'relative', zIndex: 1,
            }}>
              {nd.symbol}
            </span>
            {/* Selection badge */}
            {isSel && (
              <div style={{
                position: 'absolute', top: -10, right: -10,
                width: 24, height: 24, borderRadius: '50%',
                background: nd.color, color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.68rem', fontWeight: 900,
                boxShadow: `0 0 12px ${nd.glow}`,
                zIndex: 3,
              }}>
                {selIdx + 1}
              </div>
            )}
          </div>
        );
      })}

      {/* Connection lines SVG */}
      <svg
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 8 }}
        width="100%" height="100%"
      >
        {connLines.map(l => (
          <React.Fragment key={l.key}>
            <line
              x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={l.color} strokeWidth="1.5"
              strokeDasharray="7 4" strokeOpacity="0.45"
            />
            <circle cx={l.x2} cy={l.y2} r="3" fill={l.color} opacity="0.55" />
          </React.Fragment>
        ))}
      </svg>

      {/* ── Menu panel ── */}
      {phase === 'menu' && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, minWidth: 380,
        }}>
          <div style={{
            position: 'relative',
            background: 'rgba(5,5,22,0.95)',
            border: '1px solid rgba(99,102,241,0.22)',
            borderRadius: 18, padding: '26px 38px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 40px rgba(99,102,241,0.08)',
            textAlign: 'center',
          }}>
            <HoloCorners color="#6366f1" />
            <div style={{ fontSize: '0.6rem', color: '#6366f1', letterSpacing: 3, marginBottom: 14 }}>
              BİYOMETRİK DOĞRULAMA SİSTEMİ
            </div>
            {saved ? (
              <>
                <div style={{ color: '#34d399', fontSize: '0.78rem', marginBottom: 6 }}>
                  ✓ {saved.length} düğümlü şifre kayıtlı
                </div>
                <div style={{ color: '#475569', fontSize: '0.7rem', marginBottom: 20 }}>
                  Gözlerinizle {saved.length} düğümü sırayla seçin
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button onClick={startAuth}      style={BTN.primary}>Kimlik Doğrula</button>
                  <button onClick={startCreate}    style={BTN.secondary}>Şifreyi Değiştir</button>
                  <button onClick={deletePassword} style={BTN.danger}>Sil</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ color: '#475569', fontSize: '0.78rem', marginBottom: 6 }}>
                  Henüz kayıtlı şifre yok.
                </div>
                <div style={{ color: '#334155', fontSize: '0.7rem', marginBottom: 20 }}>
                  Düğümlere {(DWELL_MS / 1000).toFixed(1)}s bakarak şifre oluşturun.
                </div>
                <button onClick={startCreate} style={BTN.primary}>+ Yeni Şifre Oluştur</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Creating panel ── */}
      {phase === 'creating' && (
        <div style={{
          position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, minWidth: 500,
        }}>
          <div style={{
            position: 'relative',
            background: 'rgba(5,5,22,0.95)',
            border: '1px solid rgba(99,102,241,0.22)',
            borderRadius: 18, padding: '20px 32px',
            backdropFilter: 'blur(16px)',
            textAlign: 'center',
          }}>
            <HoloCorners color="#6366f1" />
            <div style={{ fontSize: '0.6rem', color: '#6366f1', letterSpacing: 3, marginBottom: 10 }}>
              ŞİFRE OLUŞTURMA MODU
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 14 }}>
              {MIN_SEQ}–{MAX_SEQ} düğümü {(DWELL_MS / 1000).toFixed(1)} saniye bakarak sırayla seçin
            </div>
            {/* Sequence slots */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
              {Array.from({ length: MAX_SEQ }).map((_, i) => {
                const nid = sequence[i];
                const nd  = nid !== undefined ? NODES[nid] : null;
                return (
                  <div key={i} style={{
                    width: 44, height: 44, borderRadius: 10,
                    border: `1.5px solid ${nd ? nd.color : 'rgba(255,255,255,0.08)'}`,
                    background: nd ? `${nd.color}1a` : 'rgba(255,255,255,0.02)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem', color: nd ? nd.color : 'rgba(255,255,255,0.15)',
                    boxShadow: nd ? `0 0 10px ${nd.glow.replace('0.7', '0.25')}` : 'none',
                  }}>
                    {nd ? nd.symbol : (i < MIN_SEQ ? '·' : '○')}
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: 16 }}>
              {sequence.length < MIN_SEQ
                ? `${MIN_SEQ - sequence.length} düğüm daha seçin`
                : `${sequence.length} düğüm seçildi — kaydetmeye hazır`}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={savePassword}
                disabled={sequence.length < MIN_SEQ}
                style={sequence.length >= MIN_SEQ ? BTN.success : { ...BTN.secondary, opacity: 0.38, cursor: 'not-allowed' }}
              >
                Kaydet ({sequence.length}/{MIN_SEQ}+)
              </button>
              <button onClick={resetSeq} style={BTN.secondary}>Sıfırla</button>
              <button onClick={goMenu}   style={BTN.secondary}>İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Authenticating panel ── */}
      {phase === 'authenticating' && (
        <div style={{
          position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          zIndex: 20, minWidth: 420,
        }}>
          <div style={{
            position: 'relative',
            background: 'rgba(5,5,22,0.95)',
            border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 18, padding: '20px 32px',
            backdropFilter: 'blur(16px)',
            textAlign: 'center',
          }}>
            <HoloCorners color="#00d4ff" />
            <div style={{ fontSize: '0.6rem', color: '#00d4ff', letterSpacing: 3, marginBottom: 10 }}>
              KİMLİK DOĞRULAMA
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: 16 }}>
              Gözlerinizle şifrenizi girin
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
              {saved && Array.from({ length: saved.length }).map((_, i) => (
                <div key={i} style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${i < sequence.length ? '#00d4ff' : 'rgba(0,212,255,0.2)'}`,
                  background: i < sequence.length ? 'rgba(0,212,255,0.28)' : 'transparent',
                  boxShadow: i < sequence.length ? '0 0 8px rgba(0,212,255,0.5)' : 'none',
                  transition: 'all 0.2s ease',
                }} />
              ))}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: 16 }}>
              {sequence.length} / {saved?.length ?? '?'} girildi
            </div>
            <button onClick={goMenu} style={BTN.secondary}>İptal</button>
          </div>
        </div>
      )}

      {/* ── Granted overlay ── */}
      {phase === 'granted' && (
        <Overlay
          borderColor="rgba(16,185,129,0.35)"
          glowColor="rgba(16,185,129,0.15)"
          icon="✓"
          title="ERİŞİM SAĞLANDI"
          subtitle="KİMLİK DOĞRULAMA BAŞARILI"
        >
          <button onClick={goMenu} style={BTN.success}>← Menüye Dön</button>
        </Overlay>
      )}

      {/* ── Denied overlay ── */}
      {phase === 'denied' && (
        <Overlay
          borderColor="rgba(239,68,68,0.35)"
          glowColor="rgba(239,68,68,0.12)"
          icon="✕"
          title="ERİŞİM REDDEDİLDİ"
          subtitle="YANLIŞ ŞİFRE"
        >
          <div style={{ fontSize: '0.68rem', color: '#475569' }}>Yeniden deneniyor...</div>
        </Overlay>
      )}

      {/* ── Saved overlay ── */}
      {phase === 'saved' && (
        <Overlay
          borderColor="rgba(99,102,241,0.35)"
          glowColor="rgba(99,102,241,0.12)"
          icon="🔐"
          title="ŞİFRE KAYDEDİLDİ"
          subtitle="MENÜYE DÖNÜLÜYOR..."
        />
      )}

      <GazeCursor gazePoint={gazePoint} faceDetected={faceDetected} visible={true} />
    </div>
  );
}
