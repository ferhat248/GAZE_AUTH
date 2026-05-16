import { useState, useEffect, useRef, useCallback } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';
import { VALIDATION_POINTS, valPtToPx } from './accuracyValidation';

const WAIT_MS   = 1500; // fixation bekleme süresi
const SAMPLE_MS = 5000; // WebGazer demo: ~5 saniyelik örnekleme

// WebGazer demo precision_calculation.js formülü:
// precision = 100 - (avgDistance / halfWindowHeight * 100)
function calcPrecision(samples, targetX, targetY) {
  if (!samples.length) return 0;
  const halfWindowHeight = window.innerHeight / 2;
  const avgDist = samples.reduce((sum, pt) => {
    return sum + Math.sqrt((pt.x - targetX) ** 2 + (pt.y - targetY) ** 2);
  }, 0) / samples.length;
  return Math.round(100 - (avgDist / halfWindowHeight * 100));
}

// Stability: standart sapma bazlı (düşük sapma = stabil)
function calcStability(samples, targetX, targetY) {
  if (samples.length < 2) return 0;
  const halfWindowHeight = window.innerHeight / 2;
  const avgDist = samples.reduce((s, p) =>
    s + Math.sqrt((p.x - targetX) ** 2 + (p.y - targetY) ** 2), 0) / samples.length;
  const errors = samples.map(p => Math.sqrt((p.x - targetX) ** 2 + (p.y - targetY) ** 2));
  const variance = errors.reduce((s, e) => s + (e - avgDist) ** 2, 0) / errors.length;
  const stdDev = Math.sqrt(variance);
  return Math.round(Math.max(0, 100 - (stdDev / halfWindowHeight * 100)));
}

// step: idle → waiting → sampling → results
export function useGazeAccuracyTest({ active }) {
  const [step,   setStep]   = useState('idle');
  const [result, setResult] = useState(null);

  const samplesRef = useRef([]);

  const reset = useCallback(() => {
    setStep('idle');
    setResult(null);
    samplesRef.current = [];
  }, []);

  // active değişince başlat ya da sıfırla
  useEffect(() => {
    if (!active) { reset(); return; }
    const t = setTimeout(() => setStep('waiting'), 400);
    return () => clearTimeout(t);
  }, [active, reset]);

  // waiting → sampling
  useEffect(() => {
    if (step !== 'waiting') return;
    samplesRef.current = [];
    const t = setTimeout(() => setStep('sampling'), WAIT_MS);
    return () => clearTimeout(t);
  }, [step]);

  // sampling: örnekler topla, sonra sonucu hesapla
  useEffect(() => {
    if (step !== 'sampling') return;

    const iv = setInterval(() => {
      const { x, y } = _gazePositionRef.current;
      samplesRef.current.push({ x, y });
    }, 50); // ~20 örnek/sn

    const t = setTimeout(() => {
      clearInterval(iv);

      const target   = valPtToPx(VALIDATION_POINTS[0]);
      const samples  = samplesRef.current;

      // WebGazer demo formülü — son 50 nokta (demo ile aynı)
      const last50   = samples.slice(-50);
      const accuracy  = calcPrecision(last50,  target.x, target.y);
      const stability = calcStability(last50,  target.x, target.y);

      const avgDist = last50.length
        ? last50.reduce((s, p) => s + Math.sqrt((p.x - target.x) ** 2 + (p.y - target.y) ** 2), 0) / last50.length
        : 999;

      setResult({
        accuracy,
        stability,
        meanError: Math.round(avgDist),
        pointStats: [{ count: last50.length }],
      });
      setStep('results');
    }, SAMPLE_MS);

    return () => { clearInterval(iv); clearTimeout(t); };
  }, [step]);

  return { step, ptIndex: 0, allStats: [], result, reset };
}
