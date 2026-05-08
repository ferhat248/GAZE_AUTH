import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function BottomRight() {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-8" style={{ background: '#050510' }}>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 60% at 100% 100%, rgba(236,72,153,0.2) 0%, transparent 60%)',
      }} />
      <div className="relative z-10 text-center">
        <div className="text-7xl mb-4">⚙️</div>
        <h1 className="text-3xl font-black mb-3" style={{ color: '#f472b6' }}>Sağ Alt Bölgesi</h1>
        <p className="text-base mb-8" style={{ color: '#94a3b8' }}>
          Bu sayfayı sağ alt bölgeye bakarak açtınız.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-2xl font-bold text-white transition-transform hover:scale-[1.02]"
          style={{ background: 'linear-gradient(135deg,#ec4899,#f472b6)', boxShadow: '0 4px 20px rgba(236,72,153,0.4)' }}
        >
          ← Geri Dön
        </button>
      </div>
    </div>
  );
}
