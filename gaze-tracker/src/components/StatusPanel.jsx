import React from 'react';

function Pill({ children, color = 'indigo' }) {
  const colors = {
    green:  'bg-green-500/10  border-green-500/25  text-green-400',
    red:    'bg-red-500/10    border-red-500/25    text-red-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300',
    yellow: 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${colors[color]}`}>
      {children}
    </div>
  );
}

function Dot({ color }) {
  const bg = {
    green:  'bg-green-400',
    red:    'bg-red-400',
    indigo: 'bg-indigo-400',
    yellow: 'bg-yellow-400',
  };
  return <span className={`w-1.5 h-1.5 rounded-full ${bg[color]} animate-pulse`} />;
}

export default function StatusPanel({ faceDetected, fps, accuracy, onRecalibrate }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-2 px-4 py-2"
      style={{
        background: 'rgba(5,5,16,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(12px)',
        height: 48,
      }}
    >
      {/* Face */}
      <Pill color={faceDetected ? 'green' : 'red'}>
        <Dot color={faceDetected ? 'green' : 'red'} />
        {faceDetected ? 'Yüz Algılandı' : 'Yüz Bulunamadı'}
      </Pill>

      {/* FPS */}
      <Pill color="indigo">
        <span style={{ fontFamily: 'monospace' }}>{fps} FPS</span>
      </Pill>

      {/* Accuracy */}
      <Pill color={accuracy >= 70 ? 'green' : accuracy >= 40 ? 'yellow' : 'red'}>
        Doğruluk: {accuracy}%
      </Pill>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs font-bold" style={{ color: '#475569', letterSpacing: '0.4px' }}>
          GazeTracker
        </span>
        <button
          onClick={onRecalibrate}
          className="text-xs px-3 py-1 rounded-lg font-semibold transition-all"
          style={{
            background: 'rgba(99,102,241,0.14)',
            color: '#818cf8',
            border: '1px solid rgba(99,102,241,0.28)',
          }}
        >
          ↺ Yeniden Kalibre Et
        </button>
      </div>
    </div>
  );
}
