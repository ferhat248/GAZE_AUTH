import { useState, useCallback, useRef } from 'react';
import { CALIBRATION_POINTS, ptToPx } from '../utils/gazeUtils';

const CLICKS_PER_POINT = 5;
const TOTAL_CLICKS = CALIBRATION_POINTS.length * CLICKS_PER_POINT;

export function useCalibration({ recordCalibrationPoint, updateAccuracy }) {
  const [phase, setPhase]             = useState('idle'); // idle | active | validating | done
  const [activeIndex, setActiveIndex] = useState(0);
  const [clickMap, setClickMap]       = useState({});
  const [doneSet, setDoneSet]         = useState(new Set());
  const [totalClicks, setTotalClicks] = useState(0);

  const savedRef = useRef(localStorage.getItem('gazeCalibrated') === 'true');

  const isCalibrated = savedRef.current;
  const progress     = Math.round((totalClicks / TOTAL_CLICKS) * 100);

  const start = useCallback(() => {
    setPhase('active');
    setActiveIndex(0);
    setClickMap({});
    setDoneSet(new Set());
    setTotalClicks(0);
  }, []);

  const handleDotClick = useCallback((pointIndex) => {
    if (pointIndex !== activeIndex) return;

    const pt  = CALIBRATION_POINTS[pointIndex];
    const px  = ptToPx(pt);

    // 5 samples per click, starting at 60ms so the eye has settled on the target.
    // Spread over 280ms captures the gaze as it stabilizes — early samples would catch
    // the motor saccade from the click, late samples catch steady fixation.
    // Total: 5 × 5 × 9 = 225 samples for a more reliable regression model.
    setTimeout(() => recordCalibrationPoint(px.x, px.y),  60);
    setTimeout(() => recordCalibrationPoint(px.x, px.y), 110);
    setTimeout(() => recordCalibrationPoint(px.x, px.y), 160);
    setTimeout(() => recordCalibrationPoint(px.x, px.y), 220);
    setTimeout(() => recordCalibrationPoint(px.x, px.y), 280);

    const prev    = clickMap[pointIndex] ?? 0;
    const next    = prev + 1;
    const newMap  = { ...clickMap, [pointIndex]: next };
    setClickMap(newMap);
    setTotalClicks((t) => t + 1);

    if (next >= CLICKS_PER_POINT) {
      const newDone = new Set(doneSet);
      newDone.add(pointIndex);
      setDoneSet(newDone);

      if (pointIndex < CALIBRATION_POINTS.length - 1) {
        setActiveIndex(pointIndex + 1);
      } else {
        setPhase('validating');
      }
    }
  }, [activeIndex, clickMap, doneSet, recordCalibrationPoint]);

  // Doğruluk testi tamamlandı → localStorage kaydet → EyeTracker mode-select'e geçer
  const finishValidation = useCallback(() => {
    localStorage.setItem('gazeCalibrated', 'true');
    savedRef.current = true;
    setPhase('done');
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem('gazeCalibrated');
    savedRef.current = false;
    setPhase('idle');
    setActiveIndex(0);
    setClickMap({});
    setDoneSet(new Set());
    setTotalClicks(0);
  }, []);

  return {
    phase,
    activeIndex,
    clickMap,
    doneSet,
    progress,
    isCalibrated: savedRef.current,
    clicksPerPoint: CLICKS_PER_POINT,
    points: CALIBRATION_POINTS,
    start,
    handleDotClick,
    finishValidation,
    reset,
  };
}
