import { useState, useRef, useCallback, useEffect } from 'react';

// React dışı veri yolu: GazeCursor ve ForensicDashboard bu ref'i RAF loop içinde okur
export const _gazePositionRef = { current: { x: 0, y: 0 } };

export function useWebGazer() {
  const [status, setStatus]             = useState('idle');
  const [gazePoint, setGazePoint]       = useState({ x: 0, y: 0 });
  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps]                   = useState(0);
  const [accuracy, setAccuracy]         = useState(0);

  const fpsCount        = useRef(0);
  const fpsTimer        = useRef(null);
  const initialised     = useRef(false);
  const errorsRef       = useRef([]);
  const lastGazeRef     = useRef({ x: -999, y: -999 });
  const lastPredTimeRef = useRef(0);
  const hideIntervalRef = useRef(null);

  // Face detection grace period — anlık blink'lerde state thrash'i önler
  const faceActiveRef   = useRef(false);
  const faceLostTimer   = useRef(null);
  const faceLostAtRef   = useRef(0);

  const hideWgElements = useCallback(() => {
    ['webgazerVideoFeed', 'webgazerFaceOverlay', 'webgazerFaceFeedbackBox', 'webgazerGazeDot']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
  }, []);

  const startFpsCounter = useCallback(() => {
    fpsTimer.current = setInterval(() => {
      setFps(fpsCount.current);
      fpsCount.current = 0;
    }, 1000);
  }, []);

  const init = useCallback(async (isCalibrated = false) => {
    if (initialised.current) return;
    const wg = window.webgazer;
    if (!wg) { setStatus('error'); return; }

    if (!isCalibrated) {
      try { wg.clearData(); } catch (_) {}
      localStorage.removeItem('webgazerGlobalData');
    }

    setStatus('loading');
    try {
      wg.params.showFaceFeedbackBox = false;
      wg.params.showFaceOverlay     = false;

      await wg
        .setRegression('ridge')
        .setTracker('mediapipe')
        .setGazeListener((data) => {
          const now = performance.now();

          // Yüz yok — grace period ile state güncelle
          if (!data) {
            if (faceActiveRef.current && !faceLostTimer.current) {
              faceLostAtRef.current = now;
              faceLostTimer.current = setTimeout(() => {
                faceActiveRef.current = false;
                setFaceDetected(false);
                faceLostTimer.current = null;
              }, 700);
            }
            return;
          }

          // Yüz geri geldi
          if (faceLostTimer.current) {
            clearTimeout(faceLostTimer.current);
            faceLostTimer.current = null;
          }

          // Bozuk değerleri at
          if (!isFinite(data.x) || !isFinite(data.y)) return;

          // WebGazer bazen 5ms içinde double-fire yapar
          if (now - lastPredTimeRef.current < 5) return;
          lastPredTimeRef.current = now;

          fpsCount.current++;

          if (!faceActiveRef.current) {
            faceActiveRef.current = true;
            setFaceDetected(true);
          }

          // Ekran sınırına kısıtla
          const cx = Math.max(0, Math.min(window.innerWidth,  data.x));
          const cy = Math.max(0, Math.min(window.innerHeight, data.y));

          // WebGazer Kalman filter çıktısını doğrudan kullan — custom filter yok
          _gazePositionRef.current = { x: cx, y: cy };

          // React state: 3px deadzone (re-render spam engeller, cursor etkilenmez)
          const dx = Math.abs(cx - lastGazeRef.current.x);
          const dy = Math.abs(cy - lastGazeRef.current.y);
          if (dx > 3 || dy > 3) {
            lastGazeRef.current = { x: cx, y: cy };
            setGazePoint({ x: cx, y: cy });
          }
        })
        .saveDataAcrossSessions(isCalibrated)
        .showVideo(false)
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false)
        .begin();

      // Demo davranışı: WebGazer'ın kendi Kalman filtresi aktif
      // Bu, custom EMA/MA pipeline'ın yerini alır — demo sayfasıyla birebir
      try { wg.applyKalmanFilter(true); } catch (_) {}

      wg.showPredictionPoints(false);
      // WebGazer elementi ilk 2s içinde oluşturur; biraz bekleyip gizle, sonra seyrek denetle.
      setTimeout(hideWgElements, 200);
      setTimeout(hideWgElements, 800);
      hideIntervalRef.current = setInterval(hideWgElements, 3000);

      initialised.current = true;
      setStatus('ready');
      startFpsCounter();
    } catch (err) {
      console.error('[useWebGazer] init error:', err);
      setStatus('error');
    }
  }, [hideWgElements, startFpsCounter]);

  const clearCalibrationData = useCallback(() => {
    window.webgazer?.clearData();
    localStorage.removeItem('webgazerGlobalData');
    errorsRef.current = [];
    lastGazeRef.current = { x: -999, y: -999 };
    setAccuracy(0);
  }, []);

  const recordCalibrationPoint = useCallback((screenX, screenY) => {
    const wg = window.webgazer;
    if (!wg) return;
    if (typeof wg.recordScreenPosition === 'function') {
      wg.recordScreenPosition(screenX, screenY, 'click');
    }
  }, []);

  const updateAccuracy = useCallback((predictedX, predictedY, targetX, targetY) => {
    const err  = Math.sqrt((predictedX - targetX) ** 2 + (predictedY - targetY) ** 2);
    errorsRef.current.push(err);
    if (errorsRef.current.length > 30) errorsRef.current.shift();
    const diag = Math.sqrt(window.innerWidth ** 2 + window.innerHeight ** 2);
    const avg  = errorsRef.current.reduce((a, b) => a + b, 0) / errorsRef.current.length;
    setAccuracy(Math.max(0, Math.min(100, Math.round(100 - (avg / diag) * 200))));
  }, []);

  useEffect(() => {
    return () => {
      clearInterval(fpsTimer.current);
      clearInterval(hideIntervalRef.current);
      clearTimeout(faceLostTimer.current);
      if (initialised.current) {
        try { window.webgazer?.pause(); } catch (_) {}
      }
    };
  }, []);

  return {
    status,
    gazePoint,
    faceDetected,
    fps,
    accuracy,
    init,
    clearCalibrationData,
    recordCalibrationPoint,
    updateAccuracy,
  };
}
