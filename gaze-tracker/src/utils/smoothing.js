export class MovingAverageFilter {
  constructor(windowSize = 8) {
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
    this.x = this.x + this.alpha * (x - this.x);
    this.y = this.y + this.alpha * (y - this.y);
    return { x: this.x, y: this.y };
  }

  reset() { this.x = null; this.y = null; }
}

// Hıza göre alpha ayarlayan EMA: sakkadda hızlı, fiksasyonda sakin
// minAlpha düşürüldü → fixation'da daha stabil (az jitter)
// maxAlpha yükseltildi → sakkadda daha hızlı tepki
// speedScale düşürüldü → alpha daha erken yükseliyor
export class AdaptiveEMAFilter {
  constructor(minAlpha = 0.12, maxAlpha = 0.85, speedScale = 40) {
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

// MA(3) → AdaptiveEMA: WebGazer demo benzeri smooth+responsive
export class CompositeFilter {
  constructor() {
    this.ma  = new MovingAverageFilter(3);
    this.ema = new AdaptiveEMAFilter(0.12, 0.85, 40);
  }

  update(x, y) {
    const ma = this.ma.update(x, y);
    return this.ema.update(ma.x, ma.y);
  }

  reset() { this.ma.reset(); this.ema.reset(); }

  // Face recovery sonrası: MA buffer'ı temizle, EMA'yı mevcut pozisyonda sabitle.
  // Stale verinin yeni predictionları kirletmesini önler.
  softReset(x, y) {
    this.ma.reset();
    this.ema.x = x;
    this.ema.y = y;
  }
}
