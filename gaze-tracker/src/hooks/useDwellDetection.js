import { useState, useRef, useEffect, useCallback } from 'react';
import { detectRegion } from '../utils/regionDetection';

const CLICK_MS      = 3000;
const HOVER_MS      = 2000;
const HYSTERESIS_MS = 500; // yeni karta geçmek için gereken minimum süre

export function useDwellDetection({ gazePoint, isActive }) {
  // Core refs - React state update yok, her frame çalışır
  const activeCardRef          = useRef(null);
  const dwellStartRef          = useRef(null);
  const navigationTriggeredRef = useRef(false);
  const candidateCardRef       = useRef(null);
  const candidateStartRef      = useRef(null);

  // Props'ları rAF loop içinden okumak için ref
  const gazePointRef = useRef(gazePoint);
  const isActiveRef  = useRef(isActive);
  const animFrameRef = useRef(null);

  // Debug: her ~1 saniyede bir dwellTime logla
  const lastLogRef = useRef(0);

  // UI için state - sadece görsel güncellemeler
  const [activeRegion, setActiveRegion]   = useState(null);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [firedRegion, setFiredRegion]     = useState(null);

  // Props değişince ref'leri güncelle
  useEffect(() => { gazePointRef.current = gazePoint; }, [gazePoint]);
  useEffect(() => { isActiveRef.current  = isActive;  }, [isActive]);

  useEffect(() => {
    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);

      if (!isActiveRef.current || gazePointRef.current?.x == null) return;

      const gaze    = gazePointRef.current;
      const now     = Date.now();
      const region  = detectRegion(gaze.x, gaze.y);

      if (activeCardRef.current === null) {
        // Hiç aktif kart yok → hysteresis ile ilk karta gir
        if (candidateCardRef.current !== region) {
          candidateCardRef.current  = region;
          candidateStartRef.current = now;
        } else if (now - candidateStartRef.current >= HYSTERESIS_MS) {
          activeCardRef.current         = region;
          dwellStartRef.current         = now;
          navigationTriggeredRef.current = false;
          candidateCardRef.current      = null;
          candidateStartRef.current     = null;
          console.log('[GazeNav] activeCard:', region);
          setActiveRegion(region);
          setDwellProgress(0);
          setHoveredRegion(null);
        }
        return;
      }

      if (region === activeCardRef.current) {
        // Aynı kart → dwell ilerlet, candidate sıfırla
        candidateCardRef.current  = null;
        candidateStartRef.current = null;

        if (navigationTriggeredRef.current) return;

        const elapsed  = now - dwellStartRef.current;
        const progress = Math.min((elapsed / CLICK_MS) * 100, 100);
        setDwellProgress(progress);

        if (elapsed >= HOVER_MS) setHoveredRegion(region);

        // Periyodik dwellTime logu (her ~1 saniye)
        if (now - lastLogRef.current > 1000) {
          console.log('[GazeNav] dwellTime:', Math.round(elapsed), 'ms  card:', region);
          lastLogRef.current = now;
        }

        if (elapsed >= CLICK_MS) {
          navigationTriggeredRef.current = true;
          console.log('[GazeNav] navigationTriggered:', region, '| dwellTime:', elapsed, 'ms');
          setFiredRegion(activeCardRef.current);
          setActiveRegion(null);
          setDwellProgress(0);
          setHoveredRegion(null);
          activeCardRef.current  = null;
          dwellStartRef.current  = null;
        }

      } else {
        // Farklı kart → hysteresis uygula, mevcut dwell'i devam ettir
        if (candidateCardRef.current !== region) {
          candidateCardRef.current  = region;
          candidateStartRef.current = now;
        } else if (now - candidateStartRef.current >= HYSTERESIS_MS) {
          // Yeterince uzun süre başka karttaydı → gerçek geçiş
          activeCardRef.current          = region;
          dwellStartRef.current          = now;
          navigationTriggeredRef.current = false;
          candidateCardRef.current       = null;
          candidateStartRef.current      = null;
          console.log('[GazeNav] activeCard:', region);
          setActiveRegion(region);
          setDwellProgress(0);
          setHoveredRegion(null);
        }
        // Hysteresis dolmadıysa mevcut aktif kartı değiştirme
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []); // Sadece bir kez başlat

  const resetDwell = useCallback(() => {
    activeCardRef.current          = null;
    dwellStartRef.current          = null;
    navigationTriggeredRef.current = false;
    candidateCardRef.current       = null;
    candidateStartRef.current      = null;
    setActiveRegion(null);
    setDwellProgress(0);
    setHoveredRegion(null);
  }, []);

  const clearFired = useCallback(() => setFiredRegion(null), []);

  return {
    activeRegion,
    dwellProgress,
    hoveredRegion,
    firedRegion,
    resetDwell,
    clearFired,
  };
}
