// frontend/src/pages/faculty/QuestionBank.jsx
import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../services/api';
import { toast } from 'react-toastify';

const defaultQ = {
  text: '', options: [
    { id: 'A', text: '' }, { id: 'B', text: '' },
    { id: 'C', text: '' }, { id: 'D', text: '' },
  ],
  answer: 'A', difficulty: 'medium', marks: 1,
};

/* ── Question Form ─────────────────────────────────────────────── */
const QuestionForm = ({ q, idx, onSave, onCancel }) => {
  const [form, setForm] = useState(q || defaultQ);
  return (
    <div className="bg-white/4 border border-slate-700/20 rounded-xl p-4 space-y-3 fade-in">
      <h5 className="text-sm font-semibold text-blue-300">{idx !== null ? `Edit Question ${idx + 1}` : 'New MCQ Question'}</h5>
      <textarea rows={2} placeholder="Question text..." value={form.text}
        onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
        className="w-full bg-gray-900/60 text-white px-3 py-2 rounded-lg outline-none border border-white/10 focus:border-blue-500 resize-none text-sm" />
      <div className="grid grid-cols-2 gap-2">
        {form.options.map((opt, i) => (
          <div key={opt.id} className="flex gap-2 items-center">
            <span className="text-blue-400 font-bold text-xs w-4">{opt.id}.</span>
            <input placeholder={`Option ${opt.id}`} value={opt.text}
              onChange={e => setForm(p => ({ ...p, options: p.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) }))}
              className="flex-1 bg-gray-900/60 text-white px-2 py-1.5 rounded-lg outline-none border border-slate-700/20 focus:border-blue-500 text-xs" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Correct', key: 'answer',     type: 'select', opts: ['A','B','C','D'] },
          { label: 'Difficulty', key: 'difficulty', type: 'select', opts: ['easy','medium','hard'] },
          { label: 'Marks', key: 'marks', type: 'number' },
        ].map(f => (
          <div key={f.key}>
            <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
            {f.type === 'select'
              ? <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-gray-900/60 text-white px-2 py-1.5 rounded-lg outline-none border border-white/10 text-xs">
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              : <input type="number" min={1} value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: +e.target.value }))}
                  className="w-full bg-gray-900/60 text-white px-2 py-1.5 rounded-lg outline-none border border-white/10 text-xs" />
            }
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => {
          if (!form.text.trim()) { toast.error('Question text required'); return; }
          if (form.options.some(o => !o.text.trim())) { toast.error('All 4 options required'); return; }
          onSave(form);
        }} className="px-4 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-semibold transition-colors">
          ✓ {idx !== null ? 'Update' : 'Add'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 bg-white/8 hover:bg-white/12 rounded-lg text-xs transition-colors">Cancel</button>
      </div>
    </div>
  );
};

/* ── Paper Drawer (create / edit / detail) ─────────────────────── */
const PaperDrawer = ({ paper, onSave, onClose, onDelete, isSelectMode, onSelect }) => {
  const [mode, setMode]       = useState(paper ? (isSelectMode ? 'detail' : 'detail') : 'edit');
  const [title, setTitle]     = useState(paper?.title || '');
  const [questions, setQuestions] = useState(paper?.questions || []);
  const [showQForm, setShowQForm] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Paper title required'); return; }
    if (questions.length === 0) { toast.error('Add at least one question'); return; }
    setSaving(true);
    try {
      let saved;
      if (paper?.id) {
        const { data } = await api.put(`/faculty/papers/${paper.id}`, { title, questions });
        saved = data.paper;
      } else {
        const { data } = await api.post('/faculty/papers', { title, questions });
        saved = data.paper;
      }
      toast.success(paper?.id ? 'Paper updated!' : 'Paper created!');
      onSave(saved);
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:items-center md:justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full flex flex-col bg-gray-900
        max-w-md h-full border-l border-slate-700/25 slide-in-right
        md:max-w-2xl md:h-auto md:max-h-[90vh] md:rounded-2xl md:border md:border-slate-700/25 md:shadow-2xl md:mx-4 md:slide-in-none fade-in-scale">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/20 shrink-0">
          <div className="flex items-center gap-2">
            {paper && mode === 'detail' && !isSelectMode && (
              <button onClick={() => setMode('edit')} className="text-blue-400 hover:text-blue-300 text-xs font-medium">✏️ Edit</button>
            )}
            <h3 className="font-semibold text-white text-sm">
              {!paper ? 'New Paper' : mode === 'detail' ? '📄 Paper Details' : '✏️ Edit Paper'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {mode === 'detail' && paper ? (
            /* Detail view */
            <>
              <div>
                <h4 className="font-bold text-white text-base">{paper.title}</h4>
                <p className="text-gray-400 text-xs mt-1">📅 {paper.createdAt ? new Date(paper.createdAt).toLocaleDateString('en-IN') : '—'} · by {paper.createdBy}</p>
                <span className="inline-block mt-2 bg-blue-900/40 text-blue-300 text-xs px-2.5 py-0.5 rounded-full border border-blue-800">
                  {paper.questions?.length || 0} Questions
                </span>
              </div>
              <div className="space-y-2">
                {(paper.questions || []).map((q, i) => (
                  <div key={i} className="bg-white/[0.025] border border-slate-700/20 rounded-xl p-3">
                    <p className="text-sm text-white mb-2 font-medium">{i + 1}. {q.text}</p>
                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                      {(q.options || []).map(opt => (
                        <div key={opt.id} className={`px-2 py-1.5 rounded-lg text-xs ${
                          opt.id === q.answer ? 'bg-green-900/40 border border-green-700 text-green-300' : 'bg-white/5 text-gray-400'}`}>
                          <span className="font-bold mr-1">{opt.id}.</span>{opt.text}
                          {opt.id === q.answer && <span className="ml-1">✓</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">{q.difficulty} · {q.marks}m</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Edit / Create form */
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block font-medium">Paper Title *</label>
                <input required placeholder="e.g. Mid-Term 2024 – Data Structures" value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-gray-800/60 text-white px-4 py-3 rounded-xl outline-none border border-slate-700/20 focus:border-blue-500 text-sm" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-white">Questions ({questions.length})</h4>
                  <button onClick={() => { setEditingIdx(null); setShowQForm(v => !v); }}
                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
                    {showQForm ? '✕ Cancel' : '+ Add'}
                  </button>
                </div>
                {showQForm && (
                  <QuestionForm q={null} idx={editingIdx} onSave={(q) => {
                    if (editingIdx !== null) setQuestions(qs => qs.map((x, i) => i === editingIdx ? q : x));
                    else setQuestions(qs => [...qs, { ...q, id: Date.now().toString() }]);
                    setEditingIdx(null); setShowQForm(false);
                  }} onCancel={() => { setShowQForm(false); setEditingIdx(null); }} />
                )}
                {questions.length === 0 && !showQForm && (
                  <p className="text-gray-500 text-xs text-center py-4">No questions yet</p>
                )}
                <div className="space-y-1.5 mt-2 max-h-48 md:max-h-64 overflow-y-auto">
                  {questions.map((q, i) => (
                    <div key={i} className="bg-white/4 rounded-lg p-2.5 flex gap-2 items-start">
                      <span className="text-blue-400 font-bold text-xs w-5 shrink-0">{i+1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white truncate">{q.text}</p>
                        <p className="text-xs text-gray-500">✓ {q.answer} · {q.difficulty} · {q.marks}m</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditingIdx(i); setShowQForm(true); }}
                          className="px-1.5 py-1 bg-blue-900/50 hover:bg-blue-800 rounded text-xs">✏️</button>
                        <button onClick={() => { if (confirm('Delete?')) setQuestions(qs => qs.filter((_, j) => j !== i)); }}
                          className="px-1.5 py-1 bg-red-900/50 hover:bg-red-800 rounded text-xs">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700/20 px-5 py-4 shrink-0 flex gap-2">
          {isSelectMode && paper ? (
            <button onClick={() => onSelect(paper)} className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 rounded-xl font-semibold text-sm transition-colors">
              ✅ Select This Paper
            </button>
          ) : mode === 'detail' && paper ? (
            <>
              <button onClick={() => setMode('edit')} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold text-sm transition-colors">
                ✏️ Edit
              </button>
              <button onClick={() => onDelete(paper.id)} className="px-5 py-2.5 bg-red-700 hover:bg-red-600 rounded-xl text-sm transition-colors">
                🗑
              </button>
            </>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-semibold text-sm transition-colors">
                {saving ? '⏳ Saving...' : paper?.id ? '💾 Update' : '💾 Save Paper'}
              </button>
              <button onClick={onClose} className="px-5 py-2.5 bg-white/8 hover:bg-white/12 rounded-xl text-sm transition-colors">Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Main QuestionBank ─────────────────────────────────────────── */
const QuestionBank = () => {
  const location    = useLocation();
  const navigate    = useNavigate();
  const isSelectMode = location.state?.selectMode === true;

  const [papers, setPapers]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [drawerPaper, setDrawerPaper] = useState(undefined); // undefined=closed, null=new, obj=open
  const [searchTitle, setSearchTitle] = useState('');
  const [searchDate, setSearchDate]   = useState('');

  const loadPapers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/faculty/papers');
      setPapers(data.papers || []);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to load'); }
    setLoading(false);
  };
  useEffect(() => { loadPapers(); }, []);

  const handleDelete = async (paperId) => {
    if (!confirm('Delete this paper? Cannot be undone.')) return;
    try {
      await api.delete(`/faculty/papers/${paperId}`);
      setPapers(prev => prev.filter(p => p.id !== paperId));
      setDrawerPaper(undefined);
      toast.success('Paper deleted');
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleSave = (saved) => {
    setPapers(prev => {
      const exists = prev.find(p => p.id === saved.id);
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev];
    });
    setDrawerPaper(undefined);
  };

  const handleSelect = (paper) => navigate('/faculty/exam-config', { state: { selectedPaper: paper } });

  const filteredPapers = useMemo(() => papers.filter(p => {
    const matchTitle = !searchTitle || p.title.toLowerCase().includes(searchTitle.toLowerCase());
    const matchDate  = !searchDate  || (p.createdAt || '').startsWith(searchDate);
    return matchTitle && matchDate;
  }), [papers, searchTitle, searchDate]);

  const fmt = iso => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return iso; }
  };

  const headerActions = !isSelectMode && (
    <button onClick={() => setDrawerPaper(null)}
      className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-white transition-colors">
      + New Paper
    </button>
  );

  return (
    <DashboardLayout title={isSelectMode ? 'Select Question Paper' : 'Question Bank'} actions={headerActions}>

      {/* Search */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <input placeholder="🔍 Search by title…" value={searchTitle}
          onChange={e => setSearchTitle(e.target.value)}
          className="flex-1 min-w-40 bg-gray-800/60 text-white px-4 py-2.5 rounded-xl outline-none border border-slate-700/20 focus:border-blue-500 text-sm" />
        <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
          className="bg-gray-800/60 text-white px-3 py-2.5 rounded-xl outline-none border border-white/8 focus:border-blue-500 text-sm" />
        {(searchTitle || searchDate) && (
          <button onClick={() => { setSearchTitle(''); setSearchDate(''); }}
            className="px-3 py-2.5 bg-white/8 hover:bg-white/12 rounded-xl text-sm transition-colors text-gray-300">✕</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3 animate-pulse">📚</div>
          <p className="text-sm">Loading papers...</p>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">{searchTitle || searchDate ? '🔍' : '📝'}</div>
          <p className="text-sm mb-1">{searchTitle || searchDate ? 'No papers match' : 'No question papers yet'}</p>
          {!isSelectMode && (
            <button onClick={() => setDrawerPaper(null)}
              className="mt-3 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition-colors">
              + Create First Paper
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredPapers.map(paper => (
            <div key={paper.id}
              className={`bg-gray-800/50 border border-slate-700/20 rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:border-blue-600/30 ${isSelectMode ? 'cursor-pointer' : ''}`}
              onClick={isSelectMode ? () => setDrawerPaper(paper) : undefined}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">{paper.title}</h3>
                  <p className="text-gray-500 text-xs mt-0.5">📅 {fmt(paper.createdAt)} · {paper.createdBy}</p>
                </div>
                <span className="shrink-0 bg-blue-900/40 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-800/40">
                  {paper.questions?.length || 0}q
                </span>
              </div>
              {paper.updatedAt && paper.updatedAt !== paper.createdAt && (
                <p className="text-yellow-400 text-xs mb-2">✏️ Modified {fmt(paper.updatedAt)}</p>
              )}
              <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => setDrawerPaper(paper)}
                  className="flex-1 py-1.5 bg-white/8 hover:bg-white/12 rounded-lg text-xs font-medium transition-colors">
                  👁 View
                </button>
                {!isSelectMode && (
                  <>
                    <button onClick={() => { setDrawerPaper(paper); }}
                      className="px-3 py-1.5 bg-blue-900/50 hover:bg-blue-800 rounded-lg text-xs transition-colors">✏️</button>
                    <button onClick={() => handleDelete(paper.id)}
                      className="px-3 py-1.5 bg-red-900/50 hover:bg-red-800 rounded-lg text-xs transition-colors">🗑</button>
                  </>
                )}
                {isSelectMode && (
                  <button onClick={() => handleSelect(paper)}
                    className="flex-1 py-1.5 bg-green-700 hover:bg-green-600 rounded-lg text-xs font-medium transition-colors">
                    ✅ Select
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerPaper !== undefined && (
        <PaperDrawer
          paper={drawerPaper}
          onSave={handleSave}
          onClose={() => setDrawerPaper(undefined)}
          onDelete={handleDelete}
          isSelectMode={isSelectMode}
          onSelect={handleSelect}
        />
      )}
    </DashboardLayout>
  );
};

export default QuestionBank;
