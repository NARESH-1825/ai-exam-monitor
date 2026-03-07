// frontend/src/hooks/useProctor.js
// REDESIGN:
//   - Violation COUNT (not score) — any type of violation = +1
//   - Limit is always 3; at 3 → onViolationLimit() callback fires → auto-submit
//   - Proctoring is SILENT to the student — no UI shown during exam
//   - Only the proctoring types enabled on the exam are active
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addEvent, setViolationCount } from '../features/proctor/proctorSlice';

export const VIOLATION_LIMIT = 3;

// Shared metadata — used in ExamConfig (toggle UI), Assessments (permission modal),
// and LiveMonitor (violation labels). Single source of truth.
export const PROCTOR_META = {
  faceDetection: {
    key: 'faceDetection', icon: '👤', label: 'Face Detection',
    desc: 'Camera monitors that only your face is visible. If face disappears or multiple faces appear it is a violation.',
    needsCam: true,
    rule: 'Keep your face clearly visible in the camera at all times.',
    violationTypes: ['FACE_NOT_FOUND', 'MULTIPLE_FACES'],
  },
  eyeTracking: {
    key: 'eyeTracking', icon: '👁️', label: 'Eye Tracking',
    desc: 'AI monitors your gaze direction. Looking away repeatedly counts as a violation.',
    needsCam: true,
    rule: 'Keep your eyes focused on the screen.',
    violationTypes: ['GAZE_AWAY'],
  },
  noiseDetection: {
    key: 'noiseDetection', icon: '🎤', label: 'Noise Detection',
    desc: 'Microphone listens for unusually loud sounds.',
    needsMic: true,
    rule: 'Sit in a quiet environment. Do not speak or allow others to speak near you.',
    violationTypes: ['NOISE_DETECTED'],
  },
  objectDetection: {
    key: 'objectDetection', icon: '📱', label: 'Object Detection',
    desc: 'AI scans your camera feed for phones, books, or other devices.',
    needsCam: true,
    rule: 'Remove all phones, books, and secondary devices from your workspace.',
    violationTypes: ['OBJECT_DETECTED'],
  },
  tabSwitchLock: {
    key: 'tabSwitchLock', icon: '🔒', label: 'Tab Switch Lock',
    desc: 'Switching browser tabs, minimising, or copy/paste attempts are detected.',
    needsCam: false, needsMic: false,
    rule: 'Do not switch tabs, minimise the browser, or use Ctrl+C/V.',
    violationTypes: ['TAB_SWITCH', 'COPY_ATTEMPT', 'DEVTOOLS_ATTEMPT'],
  },
  fullScreenForce: {
    key: 'fullScreenForce', icon: '⛶', label: 'Fullscreen Mode',
    desc: 'The exam must be taken in full-screen mode. Exiting fullscreen is a violation.',
    needsCam: false, needsMic: false, needsFullscreen: true,
    rule: 'Keep the browser in full-screen mode for the entire exam.',
    violationTypes: ['FULLSCREEN_EXIT'],
  },
};

// Returns required permissions for a given proctoring config object
export const getRequiredPermissions = (proctoring = {}) => {
  let needsCam = false, needsMic = false, needsFullscreen = false;
  Object.entries(proctoring).forEach(([key, enabled]) => {
    if (!enabled) return;
    const m = PROCTOR_META[key];
    if (m?.needsCam) needsCam = true;
    if (m?.needsMic) needsMic = true;
    if (m?.needsFullscreen) needsFullscreen = true;
  });
  return { needsCam, needsMic, needsFullscreen };
};

// Returns array of active proctor meta objects
export const getActiveProctors = (proctoring = {}) =>
  Object.entries(proctoring)
    .filter(([, v]) => v)
    .map(([k]) => PROCTOR_META[k])
    .filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// useProctor
//   socket          – socket.io client instance
//   submissionId    – current submission doc ID
//   logId           – proctoring log doc ID
//   examId          – exam ID (for socket events)
//   config          – exam.proctoring object (keys: faceDetection, tabSwitchLock…)
//   enabled         – master switch (false during loading/result phases)
//   onViolationLimit – called when violationCount reaches VIOLATION_LIMIT (3)
// ─────────────────────────────────────────────────────────────────────────────
export const useProctor = ({
  socket, submissionId, logId, examId,
  config = {}, enabled = false,
  onViolationLimit,
}) => {
  const dispatch = useDispatch();
  const videoRef       = useRef(null);
  const audioCtxRef    = useRef(null);
  const faceApiLoaded  = useRef(false);
  const cocoModel      = useRef(null);
  const countRef       = useRef(0);       // local violation counter
  const cleanups       = useRef([]);
  const debounce       = useRef({});      // last-fired time per violation type
  const stopped        = useRef(false);   // true once limit reached — no more events

  // Stable refs so callbacks never need to re-create
  const subRef        = useRef(submissionId);
  const logRef        = useRef(logId);
  const socketRef     = useRef(socket);
  const enabledRef    = useRef(enabled);
  const limitCbRef    = useRef(onViolationLimit);

  useEffect(() => { subRef.current     = submissionId;    }, [submissionId]);
  useEffect(() => { logRef.current     = logId;           }, [logId]);
  useEffect(() => { socketRef.current  = socket;          }, [socket]);
  useEffect(() => { enabledRef.current = enabled;         }, [enabled]);
  useEffect(() => { limitCbRef.current = onViolationLimit;}, [onViolationLimit]);

  // ── Core emitter ─────────────────────────────────────────────────────────
  const emit = useCallback((type, severity, details) => {
    if (!enabledRef.current) return;
    if (!subRef.current || !logRef.current) return;  // IDs not yet populated
    if (stopped.current) return;                       // limit already reached

    // Debounce: same type fires at most once per 8 s
    const now = Date.now();
    if (now - (debounce.current[type] || 0) < 8_000) return;
    debounce.current[type] = now;

    const event = { type, severity, details, timestamp: new Date().toISOString() };
    dispatch(addEvent(event));

    countRef.current += 1;
    dispatch(setViolationCount(countRef.current));

    // Emit to backend/socket — backend also increments & checks threshold
    socketRef.current?.emit('proctor:event', {
      submissionId: subRef.current,
      logId: logRef.current,
      examId,
      event,
    });

    if (countRef.current >= VIOLATION_LIMIT) {
      stopped.current = true;
      limitCbRef.current?.();
    }
  }, [examId, dispatch]);

  // ── Tab Switch / Browser Lock ─────────────────────────────────────────────
  const setupBrowserLock = useCallback(() => {
    if (!config?.tabSwitchLock) return () => {};
    const onVis = () => { if (document.hidden) emit('TAB_SWITCH', 'high', 'Student left exam tab'); };
    const onCtx = e => e.preventDefault();
    const onClip = e => { e.preventDefault(); emit('COPY_ATTEMPT', 'medium', `${e.type} blocked`); };
    const onKey  = e => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase()))) {
        e.preventDefault(); emit('DEVTOOLS_ATTEMPT', 'critical', 'DevTools attempt'); return;
      }
      if (e.ctrlKey && ['c','v','a','x','u','s','p'].includes(e.key.toLowerCase())) {
        e.preventDefault(); emit('COPY_ATTEMPT', 'medium', `Ctrl+${e.key.toUpperCase()}`);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('copy', onClip);
    document.addEventListener('cut', onClip);
    document.addEventListener('paste', onClip);
    document.addEventListener('keydown', onKey);
    document.onselectstart = () => false;
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('copy', onClip);
      document.removeEventListener('cut', onClip);
      document.removeEventListener('paste', onClip);
      document.removeEventListener('keydown', onKey);
      document.onselectstart = null;
      document.body.style.userSelect = '';
    };
  }, [config?.tabSwitchLock, emit]);

  // ── Fullscreen Monitor ────────────────────────────────────────────────────
  const setupFullscreenMonitor = useCallback(() => {
    if (!config?.fullScreenForce) return () => {};

    // If not in fullscreen when proctoring starts — try to re-enter
    const inFsNow = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!inFsNow) {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      fn?.call(el)?.catch(() => {});
    }

    let wasFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    let grace = null;
    const onFS = () => {
      const inFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (wasFS && !inFS && !stopped.current) {
        clearTimeout(grace);
        grace = setTimeout(() => {
          emit('FULLSCREEN_EXIT', 'high', 'Exited fullscreen during exam');
          // Try to re-enter fullscreen
          const el = document.documentElement;
          const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
          fn?.call(el)?.catch(() => {});
        }, 800);
      }
      wasFS = inFS;
    };
    document.addEventListener('fullscreenchange', onFS);
    document.addEventListener('webkitfullscreenchange', onFS);
    return () => {
      clearTimeout(grace);
      document.removeEventListener('fullscreenchange', onFS);
      document.removeEventListener('webkitfullscreenchange', onFS);
    };
  }, [config?.fullScreenForce, emit]);

  // ── Noise Detection ───────────────────────────────────────────────────────
  const startNoise = useCallback(async () => {
    if (!config?.noiseDetection) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext(); audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const iv = setInterval(() => {
        if (stopped.current) { clearInterval(iv); return; }
        analyser.getByteFrequencyData(buf);
        const rms = Math.sqrt(buf.reduce((s,v) => s+v*v, 0) / buf.length);
        if (rms > 30) emit('NOISE_DETECTED', 'low', `RMS ${rms.toFixed(1)}`);
      }, 5000);
      cleanups.current.push(() => {
        clearInterval(iv); ctx.close().catch(() => {});
        stream.getTracks().forEach(t => t.stop());
      });
    } catch (e) { console.warn('Mic access failed:', e.message); }
  }, [config?.noiseDetection, emit]);

  // ── Camera Detection (face / eye / object) ────────────────────────────────
  const startCamera = useCallback(async () => {
    const needsFace = config?.faceDetection;
    const needsEye  = config?.eyeTracking;
    const needsObj  = config?.objectDetection;
    if (!needsFace && !needsEye && !needsObj) return;

    // Lazy-load face-api.js
    const loadFaceApi = () => new Promise(res => {
      if (window.faceapi) { res(true); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
    });

    // Lazy-load TF + COCO-SSD
    const loadCoco = () => new Promise(res => {
      if (window.cocoSsd) { res(true); return; }
      const loadTf = () => new Promise(r => {
        if (window.tf) { r(true); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
        s.onload = () => r(true); s.onerror = () => r(false); document.head.appendChild(s);
      });
      loadTf().then(ok => {
        if (!ok) { res(false); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js';
        s.onload = () => res(true); s.onerror = () => res(false); document.head.appendChild(s);
      });
    });

    try {
      if (needsFace || needsEye) {
        const ok = await loadFaceApi();
        if (ok && window.faceapi) {
          const URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
          await Promise.allSettled([
            window.faceapi.nets.tinyFaceDetector.loadFromUri(URL),
            needsEye ? window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(URL) : Promise.resolve(),
          ]);
          faceApiLoaded.current = true;
        }
      }
      if (needsObj) {
        const ok = await loadCoco();
        if (ok && window.cocoSsd) cocoModel.current = await window.cocoSsd.load();
      }
    } catch (e) { console.warn('AI model load error:', e.message); }

    const detect = async () => {
      if (stopped.current) return;
      const video = videoRef.current?.video || videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      // Face / Eye detection
      if (faceApiLoaded.current && window.faceapi) {
        try {
          const opts = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 });
          const dets = needsEye
            ? await window.faceapi.detectAllFaces(video, opts).withFaceLandmarks(true)
            : await window.faceapi.detectAllFaces(video, opts);

          if (needsFace) {
            if (dets.length === 0) emit('FACE_NOT_FOUND', 'high', 'No face detected');
            else if (dets.length > 1) emit('MULTIPLE_FACES', 'critical', `${dets.length} faces`);
          }

          if (needsEye && dets.length === 1 && dets[0].landmarks) {
            const lm = dets[0].landmarks;
            const lE = lm.getLeftEye?.() || [], rE = lm.getRightEye?.() || [], ns = lm.getNose?.() || [];
            if (lE.length && rE.length && ns.length) {
              const cx = (lE[0].x + rE[rE.length-1].x) / 2;
              const nx = ns[ns.length-1]?.x || cx;
              const fw = dets[0].detection?.box?.width || 200;
              if (Math.abs(nx - cx) / fw > 0.18) emit('GAZE_AWAY', 'medium', 'Gaze deviation');
            }
          }
        } catch { /* non-fatal */ }
      }

      // Object detection
      if (needsObj && cocoModel.current) {
        try {
          const preds = await cocoModel.current.detect(video, undefined, 0.45);
          const bad = ['cell phone','laptop','book','remote','keyboard','tablet'];
          const found = preds.filter(p => bad.includes(p.class));
          if (found.length) emit('OBJECT_DETECTED', 'high', found.map(f => f.class).join(', '));
        } catch { /* non-fatal */ }
      }
    };

    const iv = setInterval(detect, 4000);
    cleanups.current.push(() => clearInterval(iv));
  }, [config?.faceDetection, config?.eyeTracking, config?.objectDetection, emit]);

  // ── Main effect ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !config) return;
    cleanups.current = [];
    countRef.current = 0;
    debounce.current = {};
    stopped.current  = false;

    cleanups.current.push(setupBrowserLock(), setupFullscreenMonitor());
    startNoise();
    startCamera();

    return () => {
      stopped.current = true;
      cleanups.current.forEach(fn => { try { fn?.(); } catch {} });
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { videoRef };
};
