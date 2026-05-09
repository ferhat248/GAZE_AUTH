export const VALIDATION_POINTS = [
  { x: 0.50, y: 0.50, label: 'Merkez' },
  { x: 0.50, y: 0.14, label: 'Üst'    },
  { x: 0.50, y: 0.86, label: 'Alt'    },
  { x: 0.14, y: 0.50, label: 'Sol'    },
  { x: 0.86, y: 0.50, label: 'Sağ'    },
];

export function valPtToPx(pt) {
  return {
    x: Math.round(pt.x * window.innerWidth),
    y: Math.round(pt.y * window.innerHeight),
  };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Medyandan uzak olan gürültülü örnekleri at
export function filterStableSamples(samples, threshold = 65) {
  if (samples.length < 4) return samples;
  const medX = median(samples.map(s => s.x));
  const medY = median(samples.map(s => s.y));
  return samples.filter(s =>
    Math.sqrt((s.x - medX) ** 2 + (s.y - medY) ** 2) < threshold
  );
}

// Tek nokta için hata istatistiği
export function computePointStats(targetPx, samples) {
  if (!samples.length) return { avgError: 999, stdDev: 0, count: 0 };
  const errors = samples.map(s =>
    Math.sqrt((s.x - targetPx.x) ** 2 + (s.y - targetPx.y) ** 2)
  );
  const avg      = errors.reduce((a, b) => a + b, 0) / errors.length;
  const variance = errors.reduce((a, e) => a + (e - avg) ** 2, 0) / errors.length;
  return { avgError: Math.round(avg), stdDev: Math.round(Math.sqrt(variance)), count: samples.length };
}

// Tüm noktalardan genel sonuç
export function computeOverallResult(allStats) {
  const valid = allStats.filter(s => s.count > 0);
  if (!valid.length) return null;
  const meanError  = valid.reduce((a, s) => a + s.avgError, 0) / valid.length;
  const meanStdDev = valid.reduce((a, s) => a + s.stdDev,  0) / valid.length;
  const diag = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
  const accuracy  = Math.max(0, Math.min(100, Math.round(100 - (meanError  / diag) * 350)));
  const stability = Math.max(0, Math.min(100, Math.round(100 - (meanStdDev / diag) * 550)));
  return { accuracy, stability, meanError: Math.round(meanError), pointStats: allStats };
}

export function accuracyGrade(score) {
  if (score >= 85) return { label: 'Mükemmel', color: '#10b981' };
  if (score >= 70) return { label: 'İyi',      color: '#6366f1' };
  if (score >= 50) return { label: 'Orta',     color: '#f59e0b' };
  return                  { label: 'Düşük',    color: '#ef4444' };
}

export function stabilityGrade(score) {
  if (score >= 85) return { label: 'Mükemmel', color: '#10b981' };
  if (score >= 70) return { label: 'İyi',      color: '#6366f1' };
  if (score >= 50) return { label: 'Orta',     color: '#f59e0b' };
  return                  { label: 'Düşük',    color: '#ef4444' };
}

// Tek nokta için renk (per-point dots'ta kullanılır)
export function ptAccuracyColor(stats) {
  if (!stats || stats.count === 0) return '#64748b';
  const diag  = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
  const score = Math.max(0, Math.min(100, Math.round(100 - (stats.avgError / diag) * 350)));
  return accuracyGrade(score).color;
}
