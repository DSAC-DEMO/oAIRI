import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RadarChart from '../components/RadarChart';

const OPTION_LEVEL_COLORS = [
  'bg-slate-100 text-slate-600',   // 0: Unaware  (lightest)
  'bg-blue-100 text-blue-600',     // 1: Aware
  'bg-blue-200 text-blue-700',     // 2: Ready
  'bg-blue-300 text-blue-800',     // 3: Competent
  'bg-blue-500 text-white',        // 4: Catalyst (darkest)
];

// Indexed by position: 0=highest(≥4) … 4=lowest(<1) — blue intensity scale
const READINESS_LEVEL_STYLES = [
  { bg: 'bg-blue-100', text: 'text-blue-900', bar: 'bg-blue-800' },  // 0: Expert   (darkest)
  { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-600' },  // 1: Advanced
  { bg: 'bg-blue-50',  text: 'text-blue-600', bar: 'bg-blue-400' },  // 2: Moderate
  { bg: 'bg-blue-50',  text: 'text-blue-500', bar: 'bg-blue-300' },  // 3: Developing
  { bg: 'bg-slate-50', text: 'text-slate-500', bar: 'bg-blue-200'},  // 4: Novice   (lightest)
];

function Bar({ pct, colorClass }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`h-3 rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${Math.max(pct, 0)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
      <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
      <div className="text-sm font-medium text-gray-700">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Question editor form ─────────────────────────────────────────────────────
const DEFAULT_WEIGHTS = [0, 1.25, 2.50, 3.75, 5.00];
const DEFAULT_OPTIONS = DEFAULT_WEIGHTS.map(w => ({ text: '', weight: w }));

function QuestionForm({ initial, onSave, onCancel, existingCategories = [], levels = [] }) {
  const empty = { category: '', question: '', dimension: '', q_id: '', options: DEFAULT_OPTIONS };
  const [form, setForm] = useState(initial || empty);
  // If the initial category isn't in the existing list, treat it as a custom new one
  const [isNewCategory, setIsNewCategory] = useState(
    initial ? !existingCategories.includes(initial.category) : false
  );

  const setField = (field, value) => setForm(f => ({ ...f, [field]: value }));
  const setOption = (i, field, value) =>
    setForm(f => ({ ...f, options: f.options.map((o, idx) => idx === i ? { ...o, [field]: value } : o) }));
  const addOption = () => setForm(f => {
    const nextWeight = DEFAULT_WEIGHTS[f.options.length] ?? 5.00;
    return { ...f, options: [...f.options, { text: '', weight: nextWeight }] };
  });
  const removeOption = (i) => setForm(f => ({ ...f, options: f.options.filter((_, idx) => idx !== i) }));

  const handleCategorySelect = (val) => {
    if (val === '__new__') {
      setIsNewCategory(true);
      setField('category', '');
    } else {
      setIsNewCategory(false);
      setField('category', val);
    }
  };

  const valid = form.category.trim() && form.question.trim() &&
    form.options.length >= 2 && form.options.every(o => o.text.trim() && typeof o.weight === 'number' && !isNaN(o.weight) && o.weight >= 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Dimension <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={form.dimension}
            onChange={e => setField('dimension', e.target.value)}
            placeholder="e.g. Use Case Identification"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Question ID <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            value={form.q_id}
            onChange={e => setField('q_id', e.target.value)}
            placeholder="e.g. survey_p3_q9_usecase"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Pillar</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            value={isNewCategory ? '__new__' : form.category}
            onChange={e => handleCategorySelect(e.target.value)}
          >
            <option value="">Select pillar…</option>
            {existingCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            <option value="__new__">＋ New pillar…</option>
          </select>
          {isNewCategory && (
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mt-2"
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              placeholder="Enter new pillar name"
              autoFocus
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Question</label>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            value={form.question}
            onChange={e => setField('question', e.target.value)}
            placeholder="Enter the question text…"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-gray-600">Options (ordered lowest → highest weight on the survey)</label>
          <button
            type="button"
            onClick={addOption}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            + Add option
          </button>
        </div>
        <div className="space-y-2">
          {form.options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1">
                {levels[i] && (
                  <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-1 ${OPTION_LEVEL_COLORS[i]}`}>
                    {levels[i]}
                  </span>
                )}
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={opt.text}
                  onChange={e => setOption(i, 'text', e.target.value)}
                  placeholder={`Option ${i + 1} text`}
                />
              </div>
              <div className="w-24 flex-shrink-0">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="1.25"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={opt.weight}
                  onChange={e => { const v = parseFloat(e.target.value); setOption(i, 'weight', isNaN(v) ? '' : v); }}
                  placeholder="Weight"
                />
              </div>
              {form.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none mt-2 flex-shrink-0"
                  title="Remove option"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">Weights: 0, 1.25, 2.50, 3.75, 5.00 (lowest → highest).</p>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave(form)}
          className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
            valid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function AdminPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [activeTab, setActiveTab] = useState('analytics');

  // Question management state
  const [editingId, setEditingId] = useState(null);
  const [addFormCategory, setAddFormCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [qSaving, setQSaving] = useState(false);

  // Settings state
  const [editLevels, setEditLevels] = useState(null);
  const [levelsSaving, setLevelsSaving] = useState(false);
  const [editReadinessLevels, setEditReadinessLevels] = useState(null);
  const [readinessSaving, setReadinessSaving] = useState(false);
  // Company codes state
  const [newSessionName, setNewSessionName] = useState('');
  const [sessionSaving, setSessionSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null); // shown once after creation
  const [codeCopied, setCodeCopied] = useState(false);
  // Courses state
  const [editCourses, setEditCourses] = useState(null);
  const [coursesSaving, setCoursesSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) { setIsAuthenticated(true); fetchData(token); }
    else setLoading(false);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('adminToken', result.token);
        setIsAuthenticated(true); setPassword(''); fetchData(result.token);
      } else { setAuthError('Invalid password'); }
    } catch { setAuthError('Authentication failed'); }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false); setData(null); navigate('/');
  };

  const fetchData = async (token) => {
    try {
      const res = await fetch('/api/admin', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.status === 401) { localStorage.removeItem('adminToken'); setIsAuthenticated(false); setLoading(false); return; }
      if (!res.ok) throw new Error('Failed to fetch data');
      setData(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const questionAction = async (action, payload) => {
    setQSaving(true);
    try {
      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
        body: JSON.stringify({ action, ...payload })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);
      setEditingId(null);
      setShowAddForm(false);
      setAddFormCategory('');
      await fetchData(localStorage.getItem('adminToken'));
    } catch (err) { alert(`Failed: ${err.message}`); }
    finally { setQSaving(false); }
  };

  const exportCSV = () => {
    if (!data?.responses?.length) return;
    const headers = ['ID', 'Readiness Level', 'Score %', 'Submitted At'];
    const rows = data.responses.map(r => [r.id, r.readiness_level, r.score_pct, r.submitted_at]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `responses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              placeholder="Enter admin password" required
            />
            {authError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{authError}</div>}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">Login</button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-lg text-gray-500">Loading analytics...</div></div>;
  if (error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-lg text-red-600">Error: {error}</div></div>;

  const {
    stats, scoreBuckets, dailyTrend, responses, questions,
    levels = ['Unaware', 'Aware', 'Ready', 'Competent', 'Catalyst'],
    readinessLevels = [
      { name: 'Expert Ready',     persona: 'Disciplined' },
      { name: 'Advanced Ready',   persona: 'Crafter'     },
      { name: 'Moderately Ready', persona: 'Explorer'    },
      { name: 'Developing',       persona: 'Learner'     },
      { name: 'Novice',           persona: 'Observer'    },
    ],
    sessions: sessionsData = [],
    courses: coursesData = [],
  } = data;
  const total = stats.total_responses || 0;

  // Per-question averages (computed client-side from answers_json)
  const questionAvgs = {};
  if (questions && responses) {
    for (const q of questions) {
      const scores = responses
        .map(r => { try { return JSON.parse(r.answers_json)[q.id]; } catch { return undefined; } })
        .filter(s => s !== undefined);
      const maxWeight = q.options.length ? Math.max(...q.options.map(o => o.weight)) : 5;
      questionAvgs[q.id] = {
        avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        maxWeight,
        count: scores.length
      };
    }
  }

  // Per-pillar performance (avg of question avgs within each pillar)
  const pillarPerfMap = {};
  for (const q of (questions || [])) {
    if (!pillarPerfMap[q.category]) pillarPerfMap[q.category] = { sum: 0, count: 0 };
    pillarPerfMap[q.category].sum   += (questionAvgs[q.id]?.avg || 0);
    pillarPerfMap[q.category].count += 1;
  }
  const pillarPerfList = Object.entries(pillarPerfMap)
    .map(([name, { sum, count }]) => ({ name, avg: count > 0 ? sum / count : 0 }))
    .sort((a, b) => a.avg - b.avg);

  // Per-dimension performance (avg of question avgs within each dimension)
  const dimensionPerfMap = {};
  for (const q of (questions || [])) {
    if (!q.dimension) continue;
    if (!dimensionPerfMap[q.dimension]) dimensionPerfMap[q.dimension] = { sum: 0, count: 0, pillars: new Set() };
    dimensionPerfMap[q.dimension].sum   += (questionAvgs[q.id]?.avg || 0);
    dimensionPerfMap[q.dimension].count += 1;
    dimensionPerfMap[q.dimension].pillars.add(q.category);
  }
  const dimensionPerfList = Object.entries(dimensionPerfMap)
    .map(([name, { sum, count, pillars }]) => ({ name, avg: count > 0 ? sum / count : 0, pillars: [...pillars] }))
    .sort((a, b) => a.avg - b.avg);

  // Cumulative trend for line chart
  const cumulativeTrend = dailyTrend.reduce((acc, d, i) => {
    const prev = i === 0 ? 0 : acc[i - 1].cumulative;
    acc.push({ ...d, cumulative: prev + d.count });
    return acc;
  }, []);
  const cumulativeMax = cumulativeTrend.length ? cumulativeTrend[cumulativeTrend.length - 1].cumulative : 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Readiness Assessment Analytics</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportCSV} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm">Export CSV</button>
            <button onClick={() => fetchData(localStorage.getItem('adminToken'))} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded-lg transition-colors text-sm">Refresh</button>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm">Logout</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-200 rounded-xl p-1 w-fit">
          {['analytics', 'questions', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'questions' ? `Questions (${questions?.length ?? 0})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Analytics Tab ─────────────────────────────────────────────── */}
        {activeTab === 'analytics' && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Responses" value={total} color="text-blue-600" />
              <StatCard label="Average Score" value={(stats.avg_score || 0).toFixed(2)} sub="out of 5.00" color="text-blue-700" />
              <StatCard label="Highest Score"  value={(stats.max_score || 0).toFixed(2)} sub="out of 5.00" color="text-blue-900" />

              {/* Score range slider card */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <div className="text-3xl font-bold text-blue-600 mb-1 tabular-nums">
                  {total > 0
                    ? `${(stats.min_score || 0).toFixed(2)}–${(stats.max_score || 0).toFixed(2)}`
                    : '—'}
                </div>
                <div className="text-sm font-medium text-gray-700">Score Range</div>
                {total > 0 ? (
                  <>
                    <div className="relative w-full h-1.5 bg-gray-100 rounded-full mt-3 mb-1">
                      {/* Min-to-max fill */}
                      <div
                        className="absolute h-1.5 bg-blue-200 rounded-full"
                        style={{
                          left:  `${((stats.min_score || 0) / 5) * 100}%`,
                          width: `${(((stats.max_score || 0) - (stats.min_score || 0)) / 5) * 100}%`,
                        }}
                      />
                      {/* Average dot */}
                      <div
                        className="absolute w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow -top-[3px] -translate-x-1/2"
                        style={{ left: `${((stats.avg_score || 0) / 5) * 100}%` }}
                        title={`Average: ${(stats.avg_score || 0).toFixed(2)}`}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>0</span>
                      <span className="text-blue-600 font-medium">avg {(stats.avg_score || 0).toFixed(2)}</span>
                      <span>5</span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400 mt-0.5">No data yet</div>
                )}
              </div>
            </div>

            {/* Readiness Level Distribution */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Readiness Level Distribution</h2>
              <div className="space-y-4">
                {[
                  { label: readinessLevels[0].name, count: stats.expert_count,     colors: READINESS_LEVEL_STYLES[0] },
                  { label: readinessLevels[1].name, count: stats.advanced_count,   colors: READINESS_LEVEL_STYLES[1] },
                  { label: readinessLevels[2].name, count: stats.moderate_count,   colors: READINESS_LEVEL_STYLES[2] },
                  { label: readinessLevels[3].name, count: stats.developing_count, colors: READINESS_LEVEL_STYLES[3] },
                  { label: readinessLevels[4].name, count: stats.novice_count,     colors: READINESS_LEVEL_STYLES[4] },
                ].map(({ label, count, colors }) => {
                  const c = count || 0;
                  const pct = total ? (c / total) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-semibold ${colors.text}`}>{label}</span>
                        <span className="text-gray-500">{c}</span>
                      </div>
                      <Bar pct={pct} colorClass={colors.bar} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submission Trend */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Submissions — Last 30 Days</h2>
              <p className="text-xs text-gray-500 mb-5">Cumulative total submissions over time</p>
              {cumulativeTrend.length === 0 ? (
                <p className="text-gray-400 text-sm">No submissions in the last 30 days</p>
              ) : (() => {
                const SVG_H = 140;
                const PAD = { top: 12, bottom: 28, left: 36, right: 12 };
                const plotH = SVG_H - PAD.top - PAD.bottom;
                const pointSpacing = Math.max(20, Math.min(40, 600 / cumulativeTrend.length));
                const plotW = Math.max((cumulativeTrend.length - 1) * pointSpacing, 200);
                const SVG_W = plotW + PAD.left + PAD.right;

                const pts = cumulativeTrend.map((d, i) => ({
                  x: PAD.left + (cumulativeTrend.length === 1 ? plotW / 2 : (i / (cumulativeTrend.length - 1)) * plotW),
                  y: PAD.top + plotH - (d.cumulative / cumulativeMax) * plotH,
                  ...d
                }));

                const linePts = pts.map(p => `${p.x},${p.y}`).join(' ');
                const fillPath = `M ${pts[0].x} ${PAD.top + plotH} L ${pts.map(p => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${PAD.top + plotH} Z`;
                const yLabels = [
                  { y: PAD.top + plotH, val: 0 },
                  { y: PAD.top + plotH / 2, val: Math.round(cumulativeMax / 2) },
                  { y: PAD.top, val: cumulativeMax },
                ];
                const labelStep = Math.max(1, Math.ceil(pts.length / 6));
                const xLabels = pts.filter((_, i) => i % labelStep === 0 || i === pts.length - 1);

                return (
                  <div className="overflow-x-auto">
                    <svg width={SVG_W} height={SVG_H} style={{ minWidth: SVG_W, display: 'block' }}>
                      {yLabels.map(({ y }) => <line key={y} x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />)}
                      {yLabels.map(({ y, val }) => <text key={y} x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{val}</text>)}
                      <path d={fillPath} fill="#3b82f6" fillOpacity="0.1" />
                      <polyline fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" points={linePts} />
                      {pts.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                          <title>{p.date}: {p.cumulative} total ({p.count} new)</title>
                        </g>
                      ))}
                      {xLabels.map(p => <text key={p.date} x={p.x} y={SVG_H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">{p.date.slice(5)}</text>)}
                    </svg>
                  </div>
                );
              })()}
            </div>

            {/* Performance by Pillar + Dimension side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Performance by Pillar</h2>
                <p className="text-xs text-gray-500 mb-5">Average score per pillar (sorted hardest → easiest)</p>
                {total === 0 ? <p className="text-gray-400 text-sm">No data yet</p> : (
                  <div className="space-y-3">
                    {pillarPerfList.map(({ name, avg }) => {
                      const pct = (avg / 5) * 100;
                      const barColor = pct >= 70 ? 'bg-blue-600' : pct >= 50 ? 'bg-blue-400' : 'bg-blue-200';
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-gray-700">{name}</span>
                            <span className="text-gray-500">{avg.toFixed(2)} / 5</span>
                          </div>
                          <Bar pct={pct} colorClass={barColor} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Performance by Dimension</h2>
                <p className="text-xs text-gray-500 mb-5">Average score per dimension (sorted hardest → easiest)</p>
                {total === 0 ? <p className="text-gray-400 text-sm">No data yet</p> : dimensionPerfList.length === 0 ? (
                  <p className="text-gray-400 text-sm">No dimensions set on questions yet</p>
                ) : (
                  <div className="space-y-3">
                    {dimensionPerfList.map(({ name, avg, pillars }) => {
                      const pct = (avg / 5) * 100;
                      const barColor = pct >= 70 ? 'bg-blue-600' : pct >= 50 ? 'bg-blue-400' : 'bg-blue-200';
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <div>
                              <span className="font-semibold text-gray-700">{name}</span>
                              <span className="text-gray-400 ml-2">{pillars.join(', ')}</span>
                            </div>
                            <span className="text-gray-500 flex-shrink-0 ml-2">{avg.toFixed(2)} / 5</span>
                          </div>
                          <Bar pct={pct} colorClass={barColor} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Per-department radar charts */}
            {(() => {
              // Build per-dept pillar averages from raw response data (SP staff only)
              const deptAccum = {}; // { dept: { pillarName: { sum, count, maxSum, minSum } } }

              for (const r of responses) {
                if (!r.is_sp_staff || !r.department) continue;
                let ans = {};
                try { ans = JSON.parse(r.answers_json); } catch {}

                if (!deptAccum[r.department]) deptAccum[r.department] = {};

                for (const q of questions) {
                  const score = parseFloat(ans[q.id]);
                  if (isNaN(score)) continue;
                  if (!deptAccum[r.department][q.category])
                    deptAccum[r.department][q.category] = { sum: 0, count: 0 };
                  deptAccum[r.department][q.category].sum   += score;
                  deptAccum[r.department][q.category].count += 1;
                }
              }

              const deptEntries = Object.entries(deptAccum);
              if (deptEntries.length === 0) return null;

              return (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-1">Department Competency Profiles</h2>
                  <p className="text-xs text-gray-500 mb-6">Average pillar scores per SP school/department (SP staff only)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                    {deptEntries.map(([dept, pillarsRaw]) => {
                      const pillars = Object.entries(pillarsRaw).map(([name, { sum, count }]) => ({
                        name,
                        pct: Math.round(((sum / count) / 5) * 100),
                      }));
                      const strongest = [...pillars].sort((a, b) => b.pct - a.pct)[0];
                      const weakest   = [...pillars].sort((a, b) => a.pct - b.pct)[0];
                      const responseCount = responses.filter(r => r.is_sp_staff && r.department === dept).length;
                      return (
                        <div key={dept} className="flex flex-col items-center">
                          <p className="text-sm font-bold text-gray-800 mb-0.5">{dept}</p>
                          <p className="text-xs text-gray-400 mb-2">{responseCount} response{responseCount !== 1 ? 's' : ''}</p>
                          <RadarChart pillars={pillars} size={180} />
                          <div className="mt-2 text-center space-y-0.5">
                            <p className="text-xs text-green-600 font-medium">Strongest: {strongest?.name}</p>
                            <p className="text-xs text-red-500 font-medium">Weakest: {weakest?.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Responses Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900">All Responses</h2>
                <span className="text-sm text-gray-400">{responses.length} records</span>
              </div>
              {responses.length === 0 ? (
                <div className="text-center py-16 text-gray-400">No responses yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Readiness Level</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Score</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {responses.map(r => {
                        const rlIdx = r.score_pct >= 4 ? 0 : r.score_pct >= 3 ? 1 : r.score_pct >= 2 ? 2 : r.score_pct >= 1 ? 3 : 4;
                        const colors = READINESS_LEVEL_STYLES[rlIdx];
                        const isExpanded = expandedRow === r.id;
                        let parsedAnswers = {};
                        try { parsedAnswers = JSON.parse(r.answers_json); } catch {}
                        return (
                          <>
                            <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-500">{r.id}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors.bg} ${colors.text}`}>{readinessLevels[rlIdx].name}</span>
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-800">{(r.score_pct || 0).toFixed(2)} / 5</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.submitted_at).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <button onClick={() => setExpandedRow(isExpanded ? null : r.id)} className="text-xs text-blue-600 hover:underline">
                                  {isExpanded ? 'Hide' : 'View'} answers
                                </button>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${r.id}-expand`} className="bg-blue-50">
                                <td colSpan={5} className="px-4 py-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
                                    {questions.map(q => {
                                      const score = parsedAnswers[q.id];
                                      const maxW = q.options.length ? Math.max(...q.options.map(o => o.weight)) : 5;
                                      return (
                                        <div key={q.id} className="text-center">
                                          <div className="text-xs text-gray-500 mb-1 truncate" title={q.category}>{q.category}</div>
                                          <div className={`text-sm font-bold rounded px-2 py-1 ${
                                            score === undefined ? 'bg-gray-100 text-gray-400' :
                                            score / maxW >= 0.8 ? 'bg-green-100 text-green-700' :
                                            score / maxW >= 0.6 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {score !== undefined ? `${score}/${maxW}` : 'N/A'}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Settings Tab ──────────────────────────────────────────────── */}
        {activeTab === 'settings' && (() => {
          const workingOptionLevels = editLevels ?? levels;
          const optionLevelsValid = workingOptionLevels.every(l => l.trim().length > 0);

          const saveOptionLevels = async () => {
            setLevelsSaving(true);
            try {
              const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'update_levels', levels: workingOptionLevels })
              });
              const result = await res.json();
              if (!result.success) throw new Error(result.error);
              setEditLevels(null);
              await fetchData(localStorage.getItem('adminToken'));
            } catch (err) { alert(`Failed: ${err.message}`); }
            finally { setLevelsSaving(false); }
          };

          const workingReadiness = editReadinessLevels ?? readinessLevels;
          const readinessValid = workingReadiness.every(l => l.name?.trim() && l.persona?.trim());

          const saveReadinessLevels = async () => {
            setReadinessSaving(true);
            try {
              const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'update_readiness_levels', readinessLevels: workingReadiness })
              });
              const result = await res.json();
              if (!result.success) throw new Error(result.error);
              setEditReadinessLevels(null);
              await fetchData(localStorage.getItem('adminToken'));
            } catch (err) { alert(`Failed: ${err.message}`); }
            finally { setReadinessSaving(false); }
          };

          const workingCourses = editCourses ?? coursesData;
          const coursesValid = workingCourses.every(c => c.name?.trim().length > 0);

          const saveCourses = async () => {
            setCoursesSaving(true);
            try {
              const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'update_courses', courses: workingCourses })
              });
              const result = await res.json();
              if (!result.success) throw new Error(result.error);
              setEditCourses(null);
              await fetchData(localStorage.getItem('adminToken'));
            } catch (err) { alert(`Failed: ${err.message}`); }
            finally { setCoursesSaving(false); }
          };

          return (
            <div className="max-w-2xl space-y-6">

              {/* Readiness level names */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Overall Readiness Level Names</h2>
                <p className="text-xs text-gray-500 mb-5">
                  These labels appear on the results page and analytics. Ordered from highest score (≥ 4.0) to lowest (&lt; 1.0).
                </p>
                <div className="space-y-3">
                  {workingReadiness.map((lvl, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`w-8 text-xs font-semibold text-center flex-shrink-0 ${READINESS_LEVEL_STYLES[i].text}`}>
                        {['≥4', '≥3', '≥2', '≥1', '<1'][i]}
                      </span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={lvl.name}
                          onChange={e => {
                            const next = workingReadiness.map((l, j) => j === i ? { ...l, name: e.target.value } : l);
                            setEditReadinessLevels(next);
                          }}
                          placeholder="Level name"
                        />
                        <input
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={lvl.persona}
                          onChange={e => {
                            const next = workingReadiness.map((l, j) => j === i ? { ...l, persona: e.target.value } : l);
                            setEditReadinessLevels(next);
                          }}
                          placeholder="Persona"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2 pl-11">
                    <p className="text-xs text-gray-400">Level name</p>
                    <p className="text-xs text-gray-400">Persona</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button
                    disabled={!readinessValid || readinessSaving}
                    onClick={saveReadinessLevels}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                      readinessValid && !readinessSaving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {readinessSaving ? 'Saving…' : 'Save'}
                  </button>
                  {editReadinessLevels && (
                    <button
                      onClick={() => setEditReadinessLevels(null)}
                      className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Option level names */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Answer Option Level Names</h2>
                <p className="text-xs text-gray-500 mb-5">
                  These labels are shown on each answer option in the admin question view, ordered from lowest (option 1) to highest (option 5).
                </p>
                <div className="space-y-3">
                  {workingOptionLevels.map((name, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className={`w-24 text-xs font-semibold px-2 py-1 rounded-full text-center flex-shrink-0 ${OPTION_LEVEL_COLORS[i]}`}>
                        {name || '…'}
                      </span>
                      <input
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={name}
                        onChange={e => {
                          const next = [...workingOptionLevels];
                          next[i] = e.target.value;
                          setEditLevels(next);
                        }}
                        placeholder={`Level ${i + 1} name`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-5">
                  <button
                    disabled={!optionLevelsValid || levelsSaving}
                    onClick={saveOptionLevels}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                      optionLevelsValid && !levelsSaving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {levelsSaving ? 'Saving…' : 'Save'}
                  </button>
                  {editLevels && (
                    <button
                      onClick={() => setEditLevels(null)}
                      className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Company Codes */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Company Codes</h2>
                <p className="text-xs text-gray-500 mb-5">
                  Add a company by name — a code is generated automatically. Share the code with their staff so their survey responses are grouped together. The company can view their consolidated results at <span className="font-mono text-blue-600">/dashboard</span>.
                </p>

                {/* Generated code banner */}
                {generatedCode && (
                  <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Code generated — share this with the company. It won't be shown again.</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="font-mono text-xl font-bold text-blue-800 tracking-widest">{generatedCode}</span>
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard.writeText(generatedCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                      >
                        {codeCopied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeneratedCode(null)}
                        className="text-xs text-blue-500 hover:underline ml-auto"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}

                {/* Existing codes */}
                {sessionsData.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-4">No companies added yet.</p>
                ) : (
                  <div className="space-y-2 mb-5">
                    {sessionsData.map(s => (
                      <div key={s.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {s.response_count} response{s.response_count !== 1 ? 's' : ''} · Added {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={sessionSaving}
                          onClick={async () => {
                            if (!window.confirm(`Remove "${s.name}"? Their ${s.response_count} response(s) will be kept but unlinked.`)) return;
                            setSessionSaving(true);
                            try {
                              const res = await fetch('/api/sessions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                                body: JSON.stringify({ action: 'delete', id: s.id })
                              });
                              const result = await res.json();
                              if (!result.success) throw new Error(result.error);
                              await fetchData(localStorage.getItem('adminToken'));
                            } catch (err) { alert(`Failed: ${err.message}`); }
                            finally { setSessionSaving(false); }
                          }}
                          className="text-xs text-red-500 hover:underline font-medium flex-shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add company */}
                <div className="border-t border-gray-100 pt-4 flex gap-2">
                  <input
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={newSessionName}
                    onChange={e => setNewSessionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && newSessionName.trim() && !sessionSaving && document.getElementById('btn-gen-code').click()}
                    placeholder="Company / organisation name"
                  />
                  <button
                    id="btn-gen-code"
                    type="button"
                    disabled={!newSessionName.trim() || sessionSaving}
                    onClick={async () => {
                      setSessionSaving(true);
                      setGeneratedCode(null);
                      try {
                        const res = await fetch('/api/sessions', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                          body: JSON.stringify({ action: 'create', name: newSessionName.trim() })
                        });
                        const result = await res.json();
                        if (!result.success) throw new Error(result.error);
                        setGeneratedCode(result.code);
                        setNewSessionName('');
                        await fetchData(localStorage.getItem('adminToken'));
                      } catch (err) { alert(`Failed: ${err.message}`); }
                      finally { setSessionSaving(false); }
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex-shrink-0 ${
                      newSessionName.trim() && !sessionSaving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {sessionSaving ? 'Generating…' : 'Generate Code'}
                  </button>
                </div>
              </div>

              {/* Skills & Training Courses */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Skills &amp; Training Courses</h2>
                <p className="text-xs text-gray-500 mb-5">
                  Define courses shown on the results page. Tick the readiness levels each course applies to (highest → lowest).
                </p>

                {/* Column headers */}
                {workingCourses.length > 0 && (
                  <div className="flex items-end gap-2 mb-1 px-4">
                    <span className="flex-1 text-xs font-semibold text-gray-400">Course name</span>
                    {workingReadiness.map((lvl, i) => (
                      <div key={i} className="w-12 text-center flex-shrink-0">
                        <span className={`text-xs font-semibold ${READINESS_LEVEL_STYLES[i].text}`} title={lvl.name}>
                          {lvl.name.split(' ')[0].slice(0, 5)}
                        </span>
                      </div>
                    ))}
                    <div className="w-6" />
                  </div>
                )}

                {/* Course rows */}
                <div className="space-y-2 mb-4">
                  {workingCourses.length === 0 && (
                    <p className="text-sm text-gray-400">No courses added yet. Click "+ Add Course" below.</p>
                  )}
                  {workingCourses.map((course, ci) => (
                    <div key={ci} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                      <input
                        className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                        value={course.name}
                        onChange={e => {
                          const next = workingCourses.map((c, j) => j === ci ? { ...c, name: e.target.value } : c);
                          setEditCourses(next);
                        }}
                        placeholder="Course name"
                      />
                      {[0, 1, 2, 3, 4].map(li => (
                        <div key={li} className="w-12 flex justify-center flex-shrink-0">
                          <input
                            type="checkbox"
                            checked={course.levels?.includes(li) ?? false}
                            onChange={e => {
                              const next = workingCourses.map((c, j) => {
                                if (j !== ci) return c;
                                const newLevels = e.target.checked
                                  ? [...(c.levels ?? []), li].sort((a, b) => a - b)
                                  : (c.levels ?? []).filter(l => l !== li);
                                return { ...c, levels: newLevels };
                              });
                              setEditCourses(next);
                            }}
                            className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setEditCourses(workingCourses.filter((_, j) => j !== ci))}
                        className="w-6 text-red-400 hover:text-red-600 text-xl leading-none flex-shrink-0 text-center"
                        title="Remove course"
                      >×</button>
                    </div>
                  ))}
                </div>

                {/* Add + Save */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditCourses([...workingCourses, { name: '', levels: [] }])}
                    className="text-sm text-blue-600 hover:underline font-semibold"
                  >
                    + Add Course
                  </button>
                  <div className="flex gap-2">
                    {editCourses && (
                      <button
                        type="button"
                        onClick={() => setEditCourses(null)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!coursesValid || coursesSaving}
                      onClick={saveCourses}
                      className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                        coursesValid && !coursesSaving ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      {coursesSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* ── Questions Tab ─────────────────────────────────────────────── */}
        {activeTab === 'questions' && (() => {
          // Group questions by pillar, preserving order of first appearance
          const pillarMap = new Map();
          for (const q of questions) {
            if (!pillarMap.has(q.category)) pillarMap.set(q.category, []);
            pillarMap.get(q.category).push(q);
          }
          const pillarGroups = Array.from(pillarMap.entries()); // [[name, [q,...]], ...]
          const existingCategories = Array.from(pillarMap.keys());

          const reorderPillars = async (newOrder) => {
            setQSaving(true);
            try {
              const res = await fetch('/api/admin/questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'reorder_pillars', order: newOrder })
              });
              const result = await res.json();
              if (!result.success) throw new Error(result.error);
              await fetchData(localStorage.getItem('adminToken'));
            } catch (err) { alert(`Failed: ${err.message}`); }
            finally { setQSaving(false); }
          };

          const movePillar = (idx, direction) => {
            const newOrder = pillarGroups.map(([name]) => name);
            const swapIdx = idx + direction;
            [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
            reorderPillars(newOrder);
          };

          const openAddForm = (category = '') => {
            setAddFormCategory(category);
            setShowAddForm(true);
            setEditingId(null);
          };
          const closeAddForm = () => { setShowAddForm(false); setAddFormCategory(''); };

          return (
            <div className="space-y-6">
              {/* Global add button */}
              {!showAddForm && (
                <div className="flex justify-end">
                  <button
                    onClick={() => openAddForm()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
                  >
                    + Add Question
                  </button>
                </div>
              )}

              {/* Global add form (no specific pillar) */}
              {showAddForm && !addFormCategory && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200">
                  <h3 className="text-base font-bold text-gray-900 mb-4">New Question</h3>
                  <QuestionForm
                    existingCategories={existingCategories}
                    onSave={form => questionAction('create', form)}
                    onCancel={closeAddForm}
                    levels={levels}
                  />
                </div>
              )}

              {questions.length === 0 && !showAddForm && (
                <div className="text-center py-16 text-gray-400">No questions yet. Click "+ Add Question" to get started.</div>
              )}

              {/* Pillar sections */}
              {pillarGroups.map(([pillarName, pillarQs], pillarIdx) => (
                <div key={pillarName}>
                  {/* Pillar-specific add form renders above this pillar */}
                  {showAddForm && addFormCategory === pillarName && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-blue-200 mb-4">
                      <h3 className="text-base font-bold text-gray-900 mb-4">New Question — {pillarName}</h3>
                      <QuestionForm
                        initial={{ category: pillarName, question: '', dimension: '', q_id: '', options: DEFAULT_OPTIONS }}
                        existingCategories={existingCategories}
                        onSave={form => questionAction('create', form)}
                        onCancel={closeAddForm}
                        levels={levels}
                      />
                    </div>
                  )}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {/* Pillar header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {pillarIdx + 1}
                      </span>
                      <span className="font-bold text-gray-800 text-base">{pillarName}</span>
                      <span className="text-xs text-gray-400">{pillarQs.length} question{pillarQs.length !== 1 ? 's' : ''}</span>
                    </div>
                    {!showAddForm && (
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => movePillar(pillarIdx, -1)}
                            disabled={pillarIdx === 0 || qSaving}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                            title="Move up"
                          >↑</button>
                          <button
                            onClick={() => movePillar(pillarIdx, 1)}
                            disabled={pillarIdx === pillarGroups.length - 1 || qSaving}
                            className="w-6 h-6 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 disabled:opacity-25 disabled:cursor-not-allowed text-xs"
                            title="Move down"
                          >↓</button>
                        </div>
                        <button
                          onClick={() => openAddForm(pillarName)}
                          className="text-xs text-blue-600 hover:underline font-semibold"
                        >
                          + Add to this pillar
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete the entire "${pillarName}" pillar and all ${pillarQs.length} question${pillarQs.length !== 1 ? 's' : ''} in it? This cannot be undone.`))
                              questionAction('delete_pillar', { category: pillarName });
                          }}
                          className="text-xs text-red-500 hover:underline font-semibold"
                          disabled={qSaving}
                        >
                          Delete pillar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Questions in this pillar */}
                  <div className="divide-y divide-gray-50">
                    {pillarQs.map((q, qIdx) => (
                      <div key={q.id} className={editingId === q.id ? 'border-l-4 border-blue-400' : ''}>
                        {editingId === q.id ? (
                          <div className="p-5">
                            <QuestionForm
                              initial={{ category: q.category, question: q.question, dimension: q.dimension || '', q_id: q.q_id || '', options: q.options.map(o => ({ text: o.text, weight: o.weight })) }}
                              existingCategories={existingCategories}
                              onSave={form => questionAction('update', { id: q.id, ...form })}
                              onCancel={() => setEditingId(null)}
                              levels={levels}
                            />
                          </div>
                        ) : (
                          <div className="px-5 py-4">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-gray-400 font-medium">Q{qIdx + 1} · {q.options.length} options</span>
                                <p className="text-sm text-gray-800 leading-snug mt-0.5">{q.question}</p>
                              </div>
                              <div className="flex gap-3 flex-shrink-0 pt-0.5">
                                <button
                                  onClick={() => { setEditingId(q.id); closeAddForm(); }}
                                  className="text-xs text-blue-600 hover:underline font-medium"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => { if (window.confirm(`Delete this question? This cannot be undone.`)) questionAction('delete', { id: q.id }); }}
                                  className="text-xs text-red-500 hover:underline font-medium"
                                  disabled={qSaving}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {q.options.map((opt, optIdx) => (
                                <span key={opt.id} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                                  {levels[optIdx] && (
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${OPTION_LEVEL_COLORS[optIdx]}`}>
                                      {levels[optIdx]}
                                    </span>
                                  )}
                                  {opt.text.slice(0, 45)}{opt.text.length > 45 ? '…' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              ))}
            </div>
          );
        })()}

      </div>
    </div>
  );
}

export default AdminPage;
