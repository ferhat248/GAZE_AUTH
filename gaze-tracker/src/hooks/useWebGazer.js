import { useState, useRef, useCallback, useEffect } from 'react';

// ── Shared gaze ref (non-React path for RAF loops) ──────────────────────────
export const _gazePositionRef = { current: { x: 0, y: 0 } };

// Module-level flag: WebGazer starts once per page load.
// useRef would reset on component unmount/remount (route change, etc.) — this does not.
let _wgStarted = false;

// ────────────────────────────────────────────────────────────────────────────
export function useWebGazer() {
  const [status,      setStatus]      = useState('idle');
  const [gazePoint,   setGazePoint]   = useState({ x: 0, y: 0 });
  const [faceDetected,setFaceDetected]= useState(false);

  const faceRef        = useRef(false);
  const faceTimerRef   = useRef(null);
  const hideIntervalRef= useRef(null);
  const lastGazeRef    = useRef({ x: -999, y: -999 });

  // ── Hide WebGazer's own DOM elements (we use our own cursor) ──────────────
  const hideWgUI = useCallback(() => {
    ['webgazerVideoFeed','webgazerFaceOverlay','webgazerFaceFeedbackBox','webgazerGazeDot']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
  }, []);

  // ── init ──────────────────────────────────────────────────────────────────
  // Returns true on success, false on failure.
  const init = useCallback(async (isCalibrated = false) => {
    const wg = window.webgazer;
    if (!wg) { setStatus('error'); return false; }

    // Already running (component remount, route change) — just resume + signal ok.
    if (_wgStarted) {
      try { wg.resume(); } catch (_) {}
      setStatus('ready');
      return true;
    }

    if (!isCalibrated) {
      try { wg.clearData(); } catch (_) {}
      localStorage.removeItem('webgazerGlobalData');
    }

    setStatus('loading');

    try {
      _wgStarted = true;

      wg.params.showFaceFeedbackBox = false;
      wg.params.showFaceOverlay     = false;

      await wg
        .setRegression('ridge')
        .setTracker('mediapipe')
        .setGazeListener((data) => {
          // Face lost
          if (!data) {
            if (faceRef.current && !faceTimerRef.current) {
              faceTimerRef.current = setTimeout(() => {
                faceRef.current = false;
                setFaceDetected(false);
                faceTimerRef.current = null;
              }, 300); // 300ms tolerance: handles blinks
            }
            return;
          }

          // Face recovered
          if (faceTimerRef.current) {
            clearTimeout(faceTimerRef.current);
            faceTimerRef.current = null;
          }
          if (!isFinite(data.x) || !isFinite(data.y)) return;
          if (!faceRef.current) { faceRef.current = true; setFaceDetected(true); }

          // WebGazer Kalman output — clamp to viewport, no extra math
          const x = Math.max(0, Math.min(window.innerWidth,  data.x));
          const y = Math.max(0, Math.min(window.innerHeight, data.y));

          // Ref path: every prediction, zero delay (cursor + GazePassword use this)
          _gazePositionRef.current = { x, y };

          // React state path: 3 px threshold prevents 30 fps re-render cascade
          const dx = Math.abs(x - lastGazeRef.current.x);
          const dy = Math.abs(y - lastGazeRef.current.y);
          if (dx > 3 || dy > 3) {
            lastGazeRef.current = { x, y };
            setGazePoint({ x, y });
          }
        })
        .saveDataAcrossSessions(isCalibrated)
        .showVideo(false)
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false)
        .begin();

      // Same as demo page: Kalman filter on. We use our own cursor so dot off.
      try { wg.applyKalmanFilter(true); } catch (_) {}
      wg.showPredictionPoints(false);

      // WebGazer sometimes recreates its own DOM; hide it when it does.
      setTimeout(hideWgUI, 200);
      setTimeout(hideWgUI, 800);
      hideIntervalRef.current = setInterval(hideWgUI, 3000);

      setStatus('ready');
      return true;
    } catch (err) {
      _wgStarted = false;
      console.error('[WebGazer] init error:', err);
      setStatus('error');
      return false;
    }
  }, [hideWgUI]);

  // ── calibration helpers ───────────────────────────────────────────────────
  const clearCalibrationData = useCallback(() => {
    window.webgazer?.clearData();
    localStorage.removeItem('webgazerGlobalData');
    lastGazeRef.current = { x: -999, y: -999 };
  }, []);

  const recordCalibrationPoint = useCallback((x, y) => {
    window.webgazer?.recordScreenPosition?.(x, y, 'click');
  }, []);

  // ── cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    // Pause WebGazer when the browser tab/window closes, not on component cleanup.
    // Pausing on component cleanup breaks route-change + remount scenarios.
    const onUnload = () => { try { window.webgazer?.pause(); } catch (_) {} };
    window.addEventListener('beforeunload', onUnload);

    return () => {
      window.removeEventListener('beforeunload', onUnload);
      clearInterval(hideIntervalRef.current);
      clearTimeout(faceTimerRef.current);
    };
  }, []);

  return {
    status,
    gazePoint,
    faceDetected,
    fps:      0, // removed — was causing 1 Hz re-renders
    accuracy: 0, // removed — was causing extra state churn
    init,
    clearCalibrationData,
    recordCalibrationPoint,
    updateAccuracy: () => {},
  };
}
