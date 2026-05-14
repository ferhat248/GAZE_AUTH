// SpikeRejector: imkansız büyük sıçramaları (600px+) reddeder.
// WebGazer bazen face-detection kaymasında 1000px+ spike üretir.
// Bu class o spike'ları yakalayıp önceki konumu döndürür.
export class SpikeRejector {
  constructor(maxDelta = 600) {
    this.maxDelta = maxDelta;
    this.px = null;
    this.py = null;
  }

  update(x, y) {
    if (this.px === null) { this.px = x; this.py = y; return { x, y }; }
    const dist = Math.sqrt((x - this.px) ** 2 + (y - this.py) ** 2);
    if (dist > this.maxDelta) return { x: this.px, y: this.py }; // spike: önceki konumu koru
    this.px = x; this.py = y;
    return { x, y };
  }

  reset() { this.px = null; this.py = null; }
  softReset(x, y) { this.px = x; this.py = y; }
}

export class MovingAverageFilter {
  constructor(windowSize = 2) {
    this.windowSize = windowSize;
    this.xBuf = [];
    this.yBuf = [];
  }

  update(x, y) {
    this.xBuf.push(x);
    this.yBuf.push(y);
    if (this.xBuf.length > this.windowSize) { this.xBuf.shift(); this.yBuf.shift(); }
    const n = this.xBuf.length;
    return {
      x: this.xBuf.reduce((a, b) => a + b, 0) / n,
      y: this.yBuf.reduce((a, b) => a + b, 0) / n,
    };
  }

  reset() { this.xBuf = []; this.yBuf = []; }
}

export class EMAFilter {
  constructor(alpha = 0.2) {
    this.alpha = alpha;
    this.x = null;
    this.y = null;
  }

  update(x, y) {
    if (this.x === null) { this.x = x; this.y = y; return { x, y }; }
    this.x += this.alpha * (x - this.x);
    this.y += this.alpha * (y - this.y);
    return { x: this.x, y: this.y };
  }

  reset() { this.x = null; this.y = null; }
}

// Hıza göre alpha ayarlayan EMA.
// minAlpha=0.12: fiksasyonda daha stabil (az titreme)
// maxAlpha=0.90: sakkadda hızlı tepki
// speedScale=40: orta hızlarda (20-40px) daha stabil kalır
export class AdaptiveEMAFilter {
  constructor(minAlpha = 0.12, maxAlpha = 0.90, speedScale = 40) {
    this.minAlpha   = minAlpha;
    this.maxAlpha   = maxAlpha;
    this.speedScale = speedScale;
    this.x = null;
    this.y = null;
  }

  update(x, y) {
    if (this.x === null) { this.x = x; this.y = y; return { x, y }; }
    const speed = Math.sqrt((x - this.x) ** 2 + (y - this.y) ** 2);
    const alpha = Math.min(this.maxAlpha, this.minAlpha + speed / this.speedScale);
    this.x += alpha * (x - this.x);
    this.y += alpha * (y - this.y);
    return { x: this.x, y: this.y };
  }

  reset() { this.x = null; this.y = null; }
}

// Pipeline: SpikeRejector → MA(2) → AdaptiveEMA
// SpikeRejector: >600px atlama → noise spike, önceki pozisyonu koru
// MA(2): tek-frame outlier'ları yumuşatır, lag minimumda
// AdaptiveEMA: fiksasyonda stabil, sakkadda hızlı
export class CompositeFilter {
  constructor() {
    this.spike = new SpikeRejector(600);
    this.ma    = new MovingAverageFilter(2);
    this.ema   = new AdaptiveEMAFilter(0.12, 0.90, 40);
  }

  update(x, y) {
    const sr = this.spike.update(x, y);
    const ma = this.ma.update(sr.x, sr.y);
    return this.ema.update(ma.x, ma.y);
  }

  reset() {
    this.spike.reset();
    this.ma.reset();
    this.ema.reset();
  }

  softReset(x, y) {
    this.spike.softReset(x, y);
    this.ma.reset();
    this.ema.x = x;
    this.ema.y = y;
  }
}
