import { useState, useRef, useCallback, useEffect } from 'react';

// ── Shared gaze ref (non-React path for RAF loops) ──────────────────────────
export const _gazePositionRef = { current: { x: 0, y: 0 } };

// Module-level flag: WebGazer starts once per page load.
let _wgStarted = false;

// ────────────────────────────────────────────────────────────────────────────
export function useWebGazer() {
  const [status,       setStatus]       = useState('idle');
  const [gazePoint,    setGazePoint]    = useState({ x: 0, y: 0 });
  const [faceDetected, setFaceDetected] = useState(false);

  const faceRef      = useRef(false);
  const faceTimerRef = useRef(null);

  // ── Move WebGazer's DOM elements off-screen (keep display:block!) ─────────
  //
  // CRITICAL: NEVER use display:none on webgazerVideoFeed.
  // MediaPipe calls canvas.drawImage(videoElement) in its frame loop.
  // display:none suppresses video decoding in Firefox and some Chrome
  // versions — every frame comes back blank → "no face" / tracking loss.
  // Off-screen positioning keeps the element in the layout tree so the
  // browser continues decoding video frames.
  const hideWgUI = useCallback(() => {
    const video = document.getElementById('webgazerVideoFeed');
    if (video) {
      video.style.cssText =
        'position:fixed!important;top:-9999px!important;left:-9999px!important;' +
        'width:320px!important;height:240px!important;' +
        'pointer-events:none!important;z-index:-1!important;display:block!important;';
    }
    ['webgazerFaceOverlay', 'webgazerFaceFeedbackBox', 'webgazerGazeDot']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
  }, []);

  // ── init ──────────────────────────────────────────────────────────────────
  const init = useCallback(async (isCalibrated = false) => {
    const wg = window.webgazer;
    if (!wg) { setStatus('error'); return false; }

    // Already running (component remount / route change) — resume and hide UI.
    if (_wgStarted) {
      try { wg.resume(); } catch (_) {}
      hideWgUI();
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

      // Set non-display params before begin() — these are just config values.
      wg.params.showFaceFeedbackBox = false;
      wg.params.showFaceOverlay     = false;

      // ── WebGazer demo init order (from brownhci/WebGazer main.js) ──────────
      // begin() is awaited first, then display options are set AFTER.
      // Reason: begin() creates the video DOM element. Calling showVideo(false)
      // BEFORE begin() causes begin() to create the element with display:none,
      // which breaks MediaPipe's canvas.drawImage() frame loop entirely.
      // The demo calls showVideoPreview(true) after begin() — we call hideWgUI()
      // instead to move the element off-screen while keeping display:block.
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
              }, 300); // 300ms tolerance handles blinks
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

          // Clamp to viewport — WebGazer native output, minimal processing
          const x = Math.max(0, Math.min(window.innerWidth,  data.x));
          const y = Math.max(0, Math.min(window.innerHeight, data.y));

          _gazePositionRef.current = { x, y };
          setGazePoint({ x, y });
        })
        .saveDataAcrossSessions(true)
        .begin(); // ← await here, then configure display below

      // ── Post-begin() configuration (matches demo order) ──────────────────
      try { wg.applyKalmanFilter(true); } catch (_) {}
      wg.showPredictionPoints(false); // we use our own GazeCursor

      // Move video off-screen (display:block preserved — required by MediaPipe).
      // Called immediately + at 200ms and 800ms because WebGazer creates some
      // elements asynchronously after begin() resolves.
      hideWgUI();
      setTimeout(hideWgUI, 200);
      setTimeout(hideWgUI, 800);
      // No recurring interval — 800ms is sufficient; a periodic interval risks
      // fighting WebGazer's own DOM updates and causes unnecessary overhead.

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
  }, []);

  // NOTE: recordCalibrationPoint is kept for backward compatibility but should
  // NOT be called during calibration — WebGazer's built-in document click
  // listener (added by begin()) already records every click at (clientX, clientY).
  // Calling this explicitly would double-record each calibration click, feeding
  // the ridge regression two slightly-different labels for the same eye features.
  const recordCalibrationPoint = useCallback((x, y) => {
    window.webgazer?.recordScreenPosition?.(x, y, 'click');
  }, []);

  // ── cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onUnload = () => { try { window.webgazer?.pause(); } catch (_) {} };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      clearTimeout(faceTimerRef.current);
    };
  }, []);

  return {
    status,
    gazePoint,
    faceDetected,
    fps:      0,
    accuracy: 0,
    init,
    clearCalibrationData,
    recordCalibrationPoint,
    updateAccuracy: () => {},
  };
}
