// Hareketli ortalama filtresi — jitter azaltır
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

// EMA filtresi — hızlı sakkadlara tepki verir, fiksasyonda pürüzsüz
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

// İki filtre birden — önce MA, sonra EMA
export class CompositeFilter {
  constructor() {
    this.ma  = new MovingAverageFilter(6);
    this.ema = new EMAFilter(0.25);
  }

  update(x, y) {
    const ma = this.ma.update(x, y);
    return this.ema.update(ma.x, ma.y);
  }

  reset() { this.ma.reset(); this.ema.reset(); }
}
