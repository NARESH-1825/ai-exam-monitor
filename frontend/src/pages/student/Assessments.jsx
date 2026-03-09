// frontend/src/pages/student/Assessments.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { logoutUser } from "../../features/auth/authSlice";
import api from "../../services/api";
import { toast } from "react-toastify";
import {
  PROCTOR_META,
  getRequiredPermissions,
  getActiveProctors,
} from "../../hooks/useProctor";
import DashboardLayout from "../../components/DashboardLayout";

const AUTO_REFRESH = 15000;

/* ── Permission Modal ────────────────────────────────────────────── */
const PermissionModal = ({ exam, onConfirm, onClose }) => {
  const proctoring = exam?.proctoring || {};
  const activeProctors = getActiveProctors(proctoring);
  const { needsCam, needsMic, needsFullscreen } =
    getRequiredPermissions(proctoring);

  const [camStatus, setCamStatus] = useState(needsCam ? "pending" : "skip");
  const [micStatus, setMicStatus] = useState(needsMic ? "pending" : "skip");
  const [fsStatus, setFsStatus] = useState(
    needsFullscreen ? "pending" : "skip",
  );
  const [requesting, setRequesting] = useState(false);

  const allGranted =
    (camStatus === "granted" || camStatus === "skip") &&
    (micStatus === "granted" || micStatus === "skip") &&
    (fsStatus === "granted" || fsStatus === "skip");
  const anyDenied = camStatus === "denied" || micStatus === "denied";

  const requestMediaPermissions = useCallback(async () => {
    if (!needsCam && !needsMic) return true;
    setRequesting(true);
    try {
      const constraints = {};
      if (needsCam)
        constraints.video = { width: { ideal: 320 }, height: { ideal: 240 } };
      if (needsMic) constraints.audio = true;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((t) => t.stop());
      if (needsCam) setCamStatus("granted");
      if (needsMic) setMicStatus("granted");
      setRequesting(false);
      return true;
    } catch {
      if (needsCam) setCamStatus("denied");
      if (needsMic) setMicStatus("denied");
      setRequesting(false);
      return false;
    }
  }, [needsCam, needsMic]);

  const requestFullscreen = useCallback(async () => {
    if (!needsFullscreen) return true;
    setRequesting(true);
    try {
      const el = document.documentElement;
      await (
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen
      )?.call(el);
      setFsStatus("granted");
      setRequesting(false);
      return true;
    } catch {
      setFsStatus("denied");
      setRequesting(false);
      return false;
    }
  }, [needsFullscreen]);

  const handleRequestAll = async () => {
    let ok = true;
    if (needsCam || needsMic) ok = await requestMediaPermissions();
    if (needsFullscreen) {
      const fsOk = await requestFullscreen();
      if (!fsOk) ok = false;
    }
  };

  const StatusIcon = ({ status }) => {
    if (status === "granted") return <span className="text-green-400">✅</span>;
    if (status === "denied") return <span className="text-red-400">❌</span>;
    if (status === "skip") return null;
    return <span className="text-gray-400">⏳</span>;
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-white text-lg">{exam?.title}</h2>
            <p className="text-blue-300 text-xs mt-1">
              ⏱ {exam?.duration} min &nbsp;·&nbsp; ❓{" "}
              {exam?.questionCount || "?"} questions &nbsp;·&nbsp; 🎯 Pass:{" "}
              {exam?.passingScore || 40}%
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {activeProctors.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
              <p className="text-amber-300 font-semibold text-sm mb-2">
                ⚠️ AI Proctoring Active ({activeProctors.length})
              </p>
              <div className="space-y-2">
                {activeProctors.map((p) => (
                  <div key={p.key} className="flex gap-2 items-start">
                    <span className="shrink-0">{p.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {p.label}
                      </p>
                      <p className="text-xs text-gray-400">{p.rule}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(needsCam || needsMic || needsFullscreen) && (
            <div className="bg-blue-900/15 border border-blue-700/40 rounded-xl p-4">
              <p className="text-blue-300 font-semibold text-sm mb-3">
                🔑 Required Permissions
              </p>
              <div className="space-y-2">
                {needsCam && (
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      camStatus === "granted"
                        ? "bg-green-900/30 border-green-700/50"
                        : camStatus === "denied"
                          ? "bg-red-900/30 border-red-700/50"
                          : "bg-white/5 border-white/10"
                    }`}
                  >
                    <StatusIcon status={camStatus} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        📷 Camera
                      </p>
                      <p className="text-xs text-gray-400">
                        Face & object detection
                      </p>
                    </div>
                  </div>
                )}
                {needsMic && (
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      micStatus === "granted"
                        ? "bg-green-900/30 border-green-700/50"
                        : micStatus === "denied"
                          ? "bg-red-900/30 border-red-700/50"
                          : "bg-white/5 border-white/10"
                    }`}
                  >
                    <StatusIcon status={micStatus} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        🎤 Microphone
                      </p>
                      <p className="text-xs text-gray-400">Noise detection</p>
                    </div>
                  </div>
                )}
                {needsFullscreen && (
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      fsStatus === "granted"
                        ? "bg-green-900/30 border-green-700/50"
                        : fsStatus === "denied"
                          ? "bg-red-900/30 border-red-700/50"
                          : "bg-white/5 border-white/10"
                    }`}
                  >
                    <StatusIcon status={fsStatus} />
                    <div>
                      <p className="text-sm font-medium text-white">
                        ⛶ Fullscreen
                      </p>
                      <p className="text-xs text-gray-400">
                        Browser must stay fullscreen
                      </p>
                    </div>
                  </div>
                )}
                {anyDenied && (
                  <div className="mt-2 text-red-300 text-xs bg-red-900/20 border border-red-700/40 rounded-lg p-2">
                    ⚠️ Permission denied. Allow access via the 🔒 icon in your
                    browser's address bar.
                  </div>
                )}
                {!allGranted && (
                  <button
                    onClick={handleRequestAll}
                    disabled={requesting}
                    className="mt-2 w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {requesting ? "⏳ Requesting..." : "🔑 Grant Permissions"}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white/8 hover:bg-white/12 rounded-xl text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => allGranted && onConfirm(exam)}
              disabled={!allGranted}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
                allGranted
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {allGranted ? "🚀 Start Exam" : "⏳ Waiting..."}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main Assessments ────────────────────────────────────────────── */
const Assessments = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [exams, setExams] = useState([]);
  const [attemptedIds, setAttemptedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [selectedExam, setSelectedExam] = useState(null);
  const intervalRef = useRef(null);
  const prevExamIds = useRef(new Set());

  const fetchExams = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [examsRes, attemptedRes] = await Promise.all([
        api.get("/exam"),
        api.get("/student/attempted-exams"),
      ]);
      const newExams = examsRes.data.exams || [];
      const newAttempted = new Set(attemptedRes.data.attemptedExamIds || []);
      if (silent && prevExamIds.current.size > 0) {
        const added = newExams.filter(
          (e) => !prevExamIds.current.has(e.id || e._id),
        );
        if (added.length > 0)
          toast.info(`🆕 New exam: ${added.map((e) => e.title).join(", ")}`, {
            className: "custom-toast",
            bodyClassName: "custom-toast-body",
          });
      }
      prevExamIds.current = new Set(newExams.map((e) => e.id || e._id));
      setExams(newExams);
      setAttemptedIds(newAttempted);
      setLastRefresh(new Date());
    } catch {
      if (!silent)
        toast.error("Failed to load exams", {
          className: "custom-toast",
          bodyClassName: "custom-toast-body",
        });
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchExams(false);
  }, [fetchExams]);
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchExams(true), AUTO_REFRESH);
    return () => clearInterval(intervalRef.current);
  }, [fetchExams]);

  const handlePermissionConfirm = (exam) => {
    const examId = exam.id || exam._id;
    setSelectedExam(null);
    navigate(`/student/exam/${examId}`);
  };

  const refreshActions = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 hidden sm:block">
        {lastRefresh &&
          `Updated ${lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
      </span>
      <button
        onClick={() => fetchExams(false)}
        className="text-xs px-3 py-1.5 bg-white/4 hover:bg-white/8 border border-slate-700/20 rounded-lg text-gray-300 font-medium transition-colors"
      >
        🔄 Refresh
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Available Exams" actions={refreshActions}>
      {/* Auto-refresh progress bar */}
      <div className="w-full h-0.5 bg-gray-800 rounded mb-5 overflow-hidden">
        <div
          key={lastRefresh?.getTime()}
          className="h-full bg-blue-500/60"
          style={{ animation: "shrink 15s linear forwards" }}
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">⏳</div>
          <p className="text-sm">Loading exams...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-800/60 border border-white/8 flex items-center justify-center text-3xl mb-4">
            📭
          </div>
          <h3 className="text-white font-semibold mb-1">
            No live exams right now
          </h3>
          <p className="text-gray-500 text-sm">
            Page refreshes automatically every 15 seconds
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {exams.map((exam) => {
            const examId = exam.id || exam._id;
            const isAttempted = attemptedIds.has(examId);
            const activeProctors = getActiveProctors(exam.proctoring || {});
            const { needsCam, needsMic } = getRequiredPermissions(
              exam.proctoring || {},
            );

            return (
              <div
                key={examId}
                className={`rounded-2xl p-5 border transition-all duration-200 flex flex-col gap-3
                  ${
                    isAttempted
                      ? "bg-gray-800/25 border-slate-700/15 opacity-60"
                      : "bg-gray-800/50 border-slate-700/20 hover:border-blue-600/40 hover:-translate-y-0.5"
                  }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-white text-base">
                        {exam.title}
                      </h3>
                      {!isAttempted && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-900/40 text-green-400 border border-green-800/40 rounded-full live-badge">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot"></span>{" "}
                          LIVE
                        </span>
                      )}
                      {isAttempted && (
                        <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">
                          ✅ Completed
                        </span>
                      )}
                    </div>
                    {exam.description && (
                      <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                        {exam.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>⏱ {exam.duration} min</span>
                  <span>❓ {exam.questionCount || "?"} questions</span>
                  <span>🎯 Pass: {exam.passingScore || 40}%</span>
                  {exam.facultyName && <span>👨‍🏫 {exam.facultyName}</span>}
                </div>

                {activeProctors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeProctors.slice(0, 3).map((p) => (
                      <span
                        key={p.key}
                        className="text-xs bg-amber-900/30 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full"
                      >
                        {p.icon} {p.label}
                      </span>
                    ))}
                    {(needsCam || needsMic) && (
                      <span className="text-xs text-gray-500">
                        {needsCam && "📷"}
                        {needsMic && "🎤"} required
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-auto">
                  {isAttempted ? (
                    <div className="w-full text-center py-2.5 bg-gray-700/50 rounded-xl text-gray-500 text-sm cursor-not-allowed">
                      Already Attempted
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedExam(exam)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-blue-900/20"
                    >
                      Attempt Exam →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedExam && (
        <PermissionModal
          exam={selectedExam}
          onConfirm={handlePermissionConfirm}
          onClose={() => setSelectedExam(null)}
        />
      )}

      <style>{`@keyframes shrink { from { width: 100%; } to { width: 0%; } }`}</style>
    </DashboardLayout>
  );
};

export default Assessments;
