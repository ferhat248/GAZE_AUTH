import { useState, useCallback, useRef, useEffect } from 'react';
import { CALIBRATION_POINTS } from '../utils/gazeUtils';

const CLICKS_PER_POINT = 5;
const CENTER_INDEX     = 4; // index 4 = merkez nokta (50%, 50%)
const OUTER_INDICES    = [0, 1, 2, 3, 5, 6, 7, 8];
const TOTAL_CLICKS     = CALIBRATION_POINTS.length * CLICKS_PER_POINT;

// WebGazer demo kalibrasyon akışı:
// 1. 8 dış nokta aynı anda gösterilir — herhangi birine tıklanabilir
// 2. 8 dış nokta tamamlanınca merkez nokta belirir (PointCalibrate === 8)
// 3. Merkez tamamlanınca validation'a geçilir
export function useCalibration() {
  const [phase,         setPhase]         = useState('idle');
  const [clickMap,      setClickMap]      = useState({}); // { index → clickCount }
  const [centerVisible, setCenterVisible] = useState(false);

  const savedRef = useRef(localStorage.getItem('gazeCalibrated') === 'true');

  // Türev hesaplar (state'ten)
  const outerDoneCount = OUTER_INDICES.filter(i => (clickMap[i] ?? 0) >= CLICKS_PER_POINT).length;
  const centerDone     = (clickMap[CENTER_INDEX] ?? 0) >= CLICKS_PER_POINT;
  const totalClicks    = Object.values(clickMap).reduce((s, v) => s + v, 0);
  const progress       = Math.round((totalClicks / TOTAL_CLICKS) * 100);

  // 8 dış nokta bitince merkez belirir
  useEffect(() => {
    if (phase === 'active' && outerDoneCount >= 8 && !centerVisible) {
      setCenterVisible(true);
    }
  }, [outerDoneCount, centerVisible, phase]);

  // Merkez tamamlanınca validation'a geç
  useEffect(() => {
    if (phase === 'active' && centerDone && centerVisible) {
      const t = setTimeout(() => setPhase('validating'), 500);
      return () => clearTimeout(t);
    }
  }, [phase, centerDone, centerVisible]);

  const start = useCallback(() => {
    setPhase('active');
    setClickMap({});
    setCenterVisible(false);
  }, []);

  // Herhangi bir noktaya tıklanabilir (WebGazer demo: herhangi sıraya tıkla)
  const handleDotClick = useCallback((i) => {
    if (i === CENTER_INDEX && !centerVisible) return; // merkez henüz gizli
    setClickMap(prev => {
      const current = prev[i] ?? 0;
      if (current >= CLICKS_PER_POINT) return prev; // zaten bitti
      return { ...prev, [i]: current + 1 };
    });
  }, [centerVisible]);

  const finishValidation = useCallback(() => {
    localStorage.setItem('gazeCalibrated', 'true');
    savedRef.current = true;
    setPhase('done');
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('gazeCalibrated');
    savedRef.current = false;
    setPhase('idle');
    setClickMap({});
    setCenterVisible(false);
  }, []);

  return {
    phase,
    clickMap,
    centerVisible,
    progress,
    isCalibrated:   savedRef.current,
    clicksPerPoint: CLICKS_PER_POINT,
    points:         CALIBRATION_POINTS,
    start,
    handleDotClick,
    finishValidation,
    reset,
  };
}
