// frontend/src/pages/student/ExamRoom.jsx
// PROCTORING DESIGN:
//   1. Fullscreen is RE-REQUESTED on mount if exam has fullScreenForce enabled
//   2. Proctoring starts only after exam data + submissionId are both ready
//   3. 3 violations → auto-submit with 0 marks + cheated=true
//   4. Camera hidden offscreen — student never sees it
//   5. All violations are silent to the student
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import Webcam from 'react-webcam';
import { useProctor, getRequiredPermissions, VIOLATION_LIMIT } from '../../hooks/useProctor';
import { useSocket } from '../../hooks/useSocket';
import { resetProctor } from '../../features/proctor/proctorSlice';
import api from '../../services/api';
import { toast } from 'react-toastify';

const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── Fullscreen helpers ──────────────────────────────────────────────────────
const enterFS = () => {
  try {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    return fn?.call(el) || Promise.resolve();
  } catch { return Promise.resolve(); }
};
const exitFS = () => {
  try {
    const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    fn?.call(document);
  } catch {}
};
const isFullscreen = () => !!(
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement
);

// ── Result Screen ───────────────────────────────────────────────────────────
const ResultScreen = ({ result, examTitle, onBack }) => {
  const { passed, cheated, score, totalMarks, percentage, timeTaken, autoSubmitted } = result;
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-slate-700/30 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">{cheated ? '🚫' : passed ? '🎉' : '😔'}</div>
          <h2 className="text-2xl font-bold">
            {cheated ? 'Exam Terminated' : passed ? 'Congratulations! Passed!' : 'Not Passed'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">{examTitle}</p>
        </div>

        {cheated ? (
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-5 text-center mb-5">
            <p className="text-red-300 font-semibold text-base">Your exam was auto-submitted due to repeated violations.</p>
            <p className="text-gray-400 text-sm mt-2">Score: 0 / {totalMarks || 0}</p>
          </div>
        ) : (
          <>
            <div className={`text-5xl font-bold text-center my-4 ${passed ? 'text-green-400' : 'text-red-400'}`}>
              {percentage}%
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Score</p>
                <p className="font-bold text-white text-lg">{score}/{totalMarks}</p>
              </div>
              <div className="bg-gray-700 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Time Taken</p>
                <p className="font-bold text-white">
                  {timeTaken ? `${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s` : '—'}
                </p>
              </div>
              <div className="bg-gray-700 rounded-xl p-3 text-center col-span-2">
                <p className="text-xs text-gray-400 mb-1">Submission</p>
                <p className={`font-bold text-sm ${autoSubmitted ? 'text-orange-400' : 'text-blue-400'}`}>
                  {autoSubmitted ? '⏰ Auto submitted' : '✋ Manually submitted'}
                </p>
              </div>
            </div>
          </>
        )}

        <button
          onClick={onBack}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
};

// ── Main ExamRoom ───────────────────────────────────────────────────────────
const ExamRoom = () => {
  const { examId } = useParams();
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const { token }  = useSelector(s => s.auth);

  // Phases: loading | error | exam | result
  const [phase,       setPhase]       = useState('loading');
  const [examData,    setExamData]    = useState(null);
  const [loadError,   setLoadError]   = useState('');
  const [proctorReady, setProctorReady] = useState(false); // true once subId+logId are set AND exam is live

  const [currentQ,    setCurrentQ]    = useState(0);
  const [answers,     setAnswers]     = useState({});
  const [timeLeft,    setTimeLeft]    = useState(0);
  const [submitting,  setSubmitting]  = useState(false);
  const [result,      setResult]      = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const subIdRef   = useRef(null);
  const logIdRef   = useRef(null);
  const submitRef  = useRef(null);
  const timerRef   = useRef(null);
  const answersRef = useRef({});
  const fsRequested  = useRef(false); // prevent repeated FS requests
  const submittedRef = useRef(false); // guard against double-submit

  const socket = useSocket(token);

  useEffect(() => { answersRef.current = answers; }, [answers]);

  useEffect(() => {
    dispatch(resetProctor());
    return () => {
      dispatch(resetProctor());
      clearInterval(timerRef.current);
    };
  }, [dispatch]);

  // ── Load exam ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.post(`/exam/${examId}/start`);
        setExamData(data);
        setTimeLeft((data.duration || 60) * 60);

        // Store IDs in refs BEFORE enabling proctor
        subIdRef.current = data.submissionId;
        logIdRef.current = data.proctoringLogId;

        socket?.emit('join:exam', { examId });

        // Request fullscreen if required (re-enter after navigation)
        const proctoring = data.proctoring || {};
        if (proctoring.fullScreenForce && !isFullscreen() && !fsRequested.current) {
          fsRequested.current = true;
          try {
            await enterFS();
          } catch {
            // Not fatal — fullscreen monitor will emit violation if they exit
          }
        }

        setPhase('exam');
        // Small delay to ensure React has committed the refs before enabling proctor
        setTimeout(() => setProctorReady(true), 200);
      } catch (err) {
        setLoadError(err.response?.data?.message || 'Failed to start exam');
        setPhase('error');
      }
    };
    init();
    // eslint-disable-next-line
  }, [examId]);

  // ── Submit handler ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (auto = false, reason = '', cheated = false) => {
    if (submittedRef.current || submitting || phase === 'result') return;
    submittedRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);
    
    // Disable proctoring immediately to prevent fullscreen exit violations
    stopProctoring(); 
    setProctorReady(false);
    exitFS();

    try {
      const formatted = Object.entries(answersRef.current).map(([questionId, selectedOption]) => ({
        questionId, selectedOption,
      }));
      const { data } = await api.post('/exam/submit', {
        submissionId: subIdRef.current,
        answers: formatted,
        autoSubmitted: auto,
        autoSubmitReason: reason,
        cheated,
      });
      setResult(data.submission);
      setPhase('result');
    } catch (err) {
      // If backend says already submitted (from socket auto-submit), navigate away cleanly
      const msg = err?.response?.data?.message || '';
      if (msg.toLowerCase().includes('already submitted')) {
        setPhase('result');
        setResult({ cheated: true, totalMarks: 0, score: 0, percentage: 0, passed: false, autoSubmitted: true });
        return;
      }
      submittedRef.current = false; // allow retry on genuine network error
      setSubmitting(false);
      
      // Re-enable proctoring if submission actually failed so they can't cheat during retry
      setProctorReady(true);
      
      toast.error('Submission failed. Retrying...', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setTimeout(() => submitRef.current?.(auto, reason, cheated), 3000);
    }
  }, [submitting, phase]);

  submitRef.current = handleSubmit;

  // ── Violation limit callback ──────────────────────────────────────────────
  const onViolationLimit = useCallback(() => {
    if (submittedRef.current) return; // backend already auto-submitted via socket
    toast.error('🚫 Exam auto-submitted due to violations.', { autoClose: false, className: 'custom-toast', bodyClassName: 'custom-toast-body' });
    setTimeout(() => submitRef.current?.(true, 'Violation limit reached', true), 800);
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam') return;
    clearInterval(timerRef.current);
    if (timeLeft <= 0) { submitRef.current?.(true, 'Time expired'); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); submitRef.current?.(true, 'Time expired'); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onBlocked = ({ reason }) => {
      toast.error(`🚫 ${reason}`, { autoClose: false, className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      clearInterval(timerRef.current);
      setProctorReady(false);
      submittedRef.current = true; // prevent frontend from also trying to submit
      exitFS();
      setTimeout(() => navigate('/student', { replace: true }), 2500);
    };
    const onEnded = () => {
      toast.info('⏰ Exam ended by faculty. Auto-submitting...', { className: 'custom-toast', bodyClassName: 'custom-toast-body' });
      setTimeout(() => submitRef.current?.(true, 'Faculty ended exam'), 1500);
    };
    socket.on('exam:blocked', onBlocked);
    socket.on('exam:ended', onEnded);
    return () => {
      socket.off('exam:blocked', onBlocked);
      socket.off('exam:ended', onEnded);
    };
  }, [socket, navigate]);

  // ── Proctor hook ──────────────────────────────────────────────────────────
  // Pass submissionId and logId directly from refs so the hook's internal
  // useEffect syncs them whenever they change.
  // Expose toast to useProctor for audio-only fallback notification
  useEffect(() => {
    window.__proctorToast__ = (msg, opts) => toast.warn(msg, opts);
    return () => { delete window.__proctorToast__; };
  }, []);

  const { videoRef, audioOnlyModeRef, stopProctoring } = useProctor({
    socket,
    submissionId: proctorReady ? subIdRef.current : null,
    logId:        proctorReady ? logIdRef.current  : null,
    examId,
    config: examData?.proctoring || {},
    enabled: proctorReady && phase === 'exam',
    onViolationLimit,
  });

  // ── Phase: loading ────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">⏳</div>
        <p className="text-gray-400">Starting exam...</p>
      </div>
    </div>
  );

  // ── Phase: error ──────────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div className="flex h-screen items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 rounded-2xl p-10 max-w-md w-full text-center border border-slate-700/25">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-red-400 mb-3 font-semibold text-lg">{loadError}</p>
        {loadError?.toLowerCase().includes('already') && (
          <p className="text-gray-400 text-sm mb-4">Each exam can only be taken once.</p>
        )}
        <button
          onClick={() => navigate('/student/assessments')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors"
        >
          ← Back to Assessments
        </button>
      </div>
    </div>
  );

  // ── Phase: result ─────────────────────────────────────────────────────────
  if (phase === 'result' && result) return (
    <ResultScreen result={result} examTitle={examData?.title} onBack={() => navigate('/student')} />
  );

  if (!examData) return null;

  // ── Phase: exam ───────────────────────────────────────────────────────────
  const questions   = examData.questions || [];
  const totalQ      = questions.length;
  const q           = questions[currentQ];
  const answeredCnt = Object.keys(answers).length;
  const progress    = totalQ > 0 ? ((currentQ + 1) / totalQ) * 100 : 0;
  const { needsCam } = getRequiredPermissions(examData.proctoring || {});

  return (
    <div
      className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden"
      style={{ userSelect: 'none' }}
    >

      {/* ── Hidden camera (offscreen but rendering for detections) ── */}
      {needsCam && (
        <div style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
          <Webcam
            ref={videoRef}
            mirrored={false}
            videoConstraints={{ width: 640, height: 480, facingMode: 'user' }}
            screenshotFormat="image/jpeg"
            playsInline
            muted
          />
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-gray-800 border-b border-slate-700/30 px-4 py-3 flex items-center gap-3 shrink-0 z-10">
        <h1 className="font-bold truncate flex-1 text-sm sm:text-base">🔒 {examData.title}</h1>
        <div className={`font-mono font-bold text-lg px-3 py-1 rounded-lg shrink-0 ${
          timeLeft < 300 ? 'text-red-400 bg-red-900/30 animate-pulse' :
          timeLeft < 600 ? 'text-yellow-400 bg-yellow-900/20' : 'text-green-400 bg-green-900/20'}`}>
          ⏱ {fmt(timeLeft)}
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="shrink-0 w-8 h-8 bg-red-700 hover:bg-red-600 rounded-lg flex items-center justify-center font-bold transition-colors"
          title="Submit exam"
        >✕</button>
      </header>

      {/* ── Body ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 flex flex-col min-h-full">

          {/* Progress */}
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Question {currentQ + 1} of {totalQ}</span>
            <span className={answeredCnt === totalQ ? 'text-green-400' : 'text-gray-400'}>
              {answeredCnt}/{totalQ} answered
            </span>
          </div>
          <div className="w-full bg-gray-700 h-1.5 rounded mb-5">
            <div style={{ width: `${progress}%` }} className="bg-blue-500 h-1.5 rounded transition-all" />
          </div>

          {q ? (
            <>
              {/* Question card */}
              <div className="bg-gray-800 rounded-xl p-5 mb-5 border border-slate-700/25">
                <div className="flex justify-between items-start mb-4">
                  <p className="text-base font-medium leading-relaxed flex-1">{q.text}</p>
                  {q.marks > 1 && (
                    <span className="ml-3 shrink-0 text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-lg">
                      {q.marks} marks
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  {(q.options || []).map(opt => {
                    const qKey = q._id || q.id;
                    const sel  = answers[qKey] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setAnswers(p => ({ ...p, [qKey]: opt.id }))}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          sel ? 'border-blue-500 bg-blue-900/50 text-white'
                              : 'border-gray-600 bg-gray-700 hover:border-blue-400 text-gray-200'}`}
                      >
                        <span className="font-bold mr-3 text-blue-400">{opt.id}.</span>
                        {opt.text}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mb-5">
                <button
                  onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
                  disabled={currentQ === 0}
                  className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-30 transition-colors text-sm"
                >← Prev</button>
                {currentQ < totalQ - 1 ? (
                  <button
                    onClick={() => setCurrentQ(p => p + 1)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-sm"
                  >Next →</button>
                ) : (
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={submitting}
                    className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-bold transition-colors text-sm"
                  >{submitting ? 'Submitting…' : 'Submit ✓'}</button>
                )}
              </div>

              {/* Question grid */}
              <div className="flex flex-wrap gap-1.5">
                {questions.map((qi, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      i === currentQ          ? 'bg-blue-600 text-white' :
                      answers[qi._id||qi.id]  ? 'bg-green-700 text-white' :
                                                'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >{i + 1}</button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-10">No questions found</div>
          )}
        </div>
      </main>

      {/* ── Submit confirm modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full border border-slate-700/25 shadow-2xl text-center">
            <div className="text-5xl mb-3">📋</div>
            <h2 className="text-xl font-bold mb-2">Submit Exam?</h2>
            <p className="text-gray-400 text-sm mb-2">{answeredCnt}/{totalQ} questions answered.</p>
            {answeredCnt < totalQ && (
              <p className="text-yellow-400 text-xs mb-2">⚠️ {totalQ - answeredCnt} question(s) unanswered.</p>
            )}
            <p className="text-gray-400 text-sm mb-6">
              This <strong className="text-red-400">cannot be undone</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); handleSubmit(false); }}
                disabled={submitting}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold disabled:opacity-50 transition-colors"
              >{submitting ? 'Submitting…' : '✓ Submit'}</button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors"
              >Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamRoom;
