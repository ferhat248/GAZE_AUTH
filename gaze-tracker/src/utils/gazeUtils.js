export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

export const distance = (a, b) =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

// WebGazer demo ile birebir aynı 9 nokta grid: %10/%50/%90
// brownhci/WebGazer calibration.html'deki [[10,10],[10,50],...] ile eşleşir
export const CALIBRATION_POINTS = [
  { x: 0.10, y: 0.10 }, { x: 0.50, y: 0.10 }, { x: 0.90, y: 0.10 },
  { x: 0.10, y: 0.50 }, { x: 0.50, y: 0.50 }, { x: 0.90, y: 0.50 },
  { x: 0.10, y: 0.90 }, { x: 0.50, y: 0.90 }, { x: 0.90, y: 0.90 },
];

// Piksel koordinatına çevir — tam ekran, offset yok (WebGazer demo gibi)
export function ptToPx(pt) {
  return {
    x: pt.x * window.innerWidth,
    y: pt.y * window.innerHeight,
  };
}
