/**
 * useFaceAuth — otomatik yüz kaydı + sürekli doğrulama.
 *
 * Akış:
 *   1. Modeller yükle  →  kamera aç
 *   2. localStorage'da kayıtlı yüz YOK → otomatik kayıt (5 örnek, sessiz)
 *   3. localStorage'da kayıtlı yüz VAR → doğrulama döngüsü başlar
 *   4. Kayıtlı yüz kamerada → authorized (içerik açık)
 *      Başkası / yüz yok   → unauthorized / no_face (blur)
 *
 * Önemli teknik notlar:
 *   - video.play() SONRASI 'play' olayı bekleniyor (loadeddata yetmez)
 *   - detectOnce: video → canvas.drawImage(videoWidth/Height) → detect(canvas)
 *     (React <video> width/height attr set etmez; videoWidth/Height her zaman doğru)
 *   - Her detection için 5sn timeout (TF.js WebGL hang önlemi)
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const SCRIPT_SRC     = '/face-api.js';
const MODEL_URL      = '/models';
const STORAGE_KEY    = 'fa_desc_v6';
const THRESHOLD      = 0.50;
const TOLERANCE_MS   = 2500;
const VERIFY_MS      = 1500;
const ENROLL_N       = 5;
const DETECT_TIMEOUT = 5000;

let _fa       = null;
let _ready    = false;
let _initProm = null;
let _stored   = null;   // in-memory descriptor

// ── script yükle ──────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.faceapi) { resolve(); return; }
    const ex = document.querySelector('script[data-faceapi]');
    if (ex) {
      const t = setInterval(() => { if (window.faceapi) { clearInterval(t); resolve(); } }, 50);
      return;
    }
    const s = document.createElement('script');
    s.setAttribute('data-faceapi', '1');
    s.src = src;
    s.onload = () => window.faceapi ? resolve() : reject(new Error('window.faceapi yok'));
    s.onerror = () => reject(new Error('/face-api.js yüklenemedi'));
    document.head.appendChild(s);
  });
}

async function initFaceApi() {
  if (_ready) return;
  if (_initProm) return _initProm;
  _initProm = (async () => {
    await loadScript(SCRIPT_SRC);
    _fa = window.faceapi;
    await Promise.all([
      _fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      _fa.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      _fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    _stored = _readDesc();
    _ready  = true;
    console.log('[FaceAuth] Hazır ✓ — kayıtlı yüz:', _stored ? 'VAR' : 'YOK');
  })();
  return _initProm;
}

// ── localStorage ──────────────────────────────────────────────────────────────
function _readDesc() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? new Float32Array(JSON.parse(r)) : null; }
  catch { return null; }
}
function _writeDesc(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(arr)));
}

// ── kare al → canvas → detect ─────────────────────────────────────────────────
async function detectOnce(videoEl) {
  const vw = videoEl?.videoWidth;
  const vh = videoEl?.videoHeight;
  if (!vw || !vh) return null;

  // Canvas yakalaması: @vladmandic UMD video.width attr okur, React bunu set etmez.
  // videoWidth/videoHeight her zaman gerçek stream boyutunu verir.
  const c = document.createElement('canvas');
  c.width  = vw;
  c.height = vh;
  c.getContext('2d').drawImage(videoEl, 0, 0, vw, vh);

  const opts = new _fa.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });
  const det  = _fa.detectSingleFace(c, opts).withFaceLandmarks(true).withFaceDescriptor();
  const to   = new Promise((_, r) => setTimeout(() => r(new Error('timeout')), DETECT_TIMEOUT));
  const res  = await Promise.race([det, to]);
  return res ?? null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useFaceAuth() {
  const videoRef = useRef(null);  // FaceAuthPanel → <video ref={videoRef}>

  const [phase,        setPhase]        = useState('loading');
  // 'loading' | 'enrolling' | 'authorized' | 'unauthorized' | 'no_face'
  const [enrollPct,    setEnrollPct]    = useState(0);   // 0-100
  const [lastDistance, setLastDistance] = useState(null);
  const [error,        setError]        = useState(null);

  const statusRef = useRef('loading');
  const lockTimer = useRef(null);
  const alive     = useRef(true);
  const streamRef = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(lockTimer.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── ana akış: yükle → kamera → kayıt veya doğrulama ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Modelleri yükle
        console.log('[FaceAuth] Modeller yükleniyor...');
        await initFaceApi();
        if (cancelled) return;

        // 2. Kamera aç
        console.log('[FaceAuth] Kamera açılıyor...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) { console.error('[FaceAuth] videoRef boş!'); return; }

        video.srcObject = stream;

        // play() ÖNCE, sonra 'play' olayını bekle  (loadeddata yetmez)
        await video.play().catch(e => console.warn('[FaceAuth] play hatası:', e));
        await new Promise(res => {
          if (!video.paused) { res(); return; }
          video.addEventListener('play', res, { once: true });
          setTimeout(res, 4000);
        });

        // videoWidth > 0 olana kadar bekle
        for (let i = 0; i < 30 && !video.videoWidth; i++) await sleep(100);
        console.log(`[FaceAuth] Kamera hazır: ${video.videoWidth}×${video.videoHeight}`);
        if (cancelled) return;

        // 3a. Kayıtlı yüz yoksa → otomatik kayıt
        if (!_stored) {
          console.log('[FaceAuth] Kayıtlı yüz yok → otomatik kayıt başlıyor...');
          if (alive.current) setPhase('enrolling');
          await autoEnroll(video, cancelled, alive, setEnrollPct);
          if (cancelled || !alive.current) return;
        }

        // 3b. Kayıtlı yüz varsa → doğrulama döngüsü
        console.log('[FaceAuth] Doğrulama döngüsü başlıyor...');
        verifyLoop(video, cancelled, alive, statusRef, lockTimer, setPhase, setLastDistance);

      } catch (err) {
        console.error('[FaceAuth] Hata:', err);
        if (alive.current) setError(err.message);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── yeniden kaydet ────────────────────────────────────────────────────────────
  const reEnroll = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    localStorage.removeItem(STORAGE_KEY);
    _stored = null;
    clearTimeout(lockTimer.current);
    statusRef.current = 'enrolling';
    setPhase('enrolling');
    setLastDistance(null);
    await autoEnroll(video, false, alive, setEnrollPct);
    if (alive.current && _stored) verifyLoop(video, false, alive, statusRef, lockTimer, setPhase, setLastDistance);
  }, []);

  // ── dışa açık değerler ────────────────────────────────────────────────────────
  return {
    videoRef,
    phase,
    enrollPct,
    lastDistance,
    error,
    hasEnrolled:  !!_stored,
    isBlocked:    phase !== 'authorized',
    authStatus:   phase,
    reEnroll,
  };
}

// ── otomatik kayıt fonksiyonu (hook dışında, saf async) ───────────────────────
async function autoEnroll(video, cancelled, alive, setEnrollPct) {
  const samples  = [];
  const maxTries = ENROLL_N * 8;

  for (let t = 0; t < maxTries && samples.length < ENROLL_N && !cancelled; t++) {
    await sleep(400);
    try {
      const det = await detectOnce(video);
      if (det?.descriptor) {
        samples.push(det.descriptor);
        const pct = Math.round((samples.length / ENROLL_N) * 100);
        if (alive.current) setEnrollPct(pct);
        console.log(`[FaceAuth] Örnek ${samples.length}/${ENROLL_N}`);
      } else {
        console.log(`[FaceAuth] Deneme ${t + 1}: yüz algılanamadı`);
      }
    } catch (e) { console.warn(`[FaceAuth] Deneme ${t + 1}:`, e?.message); }
  }

  if (samples.length < 2) {
    console.warn('[FaceAuth] Yeterli örnek alınamadı:', samples.length);
    return;
  }

  const avg = new Float32Array(128);
  for (const s of samples) for (let j = 0; j < 128; j++) avg[j] += s[j];
  for (let j = 0; j < 128; j++) avg[j] /= samples.length;

  _writeDesc(avg);
  _stored = avg;
  if (alive.current) setEnrollPct(100);
  console.log(`[FaceAuth] Kayıt tamamlandı ✓ (${samples.length} örnek)`);
}

// ── sürekli doğrulama döngüsü ─────────────────────────────────────────────────
function verifyLoop(video, cancelledFlag, alive, statusRef, lockTimer, setPhase, setLastDistance) {
  let cancelled = cancelledFlag;
  let timer;

  const applyStatus = (next, dist) => {
    if (!alive.current) return;
    if (dist !== undefined) setLastDistance(+dist.toFixed(3));

    if (next === 'authorized') {
      clearTimeout(lockTimer.current);
      lockTimer.current = null;
      if (statusRef.current !== 'authorized') {
        statusRef.current = 'authorized';
        setPhase('authorized');
      }
    } else {
      if (statusRef.current === 'authorized' && !lockTimer.current) {
        lockTimer.current = setTimeout(() => {
          if (!alive.current) return;
          lockTimer.current = null;
          statusRef.current = next;
          setPhase(next);
        }, TOLERANCE_MS);
      } else if (!lockTimer.current && statusRef.current !== next) {
        statusRef.current = next;
        setPhase(next);
      }
    }
  };

  const run = async () => {
    if (cancelled || !alive.current) return;
    if (!_stored) return;  // kayıt silindiyse dur

    try {
      const det = await detectOnce(video);
      if (!det) {
        applyStatus('no_face');
      } else {
        const dist = _fa.euclideanDistance(_stored, det.descriptor);
        console.log(`[FaceAuth] dist=${dist.toFixed(3)} → ${dist < THRESHOLD ? 'YETKİLİ ✓' : 'YETKİSİZ ✗'}`);
        applyStatus(dist < THRESHOLD ? 'authorized' : 'unauthorized', dist);
      }
    } catch (e) {
      console.warn('[FaceAuth] Doğrulama hatası:', e?.message);
      applyStatus('no_face');
    }

    if (!cancelled && alive.current) timer = setTimeout(run, VERIFY_MS);
  };

  run();
  // Dışarıdan iptal etmek için: cancelled = true yapılabilir
}
