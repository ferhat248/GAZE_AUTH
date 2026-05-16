import React from 'react';

const STATUS_CFG = {
  no_face: {
    icon: '👤',
    title: 'Yüz Algılanamadı',
    sub:   'Kameraya dönük bakın',
    color: '#f59e0b',
  },
  unauthorized: {
    icon: '🚫',
    title: 'Yetkisiz Erişim',
    sub:   'Kayıtlı yüz eşleşmedi',
    color: '#ef4444',
  },
  idle: {
    icon: '🔒',
    title: 'Biyometrik Doğrulama',
    sub:   'Sistem hazırlanıyor...',
    color: '#6366f1',
  },
};

export default function FaceAuthOverlay({ authStatus, hasEnrolled }) {
  if (!hasEnrolled || authStatus === 'authorized') return null;

  const cfg = STATUS_CFG[authStatus] ?? STATUS_CFG.no_face;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(2,4,16,0.92)',
        border: `1px solid ${cfg.color}44`,
        borderRadius: 16,
        padding: '1.5rem 2.4rem',
        textAlign: 'center',
        boxShadow: `0 0 56px ${cfg.color}28, inset 0 0 24px rgba(0,0,0,0.4)`,
        backdropFilter: 'blur(4px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.7rem',
        minWidth: 260,
        fontFamily: '"Courier New", Courier, monospace',
      }}>

        {/* Animated icon circle */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `${cfg.color}12`,
          border: `2px solid ${cfg.color}`,
          boxShadow: `0 0 24px ${cfg.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.6rem',
          animation: 'faPulse 2s ease-in-out infinite',
        }}>
          {cfg.icon}
        </div>

        {/* Status title */}
        <div style={{
          fontWeight: 800, fontSize: '1rem',
          color: cfg.color, letterSpacing: '.04em',
        }}>
          {cfg.title}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: '.74rem', color: '#94a3b8', lineHeight: 1.5, fontFamily: 'inherit' }}>
          {cfg.sub}
        </div>

        {/* Scanning bar */}
        <div style={{
          width: 180, height: 2,
          background: `${cfg.color}18`,
          borderRadius: 1, overflow: 'hidden',
          marginTop: '.1rem',
        }}>
          <div style={{
            height: '100%', width: 60,
            background: `${cfg.color}cc`,
            borderRadius: 1,
            animation: 'faScan 1.8s linear infinite',
          }} />
        </div>

        <div style={{
          fontSize: '.6rem', color: '#1e3a4a',
          letterSpacing: '.12em', fontWeight: 700,
          marginTop: '.1rem',
        }}>
          BİYOMETRİK GÜVENLİK AKTİF
        </div>
      </div>

      <style>{`
        @keyframes faPulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.8; transform:scale(1.04); }
        }
        @keyframes faScan {
          0%   { transform:translateX(-60px); }
          100% { transform:translateX(180px); }
        }
      `}</style>
    </div>
  );
}
