import { useState, useRef, useCallback, useEffect } from 'react';
import { CompositeFilter } from '../utils/smoothing';

// React dışı veri yolu: GazeCursor bu ref'i RAF loop içinde okur, re-render yok
export const _gazePositionRef = { current: { x: 0, y: 0 } };

export function useWebGazer() {
  const [status, setStatus]           = useState('idle'); // idle | loading | ready | error
  const [gazePoint, setGazePoint]     = useState({ x: 0, y: 0 });
  const [faceDetected, setFaceDetected] = useState(false);
  const [fps, setFps]                 = useState(0);
  const [accuracy, setAccuracy]       = useState(0);

  const filterRef       = useRef(new CompositeFilter());
  const fpsCount        = useRef(0);
  const fpsTimer        = useRef(null);
  const initialised     = useRef(false);
  const errorsRef       = useRef([]);   // kalibrasyon doğruluk takibi için
  const lastGazeRef     = useRef({ x: -999, y: -999 });
  const lastPredTimeRef = useRef(0);    // prediction throttle
  const hideIntervalRef = useRef(null); // cleanup için
  // Auto-recovery: gereksiz re-render ve anlık blink'leri önler
  const faceActiveRef   = useRef(false); // React state'ten bağımsız senkron ref
  const faceLostTimer   = useRef(null);  // grace period zamanlayıcısı
  const faceLostAtRef   = useRef(0);     // yüz kaybolma zamanı (ms)

  // Webcam track'ine low-light için frame rate constraint uygula (sessizce başarısız olabilir)
  const optimizeWebcam = useCallback(() => {
    try {
      const video = document.getElementById('webgazerVideoFeed');
      if (!video?.srcObject) return;
      const track = video.srcObject.getVideoTracks()[0];
      if (track) {
        track.applyConstraints({ frameRate: { ideal: 30, min: 15 } }).catch(() => {});
      }
    } catch (_) {}
  }, []);

  // WebGazer'ın DOM öğelerini gizle
  const hideWgElements = useCallback(() => {
    const ids = [
      'webgazerVideoFeed',
      'webgazerFaceOverlay',
      'webgazerFaceFeedbackBox',
      'webgazerGazeDot',
    ];
    ids.forEach((id) => {
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

    // Kalibrasyon yoksa eski/bozuk WebGazer verisini temizle
    if (!isCalibrated) {
      try { wg.clearData(); } catch (_) {}
      localStorage.removeItem('webgazerGlobalData');
      filterRef.current.reset();
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

          if (!data) {
            // Grace period: 400ms boyunca face yoksa state güncelle (anlık blink'leri engeller)
            if (faceActiveRef.current && !faceLostTimer.current) {
              faceLostAtRef.current = now;
              faceLostTimer.current = setTimeout(() => {
                faceActiveRef.current = false;
                setFaceDetected(false);
                faceLostTimer.current = null;
              }, 400);
            }
            return;
          }

          // Yüz geri geldi — grace period zamanlayıcısını iptal et
          if (faceLostTimer.current) {
            clearTimeout(faceLostTimer.current);
            faceLostTimer.current = null;
          }

          // NaN / Infinity değerleri filtre'yi kalıcı bozar → at
          if (!isFinite(data.x) || !isFinite(data.y)) return;

          // 10ms altındaki prediction'ları atla (WebGazer bazen double-fire yapar)
          if (now - lastPredTimeRef.current < 10) return;
          lastPredTimeRef.current = now;

          fpsCount.current++;

          // State yalnızca false→true geçişinde güncellenir (gereksiz re-render engellenir)
          if (!faceActiveRef.current) {
            faceActiveRef.current = true;
            setFaceDetected(true);
            // 500ms+ yokluktan sonra dönüşte filtre stale data'yı temizle
            if (now - faceLostAtRef.current > 500) {
              filterRef.current.softReset(data.x, data.y);
            }
          }

          // Ekran sınırlarına kısıtla (dışarıdaki değerler regresyon sapması oluşturur)
          const cx = Math.max(0, Math.min(window.innerWidth,  data.x));
          const cy = Math.max(0, Math.min(window.innerHeight, data.y));

          const smoothed = filterRef.current.update(cx, cy);

          // Filtre bozulmuşsa (NaN çıktı) sıfırla
          if (!isFinite(smoothed.x) || !isFinite(smoothed.y)) {
            filterRef.current.reset();
            return;
          }

          // Cursor her zaman en güncel pozisyonu okur (React dışı)
          _gazePositionRef.current = smoothed;
          // React state: 3px deadzone ile güncelle (NavigationMode/PhotoMode için)
          const dx = Math.abs(smoothed.x - lastGazeRef.current.x);
          const dy = Math.abs(smoothed.y - lastGazeRef.current.y);
          if (dx > 3 || dy > 3) {
            lastGazeRef.current = { x: smoothed.x, y: smoothed.y };
            setGazePoint({ x: smoothed.x, y: smoothed.y });
          }
        })
        .saveDataAcrossSessions(isCalibrated)
        .showVideo(false)
        .showFaceOverlay(false)
        .showFaceFeedbackBox(false)
        .begin();

      wg.showPredictionPoints(false);
      hideWgElements();
      // Interval ile sürekli gizle (WebGazer bazen yeniden ekliyor)
      hideIntervalRef.current = setInterval(hideWgElements, 500);
      // Kamera başladıktan sonra frame rate optimize et
      setTimeout(optimizeWebcam, 1500);

      initialised.current = true;
      setStatus('ready');
      startFpsCounter();
    } catch (err) {
      console.error('[useWebGazer] init error:', err);
      setStatus('error');
    }
  }, [hideWgElements, startFpsCounter, optimizeWebcam]);

  const clearCalibrationData = useCallback(() => {
    window.webgazer?.clearData();
    localStorage.removeItem('webgazerGlobalData');
    filterRef.current.reset();
    errorsRef.current = [];
    lastGazeRef.current = { x: -999, y: -999 };
    setAccuracy(0);
  }, []);

  // Kalibrasyon noktası kaydı — WebGazer click listener + explicit call
  const recordCalibrationPoint = useCallback((screenX, screenY) => {
    const wg = window.webgazer;
    if (!wg) return;
    if (typeof wg.recordScreenPosition === 'function') {
      wg.recordScreenPosition(screenX, screenY, 'click');
    }
  }, []);

  // Doğruluk güncelle (her kalibrasyon tıklamasından sonra çağrılır)
  const updateAccuracy = useCallback((predictedX, predictedY, targetX, targetY) => {
    const err = Math.sqrt((predictedX - targetX) ** 2 + (predictedY - targetY) ** 2);
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
