// frontend/src/hooks/useProctor.js
// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE TIERED DETECTION PIPELINE
//
// TIER 1 — HIGH-END  (WebGL + FPS ≥ 10): 640×480, BlazeFace 128px, COCO-SSD full,  150ms interval, 0.50 threshold, 3-frame avg
// TIER 2 — MID-RANGE (WASM  or FPS 5–9): 320×240, BlazeFace 64px,  COCO-SSD lite,  250ms interval, 0.45 threshold, 5-frame avg
// TIER 3 — LOW-END   (CPU   or FPS 3–4): 320×240, BlazeFace only,  no object,       400ms interval, 0.40 threshold, 5-frame majority
// FALLBACK — AUDIO-ONLY (FPS < 3 OR mem > 80% OR avg confidence < 0.3 for 10s):
//            Stop all video inference, keep noiseDetection + tabSwitchLock + fullScreenForce
//
// VIOLATION LOGIC (identical to original):
//   FACE_NOT_FOUND, MULTIPLE_FACES, GAZE_AWAY, OBJECT_DETECTED
//   TAB_SWITCH, COPY_ATTEMPT, FULLSCREEN_EXIT, NOISE_DETECTED, DEVTOOLS_ATTEMPT
//
// DEBUG OVERLAY (remove for production — search "DEBUG_PROCTORING"):
//   Camera live view + detection annotations + audio waveform visualiser
//   To disable: set DEBUG_PROCTORING = false below
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addEvent, setViolationCount } from '../features/proctor/proctorSlice';

// ══════════════════════════════════════════════════════════════════
//  🔧 DEBUG FLAG — set false to remove all debug UI before shipping
// ══════════════════════════════════════════════════════════════════
const DEBUG_PROCTORING = true;

export const VIOLATION_LIMIT = 3;

// Per-type debounce – camera violations upgraded from 1000ms → 10 000ms
const DEBOUNCE_MS = {
  TAB_SWITCH:        1000,
  COPY_ATTEMPT:      1000,
  DEVTOOLS_ATTEMPT:  1000,
  FULLSCREEN_EXIT:   1000,
  FUNCTION_KEY:      1000,
  FACE_NOT_FOUND:    10000,
  MULTIPLE_FACES:    10000,
  GAZE_AWAY:         10000,
  NOISE_DETECTED:    10000,   // enhanced: exam-hall sensitivity
  OBJECT_DETECTED:   10000,
};
const DEFAULT_DEBOUNCE_MS = 1000;

const BLOCKED_FKEYS = new Set([
  'F1','F2','F3','F4','F5','F6','F7','F8','F9','F10','F11','F12',
]);
const BLOCKED_CTRL_KEYS = new Set([
  'c','v','a','x','u','s','p',
  't','n','w','r',
]);
const FORBIDDEN_OBJECTS = new Set([
  'cell phone','laptop','book','remote','tablet','knife','scissors',
]);

// ─────────────────────────────────────────────────────────────────
// Tier configuration map
// ─────────────────────────────────────────────────────────────────
const TIERS = {
  1: { w: 640, h: 480, faceInputSize: 128, cocoLite: false, interval: 150, threshold: 0.50, frames: 3, label: 'TIER-1 HIGH-END'  },
  2: { w: 320, h: 240, faceInputSize:  64, cocoLite: true,  interval: 250, threshold: 0.45, frames: 5, label: 'TIER-2 MID-RANGE' },
  3: { w: 320, h: 240, faceInputSize:  64, cocoLite: false, interval: 400, threshold: 0.40, frames: 5, label: 'TIER-3 LOW-END'   },
};

// ─────────────────────────────────────────────────────────────────
// CDN loaders (identical pattern to current hook)
// ─────────────────────────────────────────────────────────────────
const loadScript = (src) => new Promise((res) => {
  if (document.querySelector(`script[src="${src}"]`)) { res(true); return; }
  const s = document.createElement('script');
  s.src = src; s.onload = () => res(true); s.onerror = () => res(false);
  document.head.appendChild(s);
});

const loadTFjs = () => loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
const loadBlazeFace = () => loadTFjs().then(ok => ok
  ? loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface')
  : false
);
const loadCocoSsd = () => loadTFjs().then(ok => ok
  ? loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd')
  : false
);

// ─────────────────────────────────────────────────────────────────
// Circular buffer helper
// ─────────────────────────────────────────────────────────────────
class CircularBuffer {
  constructor(size) { this.size = size; this.buf = []; }
  push(v) { this.buf.push(v); if (this.buf.length > this.size) this.buf.shift(); }
  get length() { return this.buf.length; }
  majority(predicate) {
    if (!this.buf.length) return false;
    return this.buf.filter(predicate).length > this.buf.length / 2;
  }
  average(fn) {
    if (!this.buf.length) return 0;
    return this.buf.reduce((s, v) => s + fn(v), 0) / this.buf.length;
  }
}

// ═══════════════════════════════════════════════════════════════════
// PROCTOR_META — unchanged structure, single source of truth
// ═══════════════════════════════════════════════════════════════════
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
    desc: 'Microphone listens for any sounds in the exam room — even quiet whispers or rustling.',
    needsMic: true,
    rule: 'Sit in complete silence. Any sound — voice, rustling, or movement — is a violation.',
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
    desc: 'Switching browser tabs, minimising, Alt+Tab, or copy/paste attempts are detected.',
    needsCam: false, needsMic: false,
    rule: 'Do not switch tabs, minimise the browser, or use Ctrl+C/V/T/N.',
    violationTypes: ['TAB_SWITCH', 'COPY_ATTEMPT', 'DEVTOOLS_ATTEMPT', 'FUNCTION_KEY'],
  },
  fullScreenForce: {
    key: 'fullScreenForce', icon: '⛶', label: 'Fullscreen Mode',
    desc: 'The exam must be taken in full-screen mode. Exiting fullscreen is a violation.',
    needsCam: false, needsMic: false, needsFullscreen: true,
    rule: 'Keep the browser in full-screen mode for the entire exam.',
    violationTypes: ['FULLSCREEN_EXIT'],
  },
};

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

// ═══════════════════════════════════════════════════════════════════
// useProctor — main hook
// ═══════════════════════════════════════════════════════════════════
export const useProctor = ({
  socket, submissionId, logId, examId,
  config = {}, enabled = false,
  onViolationLimit,
}) => {
  const dispatch = useDispatch();

  // ── Core refs ─────────────────────────────────────────────────
  const videoRef        = useRef(null);
  const audioCtxRef     = useRef(null);
  const countRef        = useRef(0);
  const cleanups        = useRef([]);
  const debounce        = useRef({});
  const stopped         = useRef(false);
  const audioOnlyModeRef = useRef(false);   // ← NEW export

  // Tier state
  const currentTierRef  = useRef(null);     // 1 | 2 | 3 | 'audio'
  const blazeModelRef   = useRef(null);
  const cocoModelRef    = useRef(null);
  const tensorBaselineRef = useRef(null);

  // Rolling FPS tracking (circular buffer of timestamps, 5 slots)
  const fpsBufferRef    = useRef(new CircularBuffer(5));
  const lastFpsCheckRef = useRef(Date.now());
  const tierDegradeTimerRef = useRef(null);   // ms since FPS dropped below threshold

  // Rolling confidence tracking (10s window)
  const confBufferRef   = useRef(new CircularBuffer(20)); // ~10s at 500ms intervals
  const lowConfStartRef = useRef(null);

  // Multi-frame buffers per detection type
  const frameFaceCountRef  = useRef(new CircularBuffer(5));
  const frameGazeRef       = useRef(new CircularBuffer(5));
  const frameObjRef        = useRef(new CircularBuffer(5));

  // Debug overlay refs
  const debugCanvasRef  = useRef(null);
  const debugCtxRef     = useRef(null);
  const audioCanvasRef  = useRef(null);
  const audioDebugCtxRef = useRef(null);
  const analyserDebugRef = useRef(null);
  const debugAnimRef    = useRef(null);

  // Stable refs
  const subRef    = useRef(submissionId);
  const logRef    = useRef(logId);
  const socketRef = useRef(socket);
  const enabledRef = useRef(enabled);
  const limitCbRef = useRef(onViolationLimit);

  useEffect(() => { subRef.current     = submissionId;   }, [submissionId]);
  useEffect(() => { logRef.current     = logId;          }, [logId]);
  useEffect(() => { socketRef.current  = socket;         }, [socket]);
  useEffect(() => { enabledRef.current = enabled;        }, [enabled]);
  useEffect(() => { limitCbRef.current = onViolationLimit; }, [onViolationLimit]);

  // ── Core emitter (unchanged logic) ────────────────────────────
  const emit = useCallback((type, severity, details) => {
    if (!enabledRef.current) return;
    if (!subRef.current || !logRef.current) return;
    if (stopped.current) return;

    const now = Date.now();
    const cooldown = DEBOUNCE_MS[type] ?? DEFAULT_DEBOUNCE_MS;
    if (now - (debounce.current[type] || 0) < cooldown) return;
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

  // ── Tab Switch / Browser Lock (UNCHANGED) ─────────────────────
  const setupBrowserLock = useCallback(() => {
    if (!config?.tabSwitchLock) return () => {};

    const onVis  = () => { if (document.hidden) emit('TAB_SWITCH', 'high', 'Student left exam tab'); };
    const onBlur = () => emit('TAB_SWITCH', 'high', 'Window lost focus (Alt+Tab / minimize)');
    const onCtx  = e => e.preventDefault();
    const onClip = e => { e.preventDefault(); emit('COPY_ATTEMPT', 'medium', `${e.type} blocked`); };
    const onKey  = e => {
      if (BLOCKED_FKEYS.has(e.key)) {
        e.preventDefault();
        if (e.key === 'F12') emit('DEVTOOLS_ATTEMPT', 'critical', 'F12 (DevTools) pressed');
        else                  emit('FUNCTION_KEY', 'medium', `${e.key} pressed`);
        return;
      }
      if (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        emit('DEVTOOLS_ATTEMPT', 'critical', `Ctrl+Shift+${e.key.toUpperCase()} attempt`);
        return;
      }
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        emit('TAB_SWITCH', 'high', 'Ctrl+Tab pressed');
        return;
      }
      if (e.ctrlKey && BLOCKED_CTRL_KEYS.has(e.key.toLowerCase())) {
        e.preventDefault();
        const navKeys = new Set(['t','n','w','r']);
        if (navKeys.has(e.key.toLowerCase()))
          emit('TAB_SWITCH', 'high', `Ctrl+${e.key.toUpperCase()} blocked`);
        else
          emit('COPY_ATTEMPT', 'medium', `Ctrl+${e.key.toUpperCase()} blocked`);
      }
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('contextmenu', onCtx);
    document.addEventListener('copy', onClip);
    document.addEventListener('cut', onClip);
    document.addEventListener('paste', onClip);
    document.addEventListener('keydown', onKey);
    document.onselectstart = () => false;
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('contextmenu', onCtx);
      document.removeEventListener('copy', onClip);
      document.removeEventListener('cut', onClip);
      document.removeEventListener('paste', onClip);
      document.removeEventListener('keydown', onKey);
      document.onselectstart = null;
      document.body.style.userSelect = '';
    };
  }, [config?.tabSwitchLock, emit]);

  // ── Fullscreen Monitor (UNCHANGED) ──────────────────────────────
  const setupFullscreenMonitor = useCallback(() => {
    if (!config?.fullScreenForce) return () => {};

    const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const requestFS = () => {
      const el = document.documentElement;
      const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
      fn?.call(el)?.catch(() => {});
    };

    if (!isFS()) requestFS();
    let wasFS = isFS();

    const handleFSExit = () => {
      if (wasFS && !isFS() && !stopped.current) {
        emit('FULLSCREEN_EXIT', 'high', 'Exited fullscreen during exam');
        wasFS = false;
        setTimeout(requestFS, 500);
      } else {
        wasFS = isFS();
      }
    };

    document.addEventListener('fullscreenchange', handleFSExit);
    document.addEventListener('webkitfullscreenchange', handleFSExit);
    const poll = setInterval(() => { if (stopped.current) { clearInterval(poll); return; } handleFSExit(); }, 2000);

    return () => {
      clearInterval(poll);
      document.removeEventListener('fullscreenchange', handleFSExit);
      document.removeEventListener('webkitfullscreenchange', handleFSExit);
    };
  }, [config?.fullScreenForce, emit]);

  // ══════════════════════════════════════════════════════════════
  // ── ENHANCED NOISE DETECTION (exam-hall sensitivity) ──────────
  // ══════════════════════════════════════════════════════════════
  // Detects ANY sound — whispers, paper rustling, keystrokes.
  // When ONLY noiseDetection is enabled (no camera-based proctors),
  // the threshold is at its most sensitive (exam-hall mode).
  // Debug: shows live audio waveform canvas.
  const startNoise = useCallback(async () => {
    if (!config?.noiseDetection) return;

    const cameraEnabled = config?.faceDetection || config?.eyeTracking || config?.objectDetection;
    // In exam-hall mode (noise only), threshold is ultra-low
    const RMS_THRESHOLD = cameraEnabled ? 25 : 8;  // exam-hall: catches whispers/rustling
    const CHECK_INTERVAL_MS = cameraEnabled ? 2000 : 800; // faster poll in noise-only mode

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext(); audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);

      // Store analyser for debug waveform
      analyserDebugRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      let silenceStreak = 0;

      const iv = setInterval(() => {
        if (stopped.current) { clearInterval(iv); return; }
        analyser.getByteFrequencyData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);

        if (DEBUG_PROCTORING) {
          // update label on debug overlay
          const el = document.getElementById('__proctor_debug_noise_rms__');
          if (el) el.textContent = `RMS: ${rms.toFixed(1)} / threshold: ${RMS_THRESHOLD}`;
        }

        if (rms > RMS_THRESHOLD) {
          silenceStreak = 0;
          const context = cameraEnabled
            ? `Sound detected (RMS ${rms.toFixed(1)})`
            : `Exam-room sound detected (RMS ${rms.toFixed(1)}) — any noise is a violation`;
          emit('NOISE_DETECTED', rms > 60 ? 'high' : 'medium', context);
        } else {
          silenceStreak++;
        }
      }, CHECK_INTERVAL_MS);

      cleanups.current.push(() => {
        clearInterval(iv);
        ctx.close().catch(() => {});
        stream.getTracks().forEach(t => t.stop());
        analyserDebugRef.current = null;
      });

      // DEBUG: audio waveform canvas
      if (DEBUG_PROCTORING) _startAudioDebugOverlay(analyser);

    } catch (e) {
      console.warn('[Proctor] Mic access failed:', e.message);
    }
  }, [config?.noiseDetection, config?.faceDetection, config?.eyeTracking, config?.objectDetection, emit]);

  // ══════════════════════════════════════════════════════════════
  // ── HARDWARE CAPABILITY CHECK ──────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  const measureHardwareTier = useCallback(async () => {
    // 1. Load TF.js to inspect backend
    await loadTFjs();
    const tf = window.tf;
    if (!tf) return 'audio';

    // Wait for TF to pick backend
    await tf.ready();
    const backend = tf.getBackend(); // 'webgl' | 'wasm' | 'cpu'

    // 2. Measure baseline FPS using dummy canvas draw over 2 seconds
    const offscreen = document.createElement('canvas');
    offscreen.width = 320; offscreen.height = 240;
    const octx = offscreen.getContext('2d');
    let frames = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const loop = () => {
        if (performance.now() - t0 >= 2000) { res(); return; }
        octx.fillRect(0, 0, 320, 240);
        frames++;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const fps = frames / 2; // frames per second

    // 3. Check memory pressure
    const mem = performance.memory;
    const memRatio = mem ? mem.usedJSHeapSize / mem.jsHeapSizeLimit : 0;

    console.log(`[Proctor] Backend: ${backend}, FPS: ${fps.toFixed(1)}, MemRatio: ${memRatio.toFixed(2)}`);

    if (fps < 3 || memRatio > 0.8) return 'audio';
    if (backend === 'webgl' && fps >= 10) return 1;
    if (backend === 'wasm' || (fps >= 5 && fps < 10)) return 2;
    if (fps >= 3 && fps < 5) return 3;
    return 3;
  }, []);

  // ══════════════════════════════════════════════════════════════
  // ── AUDIO-ONLY FALLBACK ────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  const switchToAudioOnly = useCallback((reason) => {
    if (audioOnlyModeRef.current) return; // already switched
    audioOnlyModeRef.current = true;
    currentTierRef.current = 'audio';

    console.warn('[Proctor] Switching to AUDIO-ONLY:', reason);

    // Non-blocking toast
    try {
      // dynamic import to avoid hard dep — toast is already in ExamRoom
      if (window.__proctorToast__) {
        window.__proctorToast__(`⚠️ Low performance detected. Switching to audio monitoring.`, { autoClose: 5000 });
      }
    } catch {}

    // Emit status ping every 30s
    const pingIv = setInterval(() => {
      socketRef.current?.emit('proctor:status', {
        submissionId: subRef.current,
        audioOnly: true,
        reason,
      });
    }, 30000);
    cleanups.current.push(() => clearInterval(pingIv));

    if (DEBUG_PROCTORING) {
      const el = document.getElementById('__proctor_debug_tier__');
      if (el) el.textContent = '🔴 AUDIO-ONLY MODE';
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // ── CANVAS PRE-PROCESSING ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  const drawPreprocessedFrame = (video, canvas) => {
    const ctx = canvas.getContext('2d');
    // Apply CSS filter for contrast/brightness enhancement
    ctx.filter = 'contrast(1.2) brightness(1.05)';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    return canvas;
  };

  // ══════════════════════════════════════════════════════════════
  // ── CAMERA DETECTION: ADAPTIVE TIERED PIPELINE ────────────────
  // ══════════════════════════════════════════════════════════════
  const startCamera = useCallback(async () => {
    const needsFace = config?.faceDetection;
    const needsEye  = config?.eyeTracking;
    const needsObj  = config?.objectDetection;
    if (!needsFace && !needsEye && !needsObj) return;

    // ── 1. Hardware capability check ──────────────────────────────
    const tierNum = await measureHardwareTier();
    if (tierNum === 'audio') {
      switchToAudioOnly('FPS < 3 or memory > 80% at startup');
      return;
    }

    currentTierRef.current = tierNum;
    const tier = TIERS[tierNum];
    console.log(`[Proctor] Selected ${tier.label}`);

    if (DEBUG_PROCTORING) {
      const el = document.getElementById('__proctor_debug_tier__');
      if (el) el.textContent = `${tier.label} | interval: ${tier.interval}ms`;
    }

    // ── 2. Load models based on tier ──────────────────────────────
    let blazeLoaded = false;
    if (needsFace || needsEye) {
      const ok = await loadBlazeFace();
      if (ok && window.blazeface) {
        blazeModelRef.current = await window.blazeface.load({
          maxFaces: 4,
          inputWidth:  tier.faceInputSize,
          inputHeight: tier.faceInputSize,
          scoreThreshold: tier.threshold,
        });
        blazeLoaded = true;
        console.log('[Proctor] BlazeFace loaded at', tier.faceInputSize, 'px');
      }
    }

    // Tier 3 disables object detection
    if (needsObj && tierNum < 3) {
      const ok = await loadCocoSsd();
      if (ok && window.cocoSsd) {
        cocoModelRef.current = await window.cocoSsd.load();
        console.log('[Proctor] COCO-SSD loaded');
      }
    }

    // Tensor leak baseline
    const tf = window.tf;
    tensorBaselineRef.current = tf ? tf.memory().numTensors : 0;

    // ── 3. Offscreen preprocessing canvas ─────────────────────────
    const offCanvas = document.createElement('canvas');
    offCanvas.width  = tier.w;
    offCanvas.height = tier.h;

    // Resize multi-frame buffers to tier's window size
    frameFaceCountRef.current = new CircularBuffer(tier.frames);
    frameGazeRef.current      = new CircularBuffer(tier.frames);
    frameObjRef.current       = new CircularBuffer(tier.frames);

    // ── 4. Rolling FPS tracker ─────────────────────────────────────
    let fpsWindowFrames = 0;
    let degradeMs       = 0;
    const tierFpsThreshold = tierNum === 1 ? 10 : tierNum === 2 ? 5 : 3;

    // ── 5. Detection loop ──────────────────────────────────────────
    const detect = async () => {
      if (stopped.current || audioOnlyModeRef.current) return;

      const video = videoRef.current?.video || videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      // FPS measurement
      const now = Date.now();
      fpsWindowFrames++;
      if (now - lastFpsCheckRef.current >= 5000) {
        const rollingFps = fpsWindowFrames / 5;
        fpsBufferRef.current.push(rollingFps);
        fpsWindowFrames = 0;
        lastFpsCheckRef.current = now;

        if (DEBUG_PROCTORING) {
          const el = document.getElementById('__proctor_debug_fps__');
          if (el) el.textContent = `FPS: ${rollingFps.toFixed(1)}`;
        }

        // Mid-session degradation
        if (rollingFps < tierFpsThreshold) {
          degradeMs += 5000;
          if (degradeMs >= 15000) {
            if (currentTierRef.current < 3) {
              const nextTier = currentTierRef.current + 1;
              console.warn(`[Proctor] Downgrading to TIER-${nextTier}`);
              currentTierRef.current = nextTier;
              degradeMs = 0;
              if (DEBUG_PROCTORING) {
                const el = document.getElementById('__proctor_debug_tier__');
                if (el) el.textContent = `TIER-${nextTier} (degraded) | interval: ${TIERS[nextTier].interval}ms`;
              }
            } else {
              // Already at tier 3 — check for audio-only
              if (rollingFps < 3) switchToAudioOnly('Rolling FPS < 3 mid-session');
            }
          }
        } else {
          degradeMs = 0;
        }

        // Memory check
        const mem = performance.memory;
        if (mem && mem.usedJSHeapSize / mem.jsHeapSizeLimit > 0.8) {
          switchToAudioOnly('JS heap usage > 80%');
          return;
        }

        // Confidence-based fallback (checked after aggregation below)
        const avgConf = confBufferRef.current.average(v => v);
        if (confBufferRef.current.length >= 10 && avgConf < 0.3) {
          if (!lowConfStartRef.current) lowConfStartRef.current = now;
          else if (now - lowConfStartRef.current >= 10000) {
            switchToAudioOnly('Average model confidence < 0.3 for 10s');
            return;
          }
        } else {
          lowConfStartRef.current = null;
        }
      }

      // Pre-process frame
      drawPreprocessedFrame(video, offCanvas);

      // ── BlazeFace inference ──────────────────────────────────────
      if (blazeLoaded && blazeModelRef.current && tf) {
        try {
          let faceCount = 0;
          let gazeDeviating = false;

          tf.tidy(() => {
            // (We can't use async inside tidy so we schedule below)
          });

          const tensor = tf.browser.fromPixels(offCanvas);
          const predictions = await blazeModelRef.current.estimateFaces(tensor, false);
          tensor.dispose();

          // Tensor leak guard
          const currentTensors = tf.memory().numTensors;
          if (currentTensors - tensorBaselineRef.current > 20) {
            tf.disposeVariables();
            tensorBaselineRef.current = tf.memory().numTensors;
          }

          faceCount = predictions.length;

          // Track confidence
          if (predictions.length > 0) {
            const avgConf = predictions.reduce((s, p) => s + (p.probability?.[0] ?? 0.5), 0) / predictions.length;
            confBufferRef.current.push(avgConf);
          } else {
            confBufferRef.current.push(0);
          }

          // Gaze check (only Tier 1 & 2, and only if eye tracking enabled)
          if (needsEye && faceCount === 1 && tierNum <= 2) {
            const face = predictions[0];
            if (face.landmarks && face.landmarks.length >= 2) {
              // landmarks[0] = right eye, landmarks[1] = left eye
              const rightEye = face.landmarks[0];
              const leftEye  = face.landmarks[1];
              const boxWidth = (face.bottomRight[0] - face.topLeft[0]);
              const eyeMidX  = (rightEye[0] + leftEye[0]) / 2;
              const faceMidX = (face.topLeft[0] + face.bottomRight[0]) / 2;
              const deviation = Math.abs(eyeMidX - faceMidX) / (boxWidth || 200);
              gazeDeviating = deviation > 0.18;
            }
          }

          // Push to frame buffers
          frameFaceCountRef.current.push(faceCount);
          frameGazeRef.current.push(gazeDeviating);

          // Majority-vote violations
          const windowSize = TIERS[currentTierRef.current]?.frames || tier.frames;
          const faceBuffer = frameFaceCountRef.current;
          const gazeBuffer = frameGazeRef.current;

          if (faceBuffer.length >= Math.min(windowSize, 2)) {
            if (needsFace) {
              if (faceBuffer.majority(n => n === 0)) emit('FACE_NOT_FOUND', 'high', 'No face detected');
              else if (faceBuffer.majority(n => n > 1)) emit('MULTIPLE_FACES', 'critical', 'Multiple faces detected');
            }
            if (needsEye && gazeBuffer.length >= Math.min(windowSize, 2)) {
              if (gazeBuffer.majority(v => v === true)) emit('GAZE_AWAY', 'medium', 'Gaze deviation detected');
            }
          }

          // ── DEBUG: annotate camera overlay ──────────────────────
          if (DEBUG_PROCTORING && debugCtxRef.current && debugCanvasRef.current) {
            _drawDebugAnnotations(predictions, gazeDeviating, offCanvas);
          }

        } catch (e) { /* non-fatal */ }
      }

      // ── COCO-SSD inference (Tier 1 & 2 only) ──────────────────
      if (needsObj && cocoModelRef.current && currentTierRef.current <= 2) {
        try {
          const preds = await cocoModelRef.current.detect(offCanvas, undefined, TIERS[currentTierRef.current]?.threshold || 0.45);
          const badItems = preds.filter(p => FORBIDDEN_OBJECTS.has(p.class));
          frameObjRef.current.push(badItems.map(p => p.class));

          const objBuffer = frameObjRef.current;
          if (objBuffer.length >= Math.min(tier.frames, 2)) {
            if (objBuffer.majority(arr => arr.length > 0)) {
              const allFound = objBuffer.buf.flat();
              const unique   = [...new Set(allFound)];
              emit('OBJECT_DETECTED', 'high', unique.join(', '));
            }
          }

          // ── DEBUG: draw object boxes ──────────────────────────
          if (DEBUG_PROCTORING && debugCtxRef.current && preds.length) {
            _drawObjectBoxes(preds, offCanvas);
          }
        } catch (e) { /* non-fatal */ }
      }
    };

    const intervalMs = TIERS[currentTierRef.current]?.interval || tier.interval;
    const iv = setInterval(detect, intervalMs);
    cleanups.current.push(() => clearInterval(iv));

    // ── DEBUG: start live camera preview ──────────────────────────
    if (DEBUG_PROCTORING) _startCameraDebugOverlay(offCanvas);

  }, [
    config?.faceDetection, config?.eyeTracking, config?.objectDetection,
    emit, measureHardwareTier, switchToAudioOnly,
  ]);

  // ══════════════════════════════════════════════════════════════
  // ── DEBUG OVERLAY FUNCTIONS ────────────────────────────────────
  // 🔧 Remove all _debug* functions and the DEBUG_PROCTORING block
  //    in the main effect to disable debug UI for production
  // ══════════════════════════════════════════════════════════════

  function _startCameraDebugOverlay(sourceCanvas) {
    // Create debug panel
    const panel = document.createElement('div');
    panel.id = '__proctor_debug_panel__';
    Object.assign(panel.style, {
      position: 'fixed', bottom: '12px', right: '12px', zIndex: '99999',
      background: 'rgba(0,0,0,0.82)', border: '1.5px solid #00ff99',
      borderRadius: '10px', padding: '8px', fontFamily: 'monospace',
      fontSize: '11px', color: '#00ff99', userSelect: 'none',
      backdropFilter: 'blur(4px)', minWidth: '240px',
      boxShadow: '0 0 20px rgba(0,255,100,0.3)',
    });
    panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;font-size:12px;color:#aaffcc;">
        🔍 PROCTOR DEBUG
        <span style="font-size:9px;color:#888;float:right;">remove: DEBUG_PROCTORING=false</span>
      </div>
      <div id="__proctor_debug_tier__" style="color:#ffee55;margin-bottom:3px;">Initialising…</div>
      <div id="__proctor_debug_fps__" style="color:#55bbff;margin-bottom:3px;">FPS: —</div>
      <div id="__proctor_debug_noise_rms__" style="color:#ff9944;margin-bottom:6px;">RMS: —</div>
      <canvas id="__proctor_debug_cam__" width="200" height="150"
        style="display:block;border:1px solid #00ff99;border-radius:4px;margin-bottom:4px;"></canvas>
      <canvas id="__proctor_debug_audio__" width="200" height="50"
        style="display:block;border:1px solid #ff9944;border-radius:4px;"></canvas>
    `;
    document.body.appendChild(panel);

    const camCanvas = document.getElementById('__proctor_debug_cam__');
    debugCanvasRef.current  = camCanvas;
    debugCtxRef.current     = camCanvas.getContext('2d');
    const audioCanvas = document.getElementById('__proctor_debug_audio__');
    audioCanvasRef.current  = audioCanvas;
    audioDebugCtxRef.current = audioCanvas.getContext('2d');

    // Mirror live video to debug canvas
    const draw = () => {
      if (!stopped.current && sourceCanvas) {
        debugCtxRef.current?.drawImage(sourceCanvas, 0, 0, 200, 150);
      }
      debugAnimRef.current = requestAnimationFrame(draw);
    };
    debugAnimRef.current = requestAnimationFrame(draw);

    cleanups.current.push(() => {
      cancelAnimationFrame(debugAnimRef.current);
      document.getElementById('__proctor_debug_panel__')?.remove();
    });
  }

  function _startAudioDebugOverlay(analyser) {
    // Waveform animation — runs independently of camera overlay
    const drawWave = () => {
      const canvas = audioCanvasRef.current;
      const ctx    = audioDebugCtxRef.current;
      if (!canvas || !ctx || !analyserDebugRef.current) {
        requestAnimationFrame(drawWave); return;
      }
      const bufLen = analyser.frequencyBinCount;
      const data   = new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(data);

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth   = 1.5;
      ctx.strokeStyle = '#ff9944';
      ctx.beginPath();
      const sliceW = canvas.width / bufLen;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const v = data[i] / 128.0;
        const y = (v * canvas.height) / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
      if (!stopped.current) requestAnimationFrame(drawWave);
    };
    drawWave();
  }

  function _drawDebugAnnotations(predictions, gazeDeviating, sourceCanvas) {
    const canvas = debugCanvasRef.current;
    const ctx    = debugCtxRef.current;
    if (!canvas || !ctx) return;
    const scaleX = canvas.width  / sourceCanvas.width;
    const scaleY = canvas.height / sourceCanvas.height;

    predictions.forEach((face, i) => {
      const [x, y] = face.topLeft;
      const [x2, y2] = face.bottomRight;
      const w = (x2 - x) * scaleX, h = (y2 - y) * scaleY;
      ctx.strokeStyle = predictions.length > 1 ? '#ff4444' : gazeDeviating ? '#ffaa00' : '#00ff99';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * scaleX, y * scaleY, w, h);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = '9px monospace';
      const prob = face.probability?.[0];
      ctx.fillText(`Face ${i + 1} ${prob != null ? (prob * 100).toFixed(0) + '%' : ''}`, x * scaleX, y * scaleY - 2);
    });
  }

  function _drawObjectBoxes(preds, sourceCanvas) {
    const canvas = debugCanvasRef.current;
    const ctx    = debugCtxRef.current;
    if (!canvas || !ctx) return;
    const scaleX = canvas.width  / sourceCanvas.width;
    const scaleY = canvas.height / sourceCanvas.height;

    preds.filter(p => FORBIDDEN_OBJECTS.has(p.class)).forEach(p => {
      const [bx, by, bw, bh] = p.bbox;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx * scaleX, by * scaleY, bw * scaleX, bh * scaleY);
      ctx.fillStyle = 'rgba(255,68,68,0.7)';
      ctx.font = '9px monospace';
      ctx.fillText(`${p.class} ${(p.score * 100).toFixed(0)}%`, bx * scaleX, by * scaleY - 2);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // ── MAIN EFFECT ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!enabled || !config) return;

    cleanups.current      = [];
    countRef.current      = 0;
    debounce.current      = {};
    stopped.current       = false;
    audioOnlyModeRef.current = false;
    currentTierRef.current   = null;
    blazeModelRef.current    = null;
    cocoModelRef.current     = null;
    lowConfStartRef.current  = null;
    fpsBufferRef.current     = new CircularBuffer(5);
    confBufferRef.current    = new CircularBuffer(20);
    frameFaceCountRef.current = new CircularBuffer(5);
    frameGazeRef.current     = new CircularBuffer(5);
    frameObjRef.current      = new CircularBuffer(5);
    lastFpsCheckRef.current  = Date.now();

    cleanups.current.push(setupBrowserLock(), setupFullscreenMonitor());
    startNoise();
    startCamera();

    return () => {
      stopped.current = true;
      cleanups.current.forEach(fn => { try { fn?.(); } catch {} });
      audioCtxRef.current?.close().catch(() => {});
      // Clean up debug panel if still mounted
      document.getElementById('__proctor_debug_panel__')?.remove();
      cancelAnimationFrame(debugAnimRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const stopProctoring = useCallback(() => {
    stopped.current = true;
  }, []);

  return { videoRef, audioOnlyModeRef, stopProctoring };
};
