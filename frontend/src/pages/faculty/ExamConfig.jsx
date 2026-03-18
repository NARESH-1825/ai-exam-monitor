// frontend/src/pages/faculty/ExamConfig.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import api from "../../services/api";
import { toast } from "react-toastify";
import { PROCTOR_META } from "../../hooks/useProctor";

const STORAGE_KEY = "examConfig_draft_v2";
const PROCTOR_KEYS = [
  "faceDetection",
  "eyeTracking",
  "noiseDetection",
  "objectDetection",
  "tabSwitchLock",
  "fullScreenForce",
];
const DEFAULT_PROC = Object.fromEntries(PROCTOR_KEYS.map((k) => [k, false]));
const DEFAULT_FORM = {
  title: "",
  description: "",
  duration: 60,
  pageCloseTime: 0,
  passingScore: 40,
  proctoring: { ...DEFAULT_PROC },
};

const STEPS = ["Basic Info", "Timers", "Proctoring", "Question Paper"];

const ExamConfig = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toastFired = useRef(false);
  const [step, setStep] = useState(0);

  const [form, setForm] = useState(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s).form || DEFAULT_FORM;
    } catch {}
    return DEFAULT_FORM;
  });
  const [selectedPaper, setSelectedPaper] = useState(() => {
    try {
      const s = sessionStorage.getItem(STORAGE_KEY);
      if (s) return JSON.parse(s).selectedPaper || null;
    } catch {}
    return null;
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.selectedPaper && !toastFired.current) {
      toastFired.current = true;
      setSelectedPaper(location.state.selectedPaper);
      toast.success(`Paper "${location.state.selectedPaper.title}" selected!`, {
        className: "custom-toast",
        bodyClassName: "custom-toast-body",
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state?.selectedPaper]);

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ form, selectedPaper }),
    );
  }, [form, selectedPaper]);

  const toggle = (key) =>
    setForm((p) => ({
      ...p,
      proctoring: { ...p.proctoring, [key]: !p.proctoring[key] },
    }));
  const enableAll = () =>
    setForm((p) => ({
      ...p,
      proctoring: Object.fromEntries(PROCTOR_KEYS.map((k) => [k, true])),
    }));
  const disableAll = () =>
    setForm((p) => ({ ...p, proctoring: { ...DEFAULT_PROC } }));

  const activeCount = PROCTOR_KEYS.filter((k) => form.proctoring[k]).length;
  const needsCam =
    form.proctoring.faceDetection ||
    form.proctoring.eyeTracking ||
    form.proctoring.objectDetection;
  const needsMic = form.proctoring.noiseDetection;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPaper) {
      toast.error("Please select a question paper",{ className: 'custom-toast',
    bodyClassName: 'custom-toast-body'});
      return;
    }
    if (!form.title.trim()) {
      toast.error("Exam title is required",{ className: 'custom-toast',
    bodyClassName: 'custom-toast-body'});
      return;
    }
    if (form.duration < 1) {
      toast.error("Duration must be at least 1 minute",{ className: 'custom-toast',
    bodyClassName: 'custom-toast-body'});
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        questionPaperId: selectedPaper.id,
        questionPaperTitle: selectedPaper.title,
        questions: (selectedPaper.questions || []).map((q) => ({
          ...q,
          _id: q.id || q._id || Math.random().toString(36).slice(2),
        })),
        proctorCount: activeCount,
      };
      await api.post("/exam", payload);
      sessionStorage.removeItem(STORAGE_KEY);
      toast.success("Exam created! 🎉",{ className: 'custom-toast',
    bodyClassName: 'custom-toast-body'});
      navigate("/faculty");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create exam",{ className: 'custom-toast',
    bodyClassName: 'custom-toast-body'});
    }
    setSubmitting(false);
  };

  const clearActions = (
    <button
      onClick={() => {
        sessionStorage.removeItem(STORAGE_KEY);
        setForm(DEFAULT_FORM);
        setSelectedPaper(null);
        toastFired.current = false;
        toast.info("Draft cleared",{ className: 'custom-toast',
    bodyClassName: 'custom-toast-body'});
        setStep(0);
      }}
      className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
    >
      Clear Draft
    </button>
  );

  return (
    <DashboardLayout title="Create Exam" actions={clearActions}>
      <div className="page-wrapper">
        <form onSubmit={handleSubmit} className="w-full max-w-2xl 2xl:max-w-3xl">
          {/* Step tabs */}
          <div className="flex border rounded-md p-1 mb-4 gap-1 overflow-x-auto"
            style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
            {STEPS.map((s, i) => (
              <button key={i} type="button" onClick={() => setStep(i)}
                className={`flex-1 py-2.5 px-2 sm:px-3 rounded text-xs font-semibold whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-blue-500
                ${step === i ? "bg-blue-600 text-white shadow" : "hover:text-white"}`}
                style={step !== i ? {color:'var(--text-secondary)'} : {}}>
                {i + 1}. {s}
                {i === 3 && selectedPaper && <span className="ml-1 text-green-400">✓</span>}
              </button>
            ))}
          </div>

          {/* ── Step 0: Basic Info ── */}
          {step === 0 && (
            <div className="rounded-md p-4 sm:p-5 lg:p-6 space-y-4 fade-in border"
              style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
              <h2 className="font-bold text-base sm:text-lg" style={{color:'var(--text-primary)'}}>📝 Basic Information</h2>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{color:'var(--text-secondary)'}}>Exam Title *</label>
                <input required placeholder="e.g. Mid-Term 2024 — Data Structures" value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-3 rounded-md outline-none border text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{color:'var(--text-secondary)'}}>
                  Description <span style={{color:'var(--text-muted)'}}>(optional)</span>
                </label>
                <textarea placeholder="Brief description for students..." rows={2} value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-md outline-none border resize-none text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{color:'var(--text-secondary)'}}>Passing Score (%)</label>
                <input type="number" min={1} max={100} value={form.passingScore}
                  onChange={(e) => setForm((p) => ({ ...p, passingScore: +e.target.value }))}
                  className="w-28 px-4 py-3 rounded-md outline-none border text-sm text-center font-bold focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="button" onClick={() => setStep(1)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                Next: Timer Settings →
              </button>
            </div>
          )}

          {/* ── Step 1: Timers ── */}
          {step === 1 && (
            <div className="rounded-md p-4 sm:p-5 lg:p-6 space-y-4 fade-in border"
              style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
              <h2 className="font-bold text-base sm:text-lg" style={{color:'var(--text-primary)'}}>⏱ Timer Settings</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-900/15 border border-blue-800/30 rounded-md p-4">
                  <p className="text-sm font-semibold text-blue-300 mb-1">Student Exam Timer</p>
                  <p className="text-xs mb-3" style={{color:'var(--text-muted)'}}>Auto-submits at zero.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} required value={form.duration}
                      onChange={(e) => setForm((p) => ({ ...p, duration: +e.target.value }))}
                      className="w-20 px-3 py-2.5 rounded-md outline-none border text-center font-bold text-lg focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm" style={{color:'var(--text-primary)'}}>min</span>
                  </div>
                  {form.duration > 0 && (
                    <p className="text-xs text-blue-400 mt-2">
                      = {form.duration >= 60 ? Math.floor(form.duration / 60) + "h " : ""}
                        {form.duration % 60 > 0 ? (form.duration % 60) + "m" : ""}
                    </p>
                  )}
                </div>
                <div className="bg-purple-900/15 border border-purple-800/30 rounded-md p-4">
                  <p className="text-sm font-semibold text-purple-300 mb-1">Page Auto-Close</p>
                  <p className="text-xs mb-3" style={{color:'var(--text-muted)'}}>0 = manual close only.</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={form.pageCloseTime}
                      onChange={(e) => setForm((p) => ({ ...p, pageCloseTime: +e.target.value }))}
                      className="w-20 px-3 py-2.5 rounded-md outline-none border text-center font-bold text-lg focus:ring-2 focus:ring-purple-500" />
                    <span className="text-sm" style={{color:'var(--text-primary)'}}>min</span>
                  </div>
                  <p className="text-xs mt-2">
                    {form.pageCloseTime > 0
                      ? <span className="text-purple-400">Closes {form.pageCloseTime}m after launch</span>
                      : <span style={{color:'var(--text-muted)'}}>Manual close only</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(0)}
                  className="flex-1 py-3 rounded-md text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{background:'var(--bg-hover)',borderColor:'var(--border)',color:'var(--text-primary)'}}>
                  ← Back
                </button>
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Next: Proctoring →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Proctoring ── */}
          {step === 2 && (
            <div className="rounded-md p-4 sm:p-5 lg:p-6 space-y-4 fade-in border"
              style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="font-bold text-base sm:text-lg" style={{color:'var(--text-primary)'}}>🕵️ Proctoring</h2>
                <div className="flex gap-2">
                  <button type="button" onClick={enableAll}
                    className="text-xs px-3 py-2 text-blue-300 rounded-md transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{background:'rgba(56,139,253,0.12)',borderColor:'rgba(56,139,253,0.3)'}}>
                    All On
                  </button>
                  <button type="button" onClick={disableAll}
                    className="text-xs px-3 py-2 rounded-md transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{background:'var(--bg-hover)',borderColor:'var(--border)',color:'var(--text-secondary)'}}>
                    All Off
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {PROCTOR_KEYS.map((key) => {
                  const m = PROCTOR_META[key];
                  const on = form.proctoring[key];
                  return (
                    <div key={key} onClick={() => toggle(key)}
                      className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-md cursor-pointer border transition-all ${
                        on ? "bg-blue-900/20 border-blue-700/50" : ""}`}
                      style={!on ? {background:'var(--bg-hover)',borderColor:'var(--border)'} : {}}>
                      <div className={`w-10 shrink-0 mt-0.5 rounded-full flex items-center transition-colors ${on ? "bg-blue-600" : "bg-gray-600"}`}
                        style={{ height: "22px" }}>
                        <div className={`w-4 h-4 bg-white rounded-full mx-0.5 shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{color: on ? 'var(--text-primary)' : 'var(--text-secondary)'}}>{m.icon} {m.label}</p>
                        <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{m.desc}</p>
                        {on && <p className="text-xs text-amber-300 mt-1 bg-amber-900/20 rounded px-2 py-0.5 inline-block">"{m.rule}"</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {activeCount > 0 ? (
                <div className="bg-amber-900/15 border border-amber-800/40 rounded-md p-3 sm:p-4 text-xs space-y-1">
                  <p className="text-amber-300 font-semibold">{activeCount} monitor{activeCount !== 1 ? "s" : ""} active</p>
                  {needsCam && <p style={{color:'var(--text-primary)'}}>📷 Camera required</p>}
                  {needsMic && <p style={{color:'var(--text-primary)'}}>🎤 Microphone required</p>}
                  {form.proctoring.fullScreenForce && <p style={{color:'var(--text-primary)'}}>⛶ Fullscreen required</p>}
                  <p className="text-red-400 font-medium">⚠️ 3 violations → auto-submit with 0 marks</p>
                </div>
              ) : (
                <div className="border rounded-md p-3 text-center text-xs"
                  style={{background:'var(--bg-hover)',borderColor:'var(--border)',color:'var(--text-muted)'}}>
                  No proctoring active
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-md text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{background:'var(--bg-hover)',borderColor:'var(--border)',color:'var(--text-primary)'}}>
                  ← Back
                </button>
                <button type="button" onClick={() => setStep(3)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Next: Select Paper →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Question Paper ── */}
          {step === 3 && (
            <div className="space-y-3 fade-in">
              <div className="rounded-md p-4 sm:p-5 lg:p-6 border"
                style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
                <h2 className="font-bold text-base sm:text-lg mb-4" style={{color:'var(--text-primary)'}}>📚 Question Paper</h2>
                {selectedPaper ? (
                  <div className="bg-green-900/15 border-2 border-green-700/50 rounded-md p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-semibold text-green-300">{selectedPaper.title}</p>
                        <p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>
                          {selectedPaper.questions?.length || 0} questions
                          {selectedPaper.createdAt && " · " + new Date(selectedPaper.createdAt).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      <button type="button"
                        onClick={() => navigate("/faculty/questions", { state: { selectMode: true } })}
                        className="px-3 py-2 rounded-md text-xs transition-colors shrink-0 border focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{background:'var(--bg-hover)',borderColor:'var(--border)',color:'var(--text-secondary)'}}>
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-md p-6 sm:p-8 text-center"
                    style={{borderColor:'var(--border)'}}>
                    <div className="text-3xl mb-3">📝</div>
                    <p className="text-sm mb-4" style={{color:'var(--text-secondary)'}}>No question paper selected yet</p>
                    <button type="button"
                      onClick={() => navigate("/faculty/questions", { state: { selectMode: true } })}
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-500 rounded-md font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                      Select from Question Bank
                    </button>
                  </div>
                )}
              </div>
              {/* Summary */}
              <div className="rounded-md p-4 sm:p-5 space-y-1 text-sm border"
                style={{background:'var(--bg-card)',borderColor:'var(--border)'}}>
                <h3 className="font-semibold text-xs uppercase tracking-wide mb-3" style={{color:'var(--text-muted)'}}>Exam Summary</h3>
                {[
                  { label: "Title",    val: form.title || "—" },
                  { label: "Duration", val: `${form.duration} min` },
                  { label: "Pass",     val: `${form.passingScore}%` },
                  { label: "Proctors", val: activeCount > 0 ? `${activeCount} active` : "None" },
                  { label: "Paper",    val: selectedPaper?.title || "—" },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5"
                    style={{borderBottom:'1px solid var(--border-subtle)'}}>
                    <span className="text-xs" style={{color:'var(--text-muted)'}}>{r.label}</span>
                    <span className="font-medium text-xs" style={{color:'var(--text-primary)'}}>{r.val}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-md text-sm transition-colors border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{background:'var(--bg-hover)',borderColor:'var(--border)',color:'var(--text-primary)'}}>
                  ← Back
                </button>
                <button type="submit" disabled={submitting || !selectedPaper}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {submitting ? "⏳ Creating..." : "🚀 Create Exam"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </DashboardLayout>
  );

};

export default ExamConfig;
