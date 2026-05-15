import { useState, useEffect, useRef, useCallback } from 'react';
import { _gazePositionRef } from '../hooks/useWebGazer';
import {
  VALIDATION_POINTS, valPtToPx,
  filterStableSamples, computePointStats, computeOverallResult,
} from './accuracyValidation';

const WAIT_MS   = 1500;   // fixation settle time before sampling begins
const SAMPLE_MS = 3000;   // longer window for single-point: ~60 samples at 50ms interval

// step: idle → waiting → sampling → (next point) → results
export function useGazeAccuracyTest({ active }) {
  const [step,     setStep]     = useState('idle');
  const [ptIndex,  setPtIndex]  = useState(0);
  const [allStats, setAllStats] = useState([]);
  const [result,   setResult]   = useState(null);

  const samplesRef  = useRef([]);
  const statsAccRef = useRef([]);   // closure stale sorunu olmadan akümüle eder

  const reset = useCallback(() => {
    setStep('idle');
    setPtIndex(0);
    setAllStats([]);
    setResult(null);
    samplesRef.current  = [];
    statsAccRef.current = [];
  }, []);

  // active değişince başlat ya da sıfırla
  useEffect(() => {
    if (!active) { reset(); return; }
    statsAccRef.current = [];
    const t = setTimeout(() => { setPtIndex(0); setStep('waiting'); }, 500);
    return () => clearTimeout(t);
  }, [active, reset]);

  // waiting → sampling geçişi
  useEffect(() => {
    if (step !== 'waiting') return;
    const t = setTimeout(() => { samplesRef.current = []; setStep('sampling'); }, WAIT_MS);
    return () => clearTimeout(t);
  }, [step, ptIndex]);

  // sampling: örnekleri topla, sonra sonraki noktaya geç
  useEffect(() => {
    if (step !== 'sampling') return;

    const iv = setInterval(() => {
      const { x, y } = _gazePositionRef.current;
      samplesRef.current.push({ x, y });
    }, 50);

    const t = setTimeout(() => {
      clearInterval(iv);
      const stable  = filterStableSamples(samplesRef.current);
      const target  = valPtToPx(VALIDATION_POINTS[ptIndex]);
      const stats   = computePointStats(target, stable);
      const updated = [...statsAccRef.current, stats];
      statsAccRef.current = updated;
      setAllStats([...updated]);

      if (ptIndex < VALIDATION_POINTS.length - 1) {
        setPtIndex(i => i + 1);
        setStep('waiting');
      } else {
        setResult(computeOverallResult(updated));
        setStep('results');
      }
    }, SAMPLE_MS);

    return () => { clearInterval(iv); clearTimeout(t); };
  }, [step, ptIndex]);

  return { step, ptIndex, allStats, result, reset };
}
