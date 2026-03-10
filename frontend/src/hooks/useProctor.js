// frontend/src/hooks/useProctor.js
// PROCTORING ENGINE v2 — Enhanced accuracy
//   - Violation COUNT — any type = +1, limit 3 → auto-submit
//   - Silent to student
//   - Dark camera (blocked/covered) detection → CAMERA_OBSCURED
//   - Blur/smeared camera detection → CAMERA_BLUR
//   - Enhanced face detection (lower threshold, works on low-spec cameras)
//   - Enhanced eye tracking (eye-corner vectors + nose deviation)
//   - Better object detection (expanded list, lower confidence threshold)
import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addEvent, setViolationCount } from '../features/proctor/proctorSlice';

export const VIOLATION_LIMIT = 3;

// ── Shared metadata ──────────────────────────────────────────────────────────
export const PROCTOR_META = {
  faceDetection: {
    key: 'faceDetection', icon: '👤', label: 'Face Detection',
    desc: 'Camera monitors that only your face is visible. If face disappears or multiple faces appear it is a violation.',
    needsCam: true,
    rule: 'Keep your face clearly visible in the camera at all times.',
    violationTypes: ['FACE_NOT_FOUND', 'MULTIPLE_FACES', 'CAMERA_OBSCURED', 'CAMERA_BLUR'],
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

// ── Permission helper ────────────────────────────────────────────────────────
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

export const getActiveProctors = (proctoring = {}) =>
  Object.entries(proctoring)
    .filter(([, v]) => v)
    .map(([k]) => PROCTOR_META[k])
    .filter(Boolean);

// ── Canvas helpers for camera quality analysis ───────────────────────────────
/**
 * Returns average brightness (0–255) of a video frame.
 * Uses a small offscreen canvas for performance.
 */
const getFrameBrightness = (video, canvas, ctx) => {
  try {
    const W = 80, H = 60; // small sample size for speed
    canvas.width = W; canvas.height = H;
    ctx.drawImage(video, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);
    let sum = 0;
    const total = W * H;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    return sum / total;
  } catch { return 128; } // neutral on error
};

/**
 * Returns a sharpness score using Laplacian variance on a small luma sample.
 * Higher = sharper. Low score on a "bright enough" frame = blur/obstruction.
 */
const getFrameSharpness = (video, canvas, ctx) => {
  try {
    const W = 80, H = 60;
    canvas.width = W; canvas.height = H;
    ctx.drawImage(video, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    // Build luma grid
    const luma = new Float32Array(W * H);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      luma[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    // Laplacian kernel approximation: variance of (pixel - avg of 4 neighbors)
    let variance = 0, count = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const lap = 4 * luma[idx]
          - luma[idx - 1] - luma[idx + 1]
          - luma[idx - W] - luma[idx + W];
        variance += lap * lap;
        count++;
      }
    }
    return count > 0 ? variance / count : 0;
  } catch { return 999; } // assume sharp on error
};

// ── useProctor ───────────────────────────────────────────────────────────────
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
  const countRef       = useRef(0);
  const cleanups       = useRef([]);
  const debounce       = useRef({});
  const stopped        = useRef(false);

  // Offscreen canvas (reused across frames to avoid GC pressure)
  const canvasRef      = useRef(null);
  const ctxRef         = useRef(null);

  // Stable refs so callbacks never need to re-create
  const subRef         = useRef(submissionId);
  const logRef         = useRef(logId);
  const socketRef      = useRef(socket);
  const enabledRef     = useRef(enabled);
  const limitCbRef     = useRef(onViolationLimit);

  useEffect(() => { subRef.current     = submissionId;    }, [submissionId]);
  useEffect(() => { logRef.current     = logId;           }, [logId]);
  useEffect(() => { socketRef.current  = socket;          }, [socket]);
  useEffect(() => { enabledRef.current = enabled;         }, [enabled]);
  useEffect(() => { limitCbRef.current = onViolationLimit;}, [onViolationLimit]);

  // ── Core emitter ────────────────────────────────────────────────────────────
  const emit = useCallback((type, severity, details) => {
    if (!enabledRef.current) return;
    if (!subRef.current || !logRef.current) return;
    if (stopped.current) return;

    // Debounce: same violation type at most once per 8 s
    const now = Date.now();
    if (now - (debounce.current[type] || 0) < 8_000) return;
    debounce.current[type] = now;

    const event = { type, severity, details, timestamp: new Date().toISOString() };
    dispatch(addEvent(event));

    countRef.current += 1;
    dispatch(setViolationCount(countRef.current));

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

  // ── Tab Switch / Browser Lock ────────────────────────────────────────────────
  const setupBrowserLock = useCallback(() => {
    if (!config?.tabSwitchLock) return () => {};
    const onVis  = () => { if (document.hidden) emit('TAB_SWITCH', 'high', 'Student left exam tab'); };
    const onCtx  = e => e.preventDefault();
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

  // ── Fullscreen Monitor ───────────────────────────────────────────────────────
  const setupFullscreenMonitor = useCallback(() => {
    if (!config?.fullScreenForce) return () => {};

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

  // ── Noise Detection ──────────────────────────────────────────────────────────
  const startNoise = useCallback(async () => {
    if (!config?.noiseDetection) return;

    const level = Number(config?.noiseSensitivity ?? 1);
    const THRESHOLDS = {
      0: { rms: 12, label: 'Low (any sound)' },
      1: { rms: 28, label: 'Medium (voices)' },
      2: { rms: 55, label: 'High (loud only)' },
    };
    const { rms: RMS_THRESHOLD } = THRESHOLDS[level] || THRESHOLDS[1];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext(); audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const checkInterval = level === 0 ? 3000 : level === 2 ? 5000 : 4000;

      const iv = setInterval(() => {
        if (stopped.current) { clearInterval(iv); return; }
        analyser.getByteFrequencyData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
        if (rms > RMS_THRESHOLD) {
          emit('NOISE_DETECTED', level === 0 ? 'medium' : 'low',
            `Noise RMS ${rms.toFixed(1)} > threshold ${RMS_THRESHOLD} [sensitivity=${level}]`);
        }
      }, checkInterval);

      cleanups.current.push(() => {
        clearInterval(iv);
        ctx.close().catch(() => {});
        stream.getTracks().forEach(t => t.stop());
      });
    } catch (e) { console.warn('Mic access failed:', e.message); }
  }, [config?.noiseDetection, config?.noiseSensitivity, emit]);

  // ── Camera Detection (face / eye / object + dark + blur) ─────────────────────
  const startCamera = useCallback(async () => {
    const needsFace = config?.faceDetection;
    const needsEye  = config?.eyeTracking;
    const needsObj  = config?.objectDetection;
    if (!needsFace && !needsEye && !needsObj) return;

    // Ensure offscreen canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      ctxRef.current    = canvasRef.current.getContext('2d');
    }

    // ── Lazy-load face-api.js ──
    const loadFaceApi = () => new Promise(res => {
      if (window.faceapi) { res(true); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
      s.onload = () => res(true); s.onerror = () => res(false);
      document.head.appendChild(s);
    });

    // ── Lazy-load TF + COCO-SSD ──
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
            (needsEye || needsFace)
              ? window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(URL)
              : Promise.resolve(),
          ]);
          faceApiLoaded.current = true;
        }
      }
      if (needsObj) {
        const ok = await loadCoco();
        if (ok && window.cocoSsd) cocoModel.current = await window.cocoSsd.load();
      }
    } catch (e) { console.warn('AI model load error:', e.message); }

    // ── Detection loop ──────────────────────────────────────────────────────
    const detect = async () => {
      if (stopped.current) return;
      const video = videoRef.current?.video || videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      // ── Step 1: Camera health checks (dark + blur) ──────────────────────
      const brightness  = getFrameBrightness(video, canvasRef.current, ctxRef.current);
      const DARK_THRESH = 15;   // < 15/255 = essentially pitch-black

      if (brightness < DARK_THRESH) {
        // Camera is blocked or completely dark — highest priority violation
        emit('CAMERA_OBSCURED', 'critical',
          `Camera appears dark/blocked (brightness=${brightness.toFixed(1)}). Possible finger/object covering lens.`);
        // Skip further detection since we can't see anything
        return;
      }

      // Blur check — only if camera is bright enough (i.e., scene is visible but blurry)
      const sharpness    = getFrameSharpness(video, canvasRef.current, ctxRef.current);
      const BLUR_THRESH  = 18;  // low Laplacian variance = blurry frame

      if (sharpness < BLUR_THRESH && brightness > 30) {
        // Frame is bright but very blurry — could be smeared lens/cream/tape
        emit('CAMERA_BLUR', 'high',
          `Camera feed is blurry/obscured (sharpness=${sharpness.toFixed(1)}). Possible lens obstruction.`);
      }

      // ── Step 2: Face/Eye detection ────────────────────────────────────────
      if (faceApiLoaded.current && window.faceapi) {
        try {
          // Lower score threshold (0.25) for low-quality cameras
          // Smaller inputSize (160) for performance on low-spec devices
          const opts = new window.faceapi.TinyFaceDetectorOptions({
            inputSize: 160,
            scoreThreshold: 0.25,
          });

          // Always load landmarks (even for face-only) so we can do extra checks
          const dets = await window.faceapi
            .detectAllFaces(video, opts)
            .withFaceLandmarks(true);

          if (needsFace) {
            if (dets.length === 0) {
              emit('FACE_NOT_FOUND', 'high',
                'No face detected (camera is visible but no person found).');
            } else if (dets.length > 1) {
              emit('MULTIPLE_FACES', 'critical', `${dets.length} faces detected`);
            }
          }

          // ── Step 3: Enhanced eye tracking ──────────────────────────────────
          if (needsEye && dets.length === 1 && dets[0].landmarks) {
            const lm = dets[0].landmarks;
            const lE = lm.getLeftEye?.()   || [];
            const rE = lm.getRightEye?.()  || [];
            const ns = lm.getNose?.()      || [];
            const mo = lm.getMouth?.()     || [];

            if (lE.length >= 4 && rE.length >= 4 && ns.length >= 1) {
              const fw = dets[0].detection?.box?.width || 200;

              // Gaze method 1: nose deviation from eye midpoint (horizontal)
              const eyeMidX  = (lE[0].x + rE[rE.length - 1].x) / 2;
              const noseX    = ns[ns.length - 1]?.x ?? eyeMidX;
              const noseDeviation = Math.abs(noseX - eyeMidX) / fw;

              // Gaze method 2: eye-corner direction vector
              // Left eye spans lE[0] (inner) → lE[3] (outer), right eye rE[0]→rE[3]
              const lEyeVecX = lE[3].x - lE[0].x;
              const rEyeVecX = rE[3].x - rE[0].x;
              // If right eye is compressed horizontally, person is looking right (and vice versa)
              const eyeRatio = fw > 0
                ? Math.abs(lEyeVecX - rEyeVecX) / fw
                : 0;

              // Mouth center for vertical gaze (looking down at phone below camera)
              let lookingDown = false;
              if (mo.length >= 2) {
                const mouthCenterY = (mo[0].y + mo[mo.length - 1].y) / 2;
                const eyesCenterY  = (lE[0].y + rE[0].y) / 2;
                const faceHeight   = dets[0].detection?.box?.height || 200;
                // If mouth-to-eye vertical ratio is unusually large, head is tilted down
                const vertRatio    = (mouthCenterY - eyesCenterY) / faceHeight;
                lookingDown        = vertRatio > 0.55;
              }

              // Trigger if any gaze signal is strong enough
              const NOSE_THRESH  = 0.15;  // horizontal nose shift
              const RATIO_THRESH = 0.12;  // eye-corner asymmetry
              if (noseDeviation > NOSE_THRESH || eyeRatio > RATIO_THRESH || lookingDown) {
                emit('GAZE_AWAY', 'medium',
                  `Gaze deviation detected (nose_dev=${noseDeviation.toFixed(2)}, eye_ratio=${eyeRatio.toFixed(2)}, lookDown=${lookingDown})`);
              }
            }
          }
        } catch { /* non-fatal */ }
      }

      // ── Step 4: Object detection ─────────────────────────────────────────
      if (needsObj && cocoModel.current) {
        try {
          // Lower confidence (0.35 from 0.45) to catch more objects on low-quality video
          const preds = await cocoModel.current.detect(video, undefined, 0.35);
          const badItems = [
            'cell phone', 'laptop', 'book', 'remote', 'keyboard',
            'tablet', 'mouse', 'tv', 'monitor', 'earphone',
          ];
          const found = preds.filter(p => badItems.includes(p.class));
          if (found.length) {
            emit('OBJECT_DETECTED', 'high',
              `Prohibited item(s) detected: ${found.map(f => f.class).join(', ')}`);
          }
        } catch { /* non-fatal */ }
      }
    };

    // Run every 5 s (slightly longer to avoid overwhelming low-spec CPUs)
    const iv = setInterval(detect, 5000);
    cleanups.current.push(() => clearInterval(iv));
  }, [config?.faceDetection, config?.eyeTracking, config?.objectDetection, emit]);

  // ── Main effect ──────────────────────────────────────────────────────────────
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
