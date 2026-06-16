import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RadarChart from '../components/RadarChart';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Footer from '../components/Footer';

function TrendChart({ trend, maxVal }) {
  const containerRef = useRef(null);
  const [dims, setDims] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (trend.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center">
        <p className="text-xs text-gray-400">No submissions yet</p>
      </div>
    );
  }

  if (!dims) return <div ref={containerRef} className="w-full h-full" />;

  const { w, h } = dims;
  const PAD = { top: 20, bottom: 20, left: 32, right: 16 };
  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const safeMax = maxVal || 1;

  const pts = trend.map((d, i) => ({
    x: PAD.left + (trend.length === 1 ? plotW / 2 : (i / (trend.length - 1)) * plotW),
    y: PAD.top + plotH - (d.count / safeMax) * plotH,
    ...d,
  }));
  const linePts = pts.map(p => `${p.x},${p.y}`).join(' ');
  const fillPath = `M ${pts[0].x} ${PAD.top + plotH} L ${pts.map(p => `${p.x} ${p.y}`).join(' L ')} L ${pts[pts.length - 1].x} ${PAD.top + plotH} Z`;
  const yLabels = [0, 0.5, 1].map(t => ({ y: PAD.top + plotH * (1 - t), val: Math.round(safeMax * t) }));
  const labelStep = Math.max(1, Math.ceil(pts.length / 7));
  const xLabels = pts.filter((_, i) => i % labelStep === 0 || i === pts.length - 1);

  const TIP_W = 80, TIP_H = 28;

  return (
    <div ref={containerRef} className="w-full h-full">
      <svg width={w} height={h} style={{ display: 'block' }} onMouseLeave={() => setHovered(null)}>
        {yLabels.map(({ y }) => (
          <line key={y} x1={PAD.left} x2={w - PAD.right} y1={y} y2={y} stroke="#f0f0f0" strokeWidth="1" />
        ))}
        {yLabels.map(({ y, val }) => (
          <text key={y} x={PAD.left - 3} y={y + 3.5} textAnchor="end" fontSize="9" fill="#9ca3af">{val}</text>
        ))}
        <path d={fillPath} fill="#22c55e" fillOpacity="0.1" />
        <polyline fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" points={linePts} />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHovered(p)} style={{ cursor: 'default' }}>
            <circle cx={p.x} cy={p.y} r="6" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hovered === p ? 4 : 2.5} fill="#22c55e" stroke="white" strokeWidth="1.5" />
            {p.count > 0 && (
              <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9" fontWeight="600" fill="#22c55e">{p.count}</text>
            )}
          </g>
        ))}
        {xLabels.map(p => (
          <text key={p.date} x={p.x} y={h - 3} textAnchor="middle" fontSize="9" fill="#9ca3af">{p.date.slice(5)}</text>
        ))}
        {hovered && (() => {
          const tx = Math.min(Math.max(hovered.x - TIP_W / 2, PAD.left), w - PAD.right - TIP_W);
          const ty = hovered.y - TIP_H - 8;
          return (
            <g>
              <rect x={tx} y={ty} width={TIP_W} height={TIP_H} rx="4" fill="#1e293b" opacity="0.9" />
              <text x={tx + TIP_W / 2} y={ty + 10} textAnchor="middle" fontSize="9" fill="#94a3b8">{hovered.date}</text>
              <text x={tx + TIP_W / 2} y={ty + 21} textAnchor="middle" fontSize="10" fontWeight="600" fill="white">{hovered.count} submission{hovered.count !== 1 ? 's' : ''}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

function CompanyPlotlyChart({ plotly, data, layout }) {
  const divRef = useRef(null);
  useEffect(() => {
    if (!plotly || !divRef.current || !data?.length) return;
    plotly.react(divRef.current, data, {
      ...layout,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { family: 'inherit' },
    }, { responsive: true, displayModeBar: false, scrollZoom: false });
  }, [plotly, data, layout]);
  return <div ref={divRef} className="w-full h-full" style={{ minHeight: 0 }} />;
}

// Dice-coefficient word overlap, strips common company suffixes before comparing
function companyNameSimilarity(a, b) {
  const norm = s => s.toLowerCase()
    .replace(/\b(pte|ltd|llp|inc|corp|sdn|bhd|private|limited|co|sg|singapore)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = new Set(na.split(/\s+/).filter(Boolean));
  const wb = new Set(nb.split(/\s+/).filter(Boolean));
  const shared = [...wa].filter(w => wb.has(w)).length;
  return (2 * shared) / (wa.size + wb.size);
}

const SECTORS = [
  'Maritime',
  'Technology',
  'Healthcare',
  'Education',
  'Finance & Banking',
  'Manufacturing',
  'Logistics',
  'Government & Public Sector',
  'Retail',
  'Construction',
];

const OPTION_LEVEL_COLORS = [
  'bg-slate-100 text-slate-600',   // 0: Unaware  (lightest)
  'bg-green-100 text-green-600',     // 1: Aware
  'bg-green-200 text-green-700',     // 2: Ready
  'bg-green-300 text-green-800',     // 3: Competent
  'bg-green-500 text-white',        // 4: Catalyst (darkest)
];

// Indexed by position: 0=highest(≥4) … 4=lowest(<1) — blue intensity scale
const READINESS_LEVEL_STYLES = [
  { bg: 'bg-green-100', text: 'text-green-900', bar: 'bg-green-800' },  // 0: Expert   (darkest)
  { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-600' },  // 1: Advanced
  { bg: 'bg-green-50',  text: 'text-green-600', bar: 'bg-green-400' },  // 2: Moderate
  { bg: 'bg-green-50',  text: 'text-green-500', bar: 'bg-green-300' },  // 3: Developing
  { bg: 'bg-slate-50', text: 'text-slate-500', bar: 'bg-green-200'},  // 4: Novice   (lightest)
];

function Bar({ pct, colorClass, color }) {
  return (
    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full transition-all duration-500 ${colorClass || ''}`}
        style={{ width: `${Math.max(pct, 0)}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            value={form.dimension}
            onChange={e => setField('dimension', e.target.value)}
            placeholder="e.g. Use Case Identification"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Question ID <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent mt-2"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
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
            className="text-xs text-green-600 hover:underline font-medium"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            valid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
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
  const [editRegistrationLabel, setEditRegistrationLabel] = useState(null);
  const [regLabelSaving, setRegLabelSaving] = useState(false);
  // Company codes state
  const [newSessionName, setNewSessionName] = useState('');
  const [sessionSaving, setSessionSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null); // shown once after creation
  const [codeCopied, setCodeCopied] = useState(false);
  // Courses state
  const [editCourses, setEditCourses] = useState(null);
  const [coursesSaving, setCoursesSaving] = useState(false);
  // Slicer filter state (null = All)
  const [levelFilter, setLevelFilter] = useState(null);
  // Company code visibility state { [id]: boolean }
  const [shownCodes, setShownCodes] = useState({});
  // New session sector
  const [newSessionSector, setNewSessionSector] = useState('');
  // New session: pending link to an existing company + round label
  const [pendingLink, setPendingLink] = useState(null); // { id, name, company_uen }
  const [newSessionRoundLabel, setNewSessionRoundLabel] = useState('');
  // Department creation state
  const [addingDeptForSession, setAddingDeptForSession] = useState(null); // session id being expanded
  const [newDeptName, setNewDeptName] = useState('');
  const [deptSaving, setDeptSaving] = useState(false);
  // Completed courses per session
  const [editingCompletedCourses, setEditingCompletedCourses] = useState(null); // session id
  const [pendingCompletedCourses, setPendingCompletedCourses] = useState(new Set());
  const [lockedCompletedCourses, setLockedCompletedCourses] = useState(new Set()); // already saved — disabled in UI
  const [completedCoursesSaving, setCompletedCoursesSaving] = useState(false);
  // Company codes search filter
  const [codeSearch, setCodeSearch] = useState('');
  // Company codes date range filter
  const [codeFromDate, setCodeFromDate] = useState('');
  const [codeToDate, setCodeToDate] = useState('');
  // Sector slicer filter (null = All)
  const [sectorFilter, setSectorFilter] = useState(null);
  // Global analytics time range filter
  const [analyticsFromDate, setAnalyticsFromDate] = useState('');
  const [analyticsToDate, setAnalyticsToDate] = useState('');
  // Company selector — drives both analytics filter and comparison chart
  const [selectedCompanyKeys, setSelectedCompanyKeys] = useState([]);
  const [compareChartType, setCompareChartType] = useState('radar');
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  // Plotly library (lazy-loaded)
  const [plotlyLib, setPlotlyLib] = useState(null);
  // Analytics PDF export
  const [exportingPDF, setExportingPDF] = useState(false);
  const analyticsRef = useRef(null);
  const companyDropdownRef = useRef(null);

  useEffect(() => {
    import('plotly.js-dist-min').then(m => setPlotlyLib(m.default)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!companyDropdownOpen) return;
    const handler = (e) => {
      if (companyDropdownRef.current && !companyDropdownRef.current.contains(e.target)) {
        setCompanyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [companyDropdownOpen]);

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

  const exportAdminPDF = async () => {
    const el = analyticsRef.current;
    if (!el) return;
    setExportingPDF(true);

    await document.fonts.ready;

    try {
      // Capture from the already-rendered document so flex/grid layout is preserved
      const rect = el.getBoundingClientRect();
      const canvas = await html2canvas(document.documentElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f9fafb',
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const cw = canvas.width / 2;
      const ch = canvas.height / 2;
      const footerH = 56;
      const totalH = ch + footerH;
      const pdf = new jsPDF({ orientation: cw > ch ? 'landscape' : 'portrait', unit: 'px', format: [cw, totalH] });
      pdf.addImage(imgData, 'PNG', 0, 0, cw, ch);

      // Footer separator
      const mx = 16;
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.5);
      pdf.line(mx, ch + 12, cw - mx, ch + 12);

      // DSAC logo
      const logoData = await new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            const logoH = 28;
            resolve({ data: c.toDataURL('image/png'), w: (img.naturalWidth / img.naturalHeight) * logoH, h: logoH });
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = '/DSAC.png';
      });
      if (logoData) pdf.addImage(logoData.data, 'PNG', mx, ch + 14, logoData.w, logoData.h);

      // Footer text
      pdf.setFontSize(9);
      pdf.setTextColor(156, 163, 175);
      pdf.text('© 2026 DSAC · AISG  |  Licensed under CC BY 4.0', cw - mx, ch + 36, { align: 'right' });

      pdf.save(`Admin_Analytics_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      alert('PDF export failed: ' + err.message);
    } finally {
      setExportingPDF(false);
    }
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
              placeholder="Enter admin password" required
            />
            {authError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{authError}</div>}
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors">Login</button>
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
    registrationLabel: registrationLabelData = 'Company Name',
  } = data;
  const total = stats.total_responses || 0;

  // session → sector lookup
  const sessionSectorMap = {};
  for (const s of sessionsData) sessionSectorMap[s.id] = s.sector || '';

  // Company entries (moved up — needed for global company filter)
  const companyEntries = (() => {
    const uenGroups = {};
    const solos = [];
    for (const s of sessionsData) {
      if (s.company_uen) {
        if (!uenGroups[s.company_uen]) uenGroups[s.company_uen] = [];
        uenGroups[s.company_uen].push(s);
      } else {
        solos.push({ key: `solo_${s.id}`, name: s.name, sessions: [s] });
      }
    }
    const grouped = Object.entries(uenGroups).map(([uen, ss]) => ({
      key: uen,
      name: ss[0].name,
      sessions: ss.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    }));
    return [...grouped, ...solos];
  })();
  const sessionCompanyKeyMap = {};
  for (const entry of companyEntries) {
    for (const s of entry.sessions) sessionCompanyKeyMap[s.id] = entry.key;
  }

  // Filter chain: time → company → sector → level
  const analyticsFromMs = analyticsFromDate ? new Date(analyticsFromDate).getTime() : null;
  const analyticsToMs   = analyticsToDate   ? new Date(analyticsToDate + 'T23:59:59').getTime() : null;
  const timeFilteredResponses = responses.filter(r => {
    const t = new Date(r.submitted_at).getTime();
    if (analyticsFromMs && t < analyticsFromMs) return false;
    if (analyticsToMs   && t > analyticsToMs)   return false;
    return true;
  });

  const companyFilteredResponses = selectedCompanyKeys.length === 0
    ? timeFilteredResponses
    : timeFilteredResponses.filter(r => selectedCompanyKeys.includes(sessionCompanyKeyMap[r.session_id]));

  // Bottom row chain: driven by the Compare selector, not the top company filter
  const bottomCompanyFiltered = selectedCompanyKeys.length === 0
    ? timeFilteredResponses
    : timeFilteredResponses.filter(r => selectedCompanyKeys.includes(sessionCompanyKeyMap[r.session_id]));
  const bottomSectorFiltered = sectorFilter === null
    ? bottomCompanyFiltered
    : bottomCompanyFiltered.filter(r => (sessionSectorMap[r.session_id] || '') === sectorFilter);
  const bottomFilteredResponses = levelFilter === null
    ? bottomSectorFiltered
    : bottomSectorFiltered.filter(r => {
        const idx = r.score_pct >= 4 ? 0 : r.score_pct >= 3 ? 1 : r.score_pct >= 2 ? 2 : r.score_pct >= 1 ? 3 : 4;
        return idx === levelFilter;
      });

  // unique sectors within time + company filter
  const sectorResponseCounts = {};
  for (const r of companyFilteredResponses) {
    const sec = sessionSectorMap[r.session_id] || '';
    if (sec) sectorResponseCounts[sec] = (sectorResponseCounts[sec] || 0) + 1;
  }
  const availableSectors = Object.keys(sectorResponseCounts).sort();

  const sectorFilteredResponses = sectorFilter === null
    ? companyFilteredResponses
    : companyFilteredResponses.filter(r => (sessionSectorMap[r.session_id] || '') === sectorFilter);

  const computeCompanyPillars = (entry, baseResponses) => {
    const sessionIds = new Set(entry.sessions.map(s => s.id));
    const entryResponses = (baseResponses ?? timeFilteredResponses).filter(r => sessionIds.has(r.session_id));
    const acc = {};
    for (const r of entryResponses) {
      let ans = {};
      try { ans = JSON.parse(r.answers_json); } catch {}
      for (const q of questions) {
        const score = parseFloat(ans[q.id]);
        if (isNaN(score)) continue;
        if (!acc[q.category]) acc[q.category] = { sum: 0, count: 0 };
        acc[q.category].sum += score;
        acc[q.category].count += 1;
      }
    }
    return Object.entries(acc).map(([name, { sum, count }]) => ({ name, avg: count > 0 ? sum / count : 0 }));
  };

  const filteredResponses = levelFilter === null
    ? sectorFilteredResponses
    : sectorFilteredResponses.filter(r => {
        const idx = r.score_pct >= 4 ? 0 : r.score_pct >= 3 ? 1 : r.score_pct >= 2 ? 2 : r.score_pct >= 1 ? 3 : 4;
        return idx === levelFilter;
      });
  const filteredTotal = filteredResponses.length;

  // Per-question averages (computed client-side from answers_json)
  const questionAvgs = {};
  if (questions && filteredResponses) {
    for (const q of questions) {
      const scores = filteredResponses
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
  // Stable order matching question definition order (no re-sorting on filter change)
  const pillarPerfList = [...new Set((questions || []).map(q => q.category))].map(name => {
    const entry = pillarPerfMap[name] ?? { sum: 0, count: 0 };
    return { name, avg: entry.count > 0 ? entry.sum / entry.count : 0 };
  });
  const topPillar = pillarPerfList.length > 0
    ? [...pillarPerfList].sort((a, b) => b.avg - a.avg)[0]
    : null;

  // Bottom-row pillar perf — driven by bottomFilteredResponses (bottom company selector + global filters)
  const bottomQuestionAvgs = {};
  if (questions) {
    for (const q of questions) {
      const scores = bottomFilteredResponses
        .map(r => { try { return JSON.parse(r.answers_json)[q.id]; } catch { return undefined; } })
        .filter(s => s !== undefined);
      bottomQuestionAvgs[q.id] = scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;
    }
  }
  const bottomPillarPerfMap = {};
  for (const q of (questions || [])) {
    if (!bottomPillarPerfMap[q.category]) bottomPillarPerfMap[q.category] = { sum: 0, count: 0 };
    bottomPillarPerfMap[q.category].sum   += (bottomQuestionAvgs[q.id] || 0);
    bottomPillarPerfMap[q.category].count += 1;
  }
  const bottomPillarPerfList = [...new Set((questions || []).map(q => q.category))].map(name => {
    const e = bottomPillarPerfMap[name] ?? { sum: 0, count: 0 };
    return { name, avg: e.count > 0 ? e.sum / e.count : 0 };
  });

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

  // Cumulative trend built from filteredResponses so it reacts to all filters
  const cumulativeTrend = (() => {
    if (filteredResponses.length === 0) return [];
    const counts = {};
    for (const r of filteredResponses) {
      const date = r.submitted_at.slice(0, 10);
      counts[date] = (counts[date] || 0) + 1;
    }
    const sorted = Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce((acc, [date, count], i) => {
        const prev = i === 0 ? 0 : acc[i - 1].cumulative;
        acc.push({ date, count, cumulative: prev + count });
        return acc;
      }, []);
    // Prepend a zero-start point one day before the first real date
    const d = new Date(sorted[0].date);
    d.setDate(d.getDate() - 1);
    return [{ date: d.toISOString().slice(0, 10), count: 0, cumulative: 0 }, ...sorted];
  })();
  const cumulativeMax = cumulativeTrend.length ? Math.max(...cumulativeTrend.map(d => d.count)) : 1;

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Admin Dashboard</h1>
          <p className="text-xs text-gray-400">oAIRI — AI Readiness Analytics</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-semibold transition-colors">Export CSV</button>
          <button onClick={() => fetchData(localStorage.getItem('adminToken'))} className="text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">Refresh</button>
          <button onClick={handleLogout} className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">Logout</button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-2">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {['analytics', 'questions', 'settings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-1.5 rounded-md text-sm font-semibold capitalize transition-colors ${
                activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'questions' ? `Questions (${questions?.length ?? 0})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Analytics Tab ── */}
      {activeTab === 'analytics' && (() => {
        const levelCounts = readinessLevels.map((_, i) =>
          sectorFilteredResponses.filter(r => {
            const idx = r.score_pct >= 4 ? 0 : r.score_pct >= 3 ? 1 : r.score_pct >= 2 ? 2 : r.score_pct >= 1 ? 3 : 4;
            return idx === i;
          }).length
        );
        const hasActiveFilter = !!(analyticsFromDate || analyticsToDate || sectorFilter !== null || levelFilter !== null || selectedCompanyKeys.length > 0);
        const fAvg = filteredTotal > 0 ? filteredResponses.reduce((s, r) => s + (r.score_pct || 0), 0) / filteredTotal : 0;
        const fMax = filteredTotal > 0 ? Math.max(...filteredResponses.map(r => r.score_pct || 0)) : 0;
        const distCounts = [0,1,2,3,4].map(i =>
          filteredResponses.filter(r => {
            const idx = r.score_pct >= 4 ? 0 : r.score_pct >= 3 ? 1 : r.score_pct >= 2 ? 2 : r.score_pct >= 1 ? 3 : 4;
            return idx === i;
          }).length
        );
        // Harmonious palette — one stable color per company by its index in companyEntries
        const COMPARE_COLORS = ['#22c55e', '#f97316', '#22c55e', '#a855f7', '#ec4899', '#14b8a6'];
        const companyColorMap = Object.fromEntries(
          companyEntries.map((e, i) => [e.key, COMPARE_COLORS[i % COMPARE_COLORS.length]])
        );
        const selectedEntries = selectedCompanyKeys.map(k => companyEntries.find(e => e.key === k)).filter(Boolean);
        const allPillarNames = [...new Set((questions || []).map(q => q.category))];

        const buildCompareTraces = () => selectedEntries.map(entry => {
          const pillars = computeCompanyPillars(entry, bottomFilteredResponses);
          const avgs = allPillarNames.map(pn => pillars.find(p => p.name === pn)?.avg ?? 0);
          return {
            type: 'bar', name: entry.name,
            x: allPillarNames, y: avgs,
            marker: { color: companyColorMap[entry.key] },
            text: avgs.map(a => a > 0 ? a.toFixed(2) : ''),
            textposition: 'outside', textfont: { size: 9 },
            hovertemplate: `<b>${entry.name}</b><br>%{x}: %{y:.2f}<extra></extra>`,
          };
        });

        const buildCompareAnnotations = () => {
          if (selectedEntries.length !== 2) return [];
          const p1 = computeCompanyPillars(selectedEntries[0], bottomFilteredResponses);
          const p2 = computeCompanyPillars(selectedEntries[1], bottomFilteredResponses);
          return allPillarNames.map(pn => {
            const a = p1.find(p => p.name === pn)?.avg ?? 0;
            const b = p2.find(p => p.name === pn)?.avg ?? 0;
            const delta = b - a;
            return {
              x: pn, y: Math.max(a, b) + 1.1,
              text: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`,
              showarrow: false,
              font: { size: 9, color: delta > 0 ? '#22c55e' : delta < 0 ? '#f87171' : '#9ca3af' },
              xanchor: 'center',
            };
          });
        };



        return (
          <div className="flex-1 flex flex-col min-h-0">
            {/* ── Filter strip ── */}
            <div className="flex-shrink-0 bg-white border-b border-gray-100 px-4 py-2 space-y-2">
              {/* Row 1: date range + compare + actions */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">Filters</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs text-gray-400">From</span>
                  <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs bg-gray-50" value={analyticsFromDate} onChange={e => setAnalyticsFromDate(e.target.value)} />
                  <span className="text-xs text-gray-400">to</span>
                  <input type="date" className="border border-gray-200 rounded px-2 py-1 text-xs bg-gray-50" value={analyticsToDate} onChange={e => setAnalyticsToDate(e.target.value)} />
                  {(analyticsFromDate || analyticsToDate) && (
                    <span className="text-xs text-green-600 font-semibold">{companyFilteredResponses.length}/{responses.length}</span>
                  )}
                </div>
                {/* Company compare dropdown */}
                {companyEntries.length > 0 && (
                  <div ref={companyDropdownRef} className="relative flex-shrink-0">
                    <button
                      onClick={() => { setCompanyDropdownOpen(o => !o); setCompanySearchQuery(''); }}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${selectedCompanyKeys.length > 0 ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-400 hover:text-green-600'}`}
                    >
                      <span>Compare{selectedCompanyKeys.length > 0 ? ` (${selectedCompanyKeys.length})` : ''}</span>
                      <svg className={`w-3 h-3 transition-transform ${companyDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {companyDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg w-64">
                        <div className="p-2 border-b border-gray-100">
                          <input
                            type="text"
                            placeholder="Search companies…"
                            value={companySearchQuery}
                            onChange={e => setCompanySearchQuery(e.target.value)}
                            autoFocus
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto py-1">
                          {companyEntries
                            .filter(e => e.name.toLowerCase().includes(companySearchQuery.toLowerCase()))
                            .map(entry => {
                              const isSel = selectedCompanyKeys.includes(entry.key);
                              return (
                                <button
                                  key={entry.key}
                                  onClick={() => setSelectedCompanyKeys(prev => isSel ? prev.filter(k => k !== entry.key) : [...prev, entry.key])}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-gray-50 transition-colors"
                                >
                                  <span
                                    className="w-3.5 h-3.5 rounded flex-shrink-0 border flex items-center justify-center"
                                    style={isSel ? { backgroundColor: companyColorMap[entry.key], borderColor: companyColorMap[entry.key] } : { borderColor: '#d1d5db' }}
                                  >
                                    {isSel && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                  </span>
                                  <span className={`flex-1 truncate ${isSel ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
                                    {entry.name}
                                    {entry.sessions.length > 1 && <span className="ml-1 text-gray-400">{entry.sessions.length}R</span>}
                                  </span>
                                </button>
                              );
                            })}
                          {companyEntries.filter(e => e.name.toLowerCase().includes(companySearchQuery.toLowerCase())).length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-3">No companies found</p>
                          )}
                        </div>
                        {selectedCompanyKeys.length > 0 && (
                          <div className="border-t border-gray-100 p-2">
                            <button onClick={() => setSelectedCompanyKeys([])} className="text-xs text-green-500 hover:text-green-700 font-semibold w-full text-center">Clear selection</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasActiveFilter && (
                    <button
                      onClick={() => { setSectorFilter(null); setLevelFilter(null); setAnalyticsFromDate(''); setAnalyticsToDate(''); setSelectedCompanyKeys([]); setCompanyDropdownOpen(false); }}
                      className="text-xs text-green-500 hover:text-green-700 font-semibold transition-colors"
                    >Clear all</button>
                  )}
                  <button
                    onClick={exportAdminPDF}
                    disabled={exportingPDF}
                    className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-3 py-1 rounded-lg transition-colors"
                  >{exportingPDF ? 'Exporting…' : 'Export PDF'}</button>
                </div>
              </div>
              {/* Row 2: sector + level pills — full-width, adaptive */}
              <div className="flex gap-4">
                {availableSectors.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                    <span className="text-xs text-gray-400 font-medium flex-shrink-0">Sector:</span>
                    <button
                      onClick={() => setSectorFilter(null)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${sectorFilter === null ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'}`}
                    >All</button>
                    {availableSectors.map(sector => (
                      <button key={sector}
                        onClick={() => setSectorFilter(sectorFilter === sector ? null : sector)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${sectorFilter === sector ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'}`}
                      >{sector} ({sectorResponseCounts[sector]})</button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
                  <span className="text-xs text-gray-400 font-medium flex-shrink-0">Level:</span>
                  <button
                    onClick={() => setLevelFilter(null)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${levelFilter === null ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'}`}
                  >All ({sectorFilteredResponses.length})</button>
                  {readinessLevels.map((lvl, i) => (
                    <button key={i}
                      onClick={() => setLevelFilter(levelFilter === i ? null : i)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                        levelFilter === i
                          ? `${READINESS_LEVEL_STYLES[i].bg} ${READINESS_LEVEL_STYLES[i].text} border-current`
                          : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'
                      }`}
                    >{lvl.name} ({levelCounts[i]})</button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Analytics grid (fills remaining viewport) ── */}
            <div ref={analyticsRef} className="flex-1 min-h-0 flex flex-col gap-2 p-2 bg-gray-50">

              {/* ── Row 1 — sizes to content ── */}
              <div className="grid gap-2" style={{ flexShrink: 0, gridTemplateColumns: '1fr 1fr 1fr' }}>

              {/* Row 1, Col 1 — KPI summary */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col gap-3 justify-center">
                <div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: '#16a34a' }}>{filteredTotal}</div>
                  <div className="text-xs font-semibold text-gray-600 mt-0.5">Total Responses</div>
                </div>
                <div className="w-full h-px bg-gray-100" />
                <div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: '#15803d' }}>{fAvg.toFixed(2)}</div>
                  <div className="text-xs font-semibold text-gray-600 mt-0.5">Average Score</div>
                  <div className="text-xs text-gray-400">out of 5.00</div>
                </div>
                <div className="w-full h-px bg-gray-100" />
                <div>
                  {(() => {
                    const atRisk = distCounts[3] + distCounts[4];
                    const pct = filteredTotal > 0 ? Math.round((atRisk / filteredTotal) * 100) : 0;
                    return (
                      <>
                        <div className="text-2xl font-bold tabular-nums" style={{ color: pct > 50 ? '#dc2626' : pct > 25 ? '#d97706' : '#16a34a' }}>{filteredTotal > 0 ? `${pct}%` : '—'}</div>
                        <div className="text-xs font-semibold text-gray-600 mt-0.5">Needs Attention</div>
                        <div className="text-xs text-gray-400">{filteredTotal > 0 ? `${atRisk} of ${filteredTotal} · ${readinessLevels[4]?.name ?? readinessLevels[4]} or ${readinessLevels[3]?.name ?? readinessLevels[3]}` : 'No responses'}</div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Row 1, Col 2 — Readiness Distribution */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col min-h-0 overflow-hidden">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Readiness Distribution</p>
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                  {readinessLevels.map((lvl, i) => {
                    const c = distCounts[i]; const pct = filteredTotal ? (c / filteredTotal) * 100 : 0;
                    const colors = READINESS_LEVEL_STYLES[i];
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-2">
                          <span className={`font-semibold ${colors.text}`}>{lvl.name}</span>
                          <span className="text-gray-500">{c}</span>
                        </div>
                        <Bar pct={pct} colorClass={colors.bar} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 1, Col 3 — Performance by Pillar */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col min-h-0 overflow-hidden">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Performance by Pillar</p>
                {bottomFilteredResponses.length === 0
                  ? <p className="text-sm text-gray-400">No data yet</p>
                  : <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                      {bottomPillarPerfList.map(({ name, avg }) => {
                        const pct = (avg / 5) * 100;
                        const color = `hsl(142,${Math.round(60 + pct * 0.25)}%,${Math.round(62 - pct * 0.35)}%)`;
                        return (
                          <div key={name}>
                            <div className="flex justify-between text-xs mb-2">
                              <span className="font-semibold text-gray-700">{name}</span>
                              <span className="text-gray-500">{avg.toFixed(2)}</span>
                            </div>
                            <Bar pct={pct} color={color} />
                          </div>
                        );
                      })}
                    </div>
                }
              </div>

              </div>{/* end Row 1 */}

              {/* ── Row 2 — fills remaining space ── */}
              <div className="min-h-0 grid gap-2" style={{ flex: '1 1 0', gridTemplateColumns: '1fr 2fr', gridTemplateRows: 'minmax(0, 1fr)' }}>

              {/* Row 2, Col 1 — Submissions Over Time */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col min-h-0 overflow-hidden">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5 flex-shrink-0">Submissions Over Time</p>
                <p className="text-xs text-gray-400 mb-1 flex-shrink-0">{hasActiveFilter ? 'Filtered view' : 'Daily count'}</p>
                <div className="flex-1 min-h-0">
                  <TrendChart trend={cumulativeTrend} maxVal={cumulativeMax} />
                </div>
              </div>

              {/* Row 2, Col 2 — Company Comparison chart */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Company Comparison</p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCompareChartType('radar')}
                      className={`inline-flex items-center justify-center leading-none px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${compareChartType === 'radar' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'}`}
                    >Radar</button>
                    <button
                      onClick={() => selectedCompanyKeys.length >= 2 && setCompareChartType('bar')}
                      className={`inline-flex items-center justify-center leading-none px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        selectedCompanyKeys.length < 2
                          ? 'bg-white text-gray-300 border-gray-100 cursor-not-allowed'
                          : compareChartType === 'bar'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-green-400'
                      }`}
                    >Comparative Bar</button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center">
                  {selectedCompanyKeys.length === 0 && (
                    <p className="text-xs text-gray-400 text-center">Select companies using the Compare filter above.</p>
                  )}
                  {selectedCompanyKeys.length >= 1 && (compareChartType === 'radar' || selectedCompanyKeys.length < 2) && (
                    <div className="flex-1 min-h-0 w-full">
                      {(() => {
                        const radarSeries = selectedEntries
                          .map(entry => {
                            const pillars = computeCompanyPillars(entry, bottomFilteredResponses);
                            if (pillars.length === 0) return null;
                            return {
                              name: entry.name,
                              color: companyColorMap[entry.key],
                              pillars: pillars.map(p => ({ name: p.name, pct: Math.round((p.avg / 5) * 100) })),
                            };
                          })
                          .filter(Boolean);
                        if (radarSeries.length === 0) return <p className="text-xs text-gray-400 text-center">No data for selected companies.</p>;
                        return <RadarChart series={radarSeries} />;
                      })()}
                    </div>
                  )}
                  {selectedCompanyKeys.length >= 2 && compareChartType === 'bar' && (() => {
                    const traces = buildCompareTraces();
                    const annotations = buildCompareAnnotations();
                    const layout = {
                      barmode: 'group', bargap: 0.25, bargroupgap: 0.08,
                      annotations,
                      uirevision: selectedCompanyKeys.join(','),
                      xaxis: { gridcolor: 'transparent', tickfont: { size: 9 }, automargin: true, fixedrange: true },
                      yaxis: { range: [0, 7], autorange: false, gridcolor: '#f3f4f6', tickfont: { size: 9 }, fixedrange: true },
                      showlegend: true,
                      legend: { orientation: 'h', x: 0, y: 1.15, font: { size: 9 }, bgcolor: 'transparent' },
                      margin: { t: 36, b: 40, l: 32, r: 12 },
                    };
                    return plotlyLib
                      ? <div className="flex-1 min-h-0"><CompanyPlotlyChart plotly={plotlyLib} data={traces} layout={layout} /></div>
                      : <p className="text-xs text-gray-400 text-center">Loading chart…</p>;
                  })()}
                </div>
              </div>

              </div>{/* end Row 2 */}

            </div>
          </div>
        );
      })()}

      {/* ── Settings Tab ── */}
      {activeTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-6">
        {(() => {
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

          const workingRegLabel = editRegistrationLabel ?? registrationLabelData;
          const regLabelValid = workingRegLabel.trim().length > 0;

          const saveRegLabel = async () => {
            setRegLabelSaving(true);
            try {
              const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                body: JSON.stringify({ action: 'update_registration_label', label: workingRegLabel })
              });
              const result = await res.json();
              if (!result.success) throw new Error(result.error);
              setEditRegistrationLabel(null);
              await fetchData(localStorage.getItem('adminToken'));
            } catch (err) { alert(`Failed: ${err.message}`); }
            finally { setRegLabelSaving(false); }
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

              {/* Registration form label */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Registration Form Label</h2>
                <p className="text-xs text-gray-500 mb-4">
                  The field label shown to users when they register their company on the survey page.
                </p>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent mb-4"
                  value={workingRegLabel}
                  onChange={e => setEditRegistrationLabel(e.target.value)}
                  placeholder="e.g. Company Name, Organisation Name"
                />
                <div className="flex gap-2">
                  <button
                    disabled={!regLabelValid || regLabelSaving}
                    onClick={saveRegLabel}
                    className={`px-5 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
                      regLabelValid && !regLabelSaving ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    {regLabelSaving ? 'Saving…' : 'Save'}
                  </button>
                  {editRegistrationLabel !== null && (
                    <button
                      onClick={() => setEditRegistrationLabel(null)}
                      className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Readiness level names */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-1">Overall Readiness Level Names</h2>
                <p className="text-xs text-gray-500 mb-5">
                  These labels appear on the results page and analytics. Ordered from highest score (≥ 4.0) to lowest (&lt; 1.0).
                </p>
                <div className="space-y-5">
                  {workingReadiness.map((lvl, i) => (
                    <div key={i} className="flex gap-3">
                      <span className={`w-8 text-xs font-semibold text-center flex-shrink-0 mt-2.5 ${READINESS_LEVEL_STYLES[i].text}`}>
                        {4 - i}
                      </span>
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            value={lvl.name}
                            onChange={e => {
                              const next = workingReadiness.map((l, j) => j === i ? { ...l, name: e.target.value } : l);
                              setEditReadinessLevels(next);
                            }}
                            placeholder="Level name"
                          />
                          <input
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            value={lvl.persona}
                            onChange={e => {
                              const next = workingReadiness.map((l, j) => j === i ? { ...l, persona: e.target.value } : l);
                              setEditReadinessLevels(next);
                            }}
                            placeholder="Persona"
                          />
                        </div>
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
                      readinessValid && !readinessSaving ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
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
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                      optionLevelsValid && !levelsSaving ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
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
              {(() => {
                // ── Duplicate detection: pairs of sessions not yet grouped with similar names ──
                const duplicatePairs = [];
                for (let i = 0; i < sessionsData.length; i++) {
                  for (let j = i + 1; j < sessionsData.length; j++) {
                    const a = sessionsData[i], b = sessionsData[j];
                    if (a.company_uen && a.company_uen === b.company_uen) continue;
                    if (companyNameSimilarity(a.name, b.name) >= 0.5) duplicatePairs.push({ a, b });
                  }
                }

                const groupSessions = async (ids, existingUen) => {
                  const groupId = existingUen || `grp_${Math.min(...ids)}`;
                  setSessionSaving(true);
                  try {
                    const res = await fetch('/api/sessions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                      body: JSON.stringify({ action: 'link', ids, group_id: groupId })
                    });
                    const result = await res.json();
                    if (!result.success) throw new Error(result.error);
                    await fetchData(localStorage.getItem('adminToken'));
                  } catch (err) { alert(`Failed: ${err.message}`); }
                  finally { setSessionSaving(false); }
                };

                // Build grouped display: sessions sharing a UEN are shown as rounds under one company
                const searchLower = codeSearch.trim().toLowerCase();
                const fromMs = codeFromDate ? new Date(codeFromDate).getTime() : null;
                const toMs   = codeToDate   ? new Date(codeToDate + 'T23:59:59').getTime() : null;
                const filtered = sessionsData.filter(s => {
                  if (searchLower && !s.name.toLowerCase().includes(searchLower)) return false;
                  const t = new Date(s.created_at).getTime();
                  if (fromMs && t < fromMs) return false;
                  if (toMs   && t > toMs)   return false;
                  return true;
                });

                // Group by UEN; sessions without UEN stand alone
                const uenMap = {};
                const noUen = [];
                for (const s of filtered) {
                  if (s.company_uen) {
                    if (!uenMap[s.company_uen]) uenMap[s.company_uen] = [];
                    uenMap[s.company_uen].push(s);
                  } else {
                    noUen.push(s);
                  }
                }
                for (const uen of Object.keys(uenMap)) {
                  uenMap[uen].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                }

                // Fuzzy name suggestions while typing — skip if already linked
                const nameSuggestions = (() => {
                  if (pendingLink) return [];
                  const name = newSessionName.trim();
                  if (name.length < 3) return [];
                  const seen = new Set();
                  const results = [];
                  for (const s of sessionsData) {
                    const key = s.company_uen || `solo_${s.id}`;
                    if (seen.has(key)) continue;
                    const score = companyNameSimilarity(name, s.name);
                    if (score >= 0.4) { results.push({ ...s, score }); seen.add(key); }
                  }
                  return results.sort((a, b) => b.score - a.score).slice(0, 3);
                })();

                const deleteSession = async (s) => {
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
                };

                const addDeptForSession = async (parentSession) => {
                  if (!newDeptName.trim()) return;
                  setDeptSaving(true);
                  try {
                    const res = await fetch('/api/sessions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                      body: JSON.stringify({ action: 'add_dept', parent_session_id: parentSession.id, dept_label: newDeptName.trim() }),
                    });
                    const result = await res.json();
                    if (!result.success) throw new Error(result.error);
                    setGeneratedCode(result.code);
                    setNewDeptName('');
                    setAddingDeptForSession(null);
                    await fetchData(localStorage.getItem('adminToken'));
                  } catch (err) { alert(`Failed: ${err.message}`); }
                  finally { setDeptSaving(false); }
                };

                const saveCompletedCourses = async (sessionIds) => {
                  setCompletedCoursesSaving(true);
                  try {
                    await Promise.all(sessionIds.map(id =>
                      fetch('/api/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                        body: JSON.stringify({ action: 'update_completed_courses', id, completed_courses: [...pendingCompletedCourses] }),
                      }).then(r => r.json()).then(result => { if (!result.success) throw new Error(result.error); })
                    ));
                    await fetchData(localStorage.getItem('adminToken'));
                    setEditingCompletedCourses(null);
                  } catch (err) { alert(`Failed: ${err.message}`); }
                  finally { setCompletedCoursesSaving(false); }
                };

                const SessionRow = ({ s, roundLabel, deptLabel }) => (
                  <div key={s.id} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800">
                            {deptLabel ? `${deptLabel} Department` : s.name}
                          </p>
                          {roundLabel && (
                            <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{roundLabel}</span>
                          )}
                          {!deptLabel && s.round_label && (
                            <span className="text-xs text-gray-400 italic">{s.round_label}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {!deptLabel && s.sector && <span className="font-medium text-green-600 mr-1">{s.sector} ·</span>}
                          {s.response_count} response{s.response_count !== 1 ? 's' : ''} · Added {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setShownCodes(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
                          className="text-xs text-green-600 hover:underline font-medium"
                        >
                          {shownCodes[s.id] ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          disabled={sessionSaving}
                          onClick={() => deleteSession(s)}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {shownCodes[s.id] && (
                      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-3">
                        {s.code
                          ? <span className="font-mono text-base font-bold text-green-700 tracking-widest">{s.code}</span>
                          : <span className="text-xs text-gray-400 italic">Code not available (created before this feature)</span>
                        }
                        {s.code && (
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(s.code)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded font-semibold transition-colors"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );

                return (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Company Codes</h2>
                    <p className="text-xs text-gray-500 mb-5">
                      Add a company by name — a code is generated automatically. Linking sessions to the same UEN groups them as rounds, letting companies track AI readiness over time.
                      The company views results at <span className="font-mono text-green-600">/dashboard</span>.
                    </p>

                    {/* Generated code banner */}
                    {generatedCode && (
                      <div className="mb-5 bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-xs font-semibold text-green-700 mb-1">Code generated — share this with the company. You can also reveal it later via the Show button.</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="font-mono text-xl font-bold text-green-800 tracking-widest">{generatedCode}</span>
                          <button
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(generatedCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                          >
                            {codeCopied ? 'Copied!' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setGeneratedCode(null)}
                            className="text-xs text-green-500 hover:underline ml-auto"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Search + date filter */}
                    {sessionsData.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <input
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-gray-50 placeholder-gray-400"
                          value={codeSearch}
                          onChange={e => setCodeSearch(e.target.value)}
                          placeholder="Search by company name…"
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 flex-shrink-0">Added from</span>
                          <input
                            type="date"
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-transparent flex-1"
                            value={codeFromDate}
                            onChange={e => setCodeFromDate(e.target.value)}
                          />
                          <span className="text-xs text-gray-400 flex-shrink-0">to</span>
                          <input
                            type="date"
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-gray-50 focus:ring-2 focus:ring-green-500 focus:border-transparent flex-1"
                            value={codeToDate}
                            onChange={e => setCodeToDate(e.target.value)}
                          />
                          {(codeFromDate || codeToDate) && (
                            <button
                              type="button"
                              onClick={() => { setCodeFromDate(''); setCodeToDate(''); }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Possible duplicates banner */}
                    {duplicatePairs.length > 0 && (
                      <div className="mb-4 border border-amber-200 rounded-xl overflow-hidden">
                        <div className="bg-amber-50 px-4 py-2 flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-700">{duplicatePairs.length} possible duplicate{duplicatePairs.length !== 1 ? 's' : ''} detected</span>
                          <span className="text-xs text-amber-500">— group them to track rounds together</span>
                        </div>
                        <div className="divide-y divide-amber-100">
                          {duplicatePairs.map(({ a, b }) => {
                            const existingUen = a.company_uen || b.company_uen || null;
                            return (
                              <div key={`${a.id}-${b.id}`} className="px-4 py-2.5 flex items-center justify-between gap-3 bg-white">
                                <div className="text-xs text-gray-600 min-w-0">
                                  <span className="font-semibold">{a.name}</span>
                                  <span className="text-gray-400 mx-1.5">·</span>
                                  <span className="font-semibold">{b.name}</span>
                                  <span className="text-gray-400 ml-1.5">({new Date(a.created_at).toLocaleDateString()} &amp; {new Date(b.created_at).toLocaleDateString()})</span>
                                </div>
                                <button
                                  type="button"
                                  disabled={sessionSaving}
                                  onClick={() => groupSessions([a.id, b.id], existingUen)}
                                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-lg font-semibold flex-shrink-0 transition-colors disabled:opacity-50"
                                >
                                  Group
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Existing codes — two sections: multi-round companies, then standalone */}
                    {sessionsData.length === 0 ? (
                      <p className="text-sm text-gray-400 mb-4">No companies added yet.</p>
                    ) : filtered.length === 0 ? (
                      <p className="text-sm text-gray-400 mb-4">No sessions match the current filters.</p>
                    ) : (
                      <div className="space-y-5 mb-5 max-h-[36rem] overflow-y-auto pr-1">
                        {/* ── Multi-round companies ── */}
                        {Object.keys(uenMap).length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Multi-Round Companies</p>
                              <span className="text-xs text-green-400">{Object.keys(uenMap).length} group{Object.keys(uenMap).length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="space-y-3">
                              {Object.entries(uenMap).map(([uen, groupSessions]) => {
                                // Separate round sessions (no parent) from dept sessions (have parent)
                                const roundSessions = groupSessions.filter(s => !s.parent_session_id);
                                const deptSessions  = groupSessions.filter(s =>  s.parent_session_id);
                                const companyName   = groupSessions[0].name;

                                return (
                                  <div key={uen} className="border border-green-100 rounded-xl overflow-hidden">
                                    {/* Company header */}
                                    <div className="bg-green-50 px-4 py-2 flex items-center gap-2">
                                      <span className="text-xs font-bold text-green-700">{companyName}</span>
                                      <span className="text-xs text-green-400">{roundSessions.length} round{roundSessions.length !== 1 ? 's' : ''}</span>
                                      {deptSessions.length > 0 && (
                                        <span className="text-xs bg-purple-100 text-purple-600 font-semibold px-2 py-0.5 rounded-full">{deptSessions.length} dept{deptSessions.length !== 1 ? 's' : ''}</span>
                                      )}
                                    </div>

                                    <div className="divide-y divide-gray-100">
                                      {roundSessions.map((s, idx) => {
                                        const myDepts = deptSessions.filter(d => d.parent_session_id === s.id);
                                        const isExpanding = addingDeptForSession === s.id;
                                        const isEditingCourses = editingCompletedCourses === s.id;
                                        const groupTaken = new Set(roundSessions.flatMap(rs => { try { return JSON.parse(rs.completed_courses || '[]'); } catch { return []; } }));
                                        const takenCount = groupTaken.size;
                                        return (
                                          <div key={s.id}>
                                            {/* Round row with inline buttons */}
                                            <div className="flex items-center bg-gray-50">
                                              <div className="flex-1 min-w-0">
                                                <SessionRow s={s} roundLabel={`Round ${idx + 1}`} />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (isEditingCourses) {
                                                    setEditingCompletedCourses(null);
                                                  } else {
                                                    setPendingCompletedCourses(new Set(groupTaken));
                                                    setLockedCompletedCourses(new Set(groupTaken));
                                                    setEditingCompletedCourses(s.id);
                                                    setAddingDeptForSession(null);
                                                  }
                                                }}
                                                className={`mr-2 flex-shrink-0 text-xs px-2 py-0.5 rounded font-semibold transition-colors ${isEditingCourses ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'}`}
                                              >
                                                {isEditingCourses ? 'Cancel' : `✓ Taken${takenCount > 0 ? ` (${takenCount})` : ''}`}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => { setAddingDeptForSession(isExpanding ? null : s.id); setNewDeptName(''); setEditingCompletedCourses(null); }}
                                                className="mr-4 flex-shrink-0 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-0.5 rounded font-semibold transition-colors"
                                              >
                                                {isExpanding ? 'Cancel' : '＋ Dept'}
                                              </button>
                                            </div>

                                            {/* Inline completed-courses panel */}
                                            {isEditingCourses && (
                                              <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                                                <p className="text-xs font-bold text-amber-700 mb-2">Courses this company has completed — hidden from all round dashboards</p>
                                                {coursesData.length === 0
                                                  ? <p className="text-xs text-gray-400 mb-2">No courses configured yet. Add courses in the Courses section first.</p>
                                                  : (
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 max-h-36 overflow-y-auto">
                                                      {coursesData.map(c => {
                                                        const locked = lockedCompletedCourses.has(c.name);
                                                        return (
                                                          <label key={c.name} className={`flex items-center gap-1.5 py-0.5 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                                            <input
                                                              type="checkbox"
                                                              checked={pendingCompletedCourses.has(c.name)}
                                                              disabled={locked}
                                                              onChange={e => setPendingCompletedCourses(prev => {
                                                                const next = new Set(prev);
                                                                e.target.checked ? next.add(c.name) : next.delete(c.name);
                                                                return next;
                                                              })}
                                                              className="rounded text-amber-600 flex-shrink-0 disabled:cursor-not-allowed"
                                                            />
                                                            <span className="text-xs truncate text-gray-700">{c.name}</span>
                                                          </label>
                                                        );
                                                      })}
                                                    </div>
                                                  )
                                                }
                                                <div className="flex gap-2">
                                                  <button
                                                    type="button"
                                                    disabled={completedCoursesSaving}
                                                    onClick={() => saveCompletedCourses(roundSessions.map(rs => rs.id))}
                                                    className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                                                  >
                                                    {completedCoursesSaving ? 'Saving…' : 'Save'}
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setEditingCompletedCourses(null)}
                                                    className="text-xs bg-white border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg font-semibold"
                                                  >
                                                    Cancel
                                                  </button>
                                                </div>
                                              </div>
                                            )}

                                            {/* Inline dept-add form */}
                                            {isExpanding && (
                                              <div className="px-4 py-2.5 bg-purple-50 border-t border-purple-100 flex items-center gap-2">
                                                <input
                                                  autoFocus
                                                  className="flex-1 border border-purple-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                                  placeholder="Department name, e.g. HR, Finance, IT…"
                                                  value={newDeptName}
                                                  onChange={e => setNewDeptName(e.target.value)}
                                                  onKeyDown={e => { if (e.key === 'Enter') addDeptForSession(s); if (e.key === 'Escape') setAddingDeptForSession(null); }}
                                                />
                                                <button
                                                  type="button"
                                                  disabled={!newDeptName.trim() || deptSaving}
                                                  onClick={() => addDeptForSession(s)}
                                                  className="text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors flex-shrink-0"
                                                >
                                                  {deptSaving ? 'Adding…' : 'Add & Generate Code'}
                                                </button>
                                              </div>
                                            )}

                                            {/* Dept child sessions */}
                                            {myDepts.map(d => (
                                              <div key={d.id} className="border-t border-purple-100 bg-purple-50/30 pl-6">
                                                <SessionRow s={d} roundLabel={null} deptLabel={d.dept_label} />
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── Standalone sessions ── */}
                        {noUen.filter(s => !s.parent_session_id).length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Standalone Sessions</p>
                              <span className="text-xs text-gray-300">{noUen.filter(s => !s.parent_session_id).length} session{noUen.filter(s => !s.parent_session_id).length !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="space-y-3">
                              {noUen.filter(s => !s.parent_session_id).map(s => {
                                const myDepts = noUen.filter(d => d.parent_session_id === s.id);
                                const isExpanding = addingDeptForSession === s.id;
                                const isEditingCourses = editingCompletedCourses === s.id;
                                const takenCount = (() => { try { return JSON.parse(s.completed_courses || '[]').length; } catch { return 0; } })();
                                return (
                                  <div key={s.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="flex items-center bg-gray-50">
                                      <div className="flex-1 min-w-0">
                                        <SessionRow s={s} roundLabel="Round 1" />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isEditingCourses) {
                                            setEditingCompletedCourses(null);
                                          } else {
                                            const existing = new Set((() => { try { return JSON.parse(s.completed_courses || '[]'); } catch { return []; } })());
                                            setPendingCompletedCourses(new Set(existing));
                                            setLockedCompletedCourses(new Set(existing));
                                            setEditingCompletedCourses(s.id);
                                            setAddingDeptForSession(null);
                                          }
                                        }}
                                        className={`mr-2 flex-shrink-0 text-xs px-2 py-0.5 rounded font-semibold transition-colors ${isEditingCourses ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 hover:bg-amber-200 text-amber-700'}`}
                                      >
                                        {isEditingCourses ? 'Cancel' : `✓ Taken${takenCount > 0 ? ` (${takenCount})` : ''}`}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setAddingDeptForSession(isExpanding ? null : s.id); setNewDeptName(''); setEditingCompletedCourses(null); }}
                                        className="mr-4 flex-shrink-0 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-2 py-0.5 rounded font-semibold transition-colors"
                                      >
                                        {isExpanding ? 'Cancel' : '＋ Dept'}
                                      </button>
                                    </div>
                                    {isEditingCourses && (
                                      <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                                        <p className="text-xs font-bold text-amber-700 mb-2">Courses this company has completed — hidden from all round dashboards</p>
                                        {coursesData.length === 0
                                          ? <p className="text-xs text-gray-400 mb-2">No courses configured yet. Add courses in the Courses section first.</p>
                                          : (
                                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-3 max-h-36 overflow-y-auto">
                                              {coursesData.map(c => {
                                                const locked = lockedCompletedCourses.has(c.name);
                                                return (
                                                  <label key={c.name} className={`flex items-center gap-1.5 py-0.5 ${locked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                                    <input
                                                      type="checkbox"
                                                      checked={pendingCompletedCourses.has(c.name)}
                                                      disabled={locked}
                                                      onChange={e => setPendingCompletedCourses(prev => {
                                                        const next = new Set(prev);
                                                        e.target.checked ? next.add(c.name) : next.delete(c.name);
                                                        return next;
                                                      })}
                                                      className="rounded text-amber-600 flex-shrink-0 disabled:cursor-not-allowed"
                                                    />
                                                    <span className="text-xs truncate text-gray-700">{c.name}</span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          )
                                        }
                                        <div className="flex gap-2">
                                          <button
                                            type="button"
                                            disabled={completedCoursesSaving}
                                            onClick={() => saveCompletedCourses([s.id])}
                                            className="text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors"
                                          >
                                            {completedCoursesSaving ? 'Saving…' : 'Save'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingCompletedCourses(null)}
                                            className="text-xs bg-white border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg font-semibold"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                    {isExpanding && (
                                      <div className="px-4 py-2.5 bg-purple-50 border-t border-purple-100 flex items-center gap-2">
                                        <input
                                          autoFocus
                                          className="flex-1 border border-purple-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                                          placeholder="Department name, e.g. HR, Finance, IT…"
                                          value={newDeptName}
                                          onChange={e => setNewDeptName(e.target.value)}
                                          onKeyDown={e => { if (e.key === 'Enter') addDeptForSession(s); if (e.key === 'Escape') setAddingDeptForSession(null); }}
                                        />
                                        <button
                                          type="button"
                                          disabled={!newDeptName.trim() || deptSaving}
                                          onClick={() => addDeptForSession(s)}
                                          className="text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors flex-shrink-0"
                                        >
                                          {deptSaving ? 'Adding…' : 'Add & Generate Code'}
                                        </button>
                                      </div>
                                    )}
                                    {myDepts.map(d => (
                                      <div key={d.id} className="border-t border-purple-100 bg-purple-50/30 pl-6">
                                        <SessionRow s={d} roundLabel={null} deptLabel={d.dept_label} />
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add company form */}
                    <div className="border-t border-gray-100 pt-4 space-y-3">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            value={newSessionName}
                            onChange={e => setNewSessionName(e.target.value)}
                            placeholder="Company / organisation name"
                          />
                          {nameSuggestions.length > 0 && (
                            <div className="mt-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1.5">
                              <p className="text-xs font-semibold text-green-700">Possible match — add as a new round?</p>
                              {nameSuggestions.map(s => {
                                const roundCount = s.company_uen
                                  ? sessionsData.filter(ss => ss.company_uen === s.company_uen).length
                                  : 1;
                                return (
                                  <div key={s.id} className="flex items-center justify-between gap-2">
                                    <span className="text-xs text-green-600 truncate">
                                      {s.name} · {roundCount} round{roundCount !== 1 ? 's' : ''}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setPendingLink({ id: s.id, name: s.name, company_uen: s.company_uen })}
                                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-0.5 rounded font-semibold flex-shrink-0 transition-colors"
                                    >
                                      Link
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <select
                          className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white flex-shrink-0"
                          value={newSessionSector}
                          onChange={e => setNewSessionSector(e.target.value)}
                        >
                          <option value="">Select sector…</option>
                          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2 items-start">
                        {pendingLink ? (
                          <div className="flex-1 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                            <span className="text-xs text-green-700 font-semibold flex-1 truncate">
                              → Linked to {pendingLink.name}
                            </span>
                            <button type="button" onClick={() => setPendingLink(null)} className="text-green-400 hover:text-green-600 text-lg leading-none flex-shrink-0">×</button>
                          </div>
                        ) : (
                          <div className="flex-1 h-10" />
                        )}
                        <input
                          className="w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent flex-shrink-0"
                          value={newSessionRoundLabel}
                          onChange={e => setNewSessionRoundLabel(e.target.value)}
                          placeholder="Label, e.g. Pre-Programme"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          id="btn-gen-code"
                          type="button"
                          disabled={!newSessionName.trim() || sessionSaving}
                          onClick={async () => {
                            setSessionSaving(true);
                            setGeneratedCode(null);
                            try {
                              // Determine group ID from pending link (if any)
                              let company_uen = null;
                              if (pendingLink) {
                                if (pendingLink.company_uen) {
                                  company_uen = pendingLink.company_uen;
                                } else {
                                  // Existing session has no UEN yet — generate one and link it
                                  const groupId = `grp_${pendingLink.id}`;
                                  const linkRes = await fetch('/api/sessions', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                                    body: JSON.stringify({ action: 'link', ids: [pendingLink.id], group_id: groupId })
                                  });
                                  const linkResult = await linkRes.json();
                                  if (!linkResult.success) throw new Error(linkResult.error);
                                  company_uen = groupId;
                                }
                              }
                              const res = await fetch('/api/sessions', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` },
                                body: JSON.stringify({
                                  action: 'create',
                                  name: newSessionName.trim(),
                                  sector: newSessionSector,
                                  company_uen,
                                  round_label: newSessionRoundLabel.trim(),
                                })
                              });
                              const result = await res.json();
                              if (!result.success) throw new Error(result.error);
                              setGeneratedCode(result.code);
                              setNewSessionName('');
                              setNewSessionSector('');
                              setNewSessionRoundLabel('');
                              setPendingLink(null);
                              await fetchData(localStorage.getItem('adminToken'));
                            } catch (err) { alert(`Failed: ${err.message}`); }
                            finally { setSessionSaving(false); }
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex-shrink-0 ${
                            newSessionName.trim() && !sessionSaving ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {sessionSaving ? 'Generating…' : 'Generate Code'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Skills & Training Courses */}
              {(() => {
                const pillarNames = [...new Set((questions || []).map(q => q.category))];

                const updateCourse = (ci, fn) =>
                  setEditCourses(workingCourses.map((c, j) => j === ci ? fn(c) : c));

                const LevelCheckboxes = ({ levels, onChange }) => (
                  <>
                    {[0, 1, 2, 3, 4].map(li => (
                      <div key={li} className="w-12 flex justify-center flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={levels?.includes(li) ?? false}
                          onChange={e => {
                            const next = e.target.checked
                              ? [...(levels ?? []), li].sort((a, b) => a - b)
                              : (levels ?? []).filter(l => l !== li);
                            onChange(next);
                          }}
                          className="w-4 h-4 text-green-600 rounded accent-green-600"
                        />
                      </div>
                    ))}
                  </>
                );

                return (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Skills &amp; Training Courses</h2>
                    <p className="text-xs text-gray-500 mb-5">
                      Define courses shown on the results page. Add <span className="font-semibold">overall readiness</span> conditions and/or <span className="font-semibold">pillar</span> conditions — both are optional, and a course appears when any matched condition is met.
                    </p>

                    {/* Column headers — shown only when at least one course has conditions */}
                    {workingCourses.length > 0 && workingCourses.some(c => c.levels != null || c.pillarConditions?.length > 0) && (
                      <div className="flex items-end gap-2 mb-1 px-4">
                        <span className="flex-1 text-xs font-semibold text-gray-400">Condition</span>
                        {workingReadiness.map((lvl, i) => (
                          <div key={i} className="w-12 text-center flex-shrink-0">
                            <span className={`text-xs font-semibold ${READINESS_LEVEL_STYLES[i].text}`} title={lvl.name}>
                              {4 - i}
                            </span>
                          </div>
                        ))}
                        <div className="w-6" />
                      </div>
                    )}

                    {/* Course rows */}
                    <div className="space-y-3 mb-4">
                      {workingCourses.length === 0 && (
                        <p className="text-sm text-gray-400">No courses added yet. Click "+ Add Course" below.</p>
                      )}
                      {workingCourses.map((course, ci) => (
                        <div key={ci} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 space-y-2">

                          {/* Course name row */}
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                              value={course.name}
                              onChange={e => updateCourse(ci, c => ({ ...c, name: e.target.value }))}
                              placeholder="Course name"
                            />
                            <button
                              type="button"
                              onClick={() => setEditCourses(workingCourses.filter((_, j) => j !== ci))}
                              className="w-6 text-red-400 hover:text-red-600 text-xl leading-none flex-shrink-0 text-center"
                              title="Remove course"
                            >×</button>
                          </div>

                          {/* Description */}
                          <textarea
                            rows={2}
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white resize-none"
                            value={course.description ?? ''}
                            onChange={e => updateCourse(ci, c => ({ ...c, description: e.target.value }))}
                            placeholder="Description shown on the results page…"
                          />

                          {/* Link */}
                          <input
                            type="url"
                            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                            value={course.link ?? ''}
                            onChange={e => updateCourse(ci, c => ({ ...c, link: e.target.value }))}
                            placeholder="Course URL (optional) — e.g. https://www.sp.edu.sg/…"
                          />

                          {/* Overall readiness condition */}
                          {course.levels != null && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Overall readiness</p>
                              <div className="flex items-center gap-2">
                                <span className="flex-1 text-sm text-gray-500 italic">Overall readiness level</span>
                                <LevelCheckboxes
                                  levels={course.levels}
                                  onChange={next => updateCourse(ci, c => ({ ...c, levels: next }))}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateCourse(ci, c => ({ ...c, levels: null }))}
                                  className="w-6 text-red-400 hover:text-red-600 text-xl leading-none flex-shrink-0 text-center"
                                  title="Remove overall readiness condition"
                                >×</button>
                              </div>
                            </div>
                          )}

                          {/* Pillar conditions */}
                          {(course.pillarConditions?.length > 0) && (
                            <div className="space-y-1.5 pt-1">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Pillar conditions</p>
                              {course.pillarConditions.map((pc, pi) => (
                                <div key={pi} className="flex items-center gap-2">
                                  <select
                                    className="flex-1 border border-gray-200 rounded-md px-2 py-1.5 text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    value={pc.pillar}
                                    onChange={e => updateCourse(ci, c => ({
                                      ...c,
                                      pillarConditions: c.pillarConditions.map((p, k) => k === pi ? { ...p, pillar: e.target.value } : p)
                                    }))}
                                  >
                                    <option value="">Select pillar…</option>
                                    {pillarNames.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                  <LevelCheckboxes
                                    levels={pc.levels}
                                    onChange={next => updateCourse(ci, c => ({
                                      ...c,
                                      pillarConditions: c.pillarConditions.map((p, k) => k === pi ? { ...p, levels: next } : p)
                                    }))}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => updateCourse(ci, c => ({
                                      ...c,
                                      pillarConditions: c.pillarConditions.filter((_, k) => k !== pi)
                                    }))}
                                    className="w-6 text-red-400 hover:text-red-600 text-xl leading-none flex-shrink-0 text-center"
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add condition buttons */}
                          <div className="flex items-center gap-3">
                            {course.levels == null && (
                              <button
                                type="button"
                                onClick={() => updateCourse(ci, c => ({ ...c, levels: [] }))}
                                className="text-xs text-green-500 hover:underline font-medium"
                              >
                                + Add overall readiness condition
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => updateCourse(ci, c => ({
                                ...c,
                                pillarConditions: [...(c.pillarConditions ?? []), { pillar: '', levels: [] }]
                              }))}
                              className="text-xs text-green-500 hover:underline font-medium"
                            >
                              + Add pillar condition
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>

                    {/* Add + Save */}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setEditCourses([...workingCourses, { name: '', levels: null, description: '', link: '', pillarConditions: [] }])}
                        className="text-sm text-green-600 hover:underline font-semibold"
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
                            coursesValid && !coursesSaving ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'
                          }`}
                        >
                          {coursesSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}
        </div>
      )}

      {/* ── Questions Tab ── */}
      {activeTab === 'questions' && (
        <div className="flex-1 overflow-y-auto p-6">
        {(() => {
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
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
                  >
                    + Add Question
                  </button>
                </div>
              )}

              {/* Global add form (no specific pillar) */}
              {showAddForm && !addFormCategory && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200">
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
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-green-200 mb-4">
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
                      <span className="w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
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
                          className="text-xs text-green-600 hover:underline font-semibold"
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
                      <div key={q.id} className={editingId === q.id ? 'border-l-4 border-green-400' : ''}>
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
                                  className="text-xs text-green-600 hover:underline font-medium"
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
      )}

      <div className="h-11 flex-shrink-0" />
      <Footer />
    </div>
  );
}

export default AdminPage;
