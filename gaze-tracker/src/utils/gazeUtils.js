export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// Ortalama hata cinsinden 0-100 doğruluk skoru
export function calcAccuracy(errors) {
  if (!errors.length) return 0;
  const diag = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
  const avg  = errors.reduce((a, b) => a + b, 0) / errors.length;
  return clamp(Math.round(100 - (avg / diag) * 100 * 4), 0, 100);
}

// 9 kalibrasyon noktası (ekran yüzdesi olarak)
export const CALIBRATION_POINTS = [
  { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 },
  { x: 0.1, y: 0.9 }, { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 },
];

// Piksel koordinatına çevir (üst bar yüksekliği çıkarılır)
export function ptToPx(pt, barH = 0) {
  return {
    x: pt.x * window.innerWidth,
    y: pt.y * (window.innerHeight - barH) + barH,
  };
}
