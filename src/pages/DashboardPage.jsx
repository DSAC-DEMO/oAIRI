import { useState, useEffect, useRef, useMemo } from 'react';

// ── Plotly dark chart config ──────────────────────────────────────────────────
const DARK = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  'transparent',
  font:  { color: '#d1d5db', family: 'inherit', size: 11 },
  margin: { t: 10, b: 36, l: 10, r: 10, pad: 0 },
};

const CFG = { displayModeBar: false, responsive: true };

const LEVEL_COLORS = ['#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444'];

// ── Tiny reusable KPI card ────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = '#3b82f6' }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 flex flex-col justify-center border border-gray-700">
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-xs font-semibold text-gray-300 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Chart wrapper: renders a Plotly chart into a div ref ─────────────────────
function PlotlyChart({ traces, layout, onReady }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    import('plotly.js-dist-min').then(Plotly => {
      if (cancelled || !ref.current) return;
      const merged = { ...DARK, ...layout, autosize: true };
      Plotly.react(ref.current, traces, merged, CFG);
      if (onReady) onReady();
    });
    return () => { cancelled = true; };
  }, [traces, layout]);

  return <div ref={ref} className="w-full h-full" />;
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('dashboardCode', code.trim());
        onLogin(data);
      } else {
        setError('Invalid session code');
      }
    } catch {
      setError('Could not connect. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-10 w-full max-w-sm shadow-2xl">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Company Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Enter your company code to view results</p>
        </div>
        <form onSubmit={submit}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Company code"
            className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-3"
            autoFocus
          />
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button
            type="submit"
            disabled={!code.trim() || loading}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
              code.trim() && !loading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Verifying…' : 'Access Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
function Dashboard({ data, onRefresh, onLogout, refreshing }) {
  const { session, responses, questions, readinessLevels } = data;

  // ── Compute aggregates ────────────────────────────────────────────────────
  const { pillarList, overallAvg, readinessCounts, maxScore, minScore } = useMemo(() => {
    const pillarMap = {};
    for (const r of responses) {
      let ans = {};
      try { ans = JSON.parse(r.answers_json); } catch {}
      for (const q of questions) {
        const score = parseFloat(ans[q.id]);
        if (isNaN(score)) continue;
        if (!pillarMap[q.category]) pillarMap[q.category] = { sum: 0, count: 0 };
        pillarMap[q.category].sum   += score;
        pillarMap[q.category].count += 1;
      }
    }

    const pillarList = Object.entries(pillarMap).map(([name, { sum, count }]) => ({
      name,
      avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
    }));

    const scores = responses.map(r => r.score_pct || 0);
    const overallAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const maxScore = scores.length ? Math.max(...scores) : 0;
    const minScore = scores.length ? Math.min(...scores) : 0;

    const readinessCounts = [0, 0, 0, 0, 0];
    for (const r of responses) {
      const s = r.score_pct || 0;
      const i = s >= 4 ? 0 : s >= 3 ? 1 : s >= 2 ? 2 : s >= 1 ? 3 : 4;
      readinessCounts[i]++;
    }

    return { pillarList, overallAvg, readinessCounts, maxScore, minScore };
  }, [responses, questions]);

  const total = responses.length;

  // ── Radar chart data ──────────────────────────────────────────────────────
  const radarTraces = useMemo(() => {
    if (pillarList.length < 3) return [];
    const cats = [...pillarList.map(p => p.name), pillarList[0].name];
    const vals = [...pillarList.map(p => p.avg), pillarList[0].avg];
    return [{
      type: 'scatterpolar',
      r: vals,
      theta: cats,
      fill: 'toself',
      fillcolor: 'rgba(59,130,246,0.2)',
      line: { color: '#3b82f6', width: 2 },
      marker: { color: '#3b82f6', size: 5 },
      name: 'Avg Score',
    }];
  }, [pillarList]);

  const radarLayout = useMemo(() => ({
    polar: {
      bgcolor: 'transparent',
      radialaxis: {
        visible: true, range: [0, 5], tickfont: { size: 10, color: '#6b7280' },
        gridcolor: '#374151', linecolor: '#374151',
        tickvals: [1, 2, 3, 4, 5],
      },
      angularaxis: { tickfont: { size: 10, color: '#9ca3af' }, gridcolor: '#374151', linecolor: '#374151' },
    },
    showlegend: false,
    margin: { t: 20, b: 20, l: 40, r: 40 },
  }), []);

  // ── Level distribution bar data ───────────────────────────────────────────
  const distTraces = useMemo(() => [{
    type: 'bar',
    x: readinessLevels.map(l => l.name ?? l),
    y: readinessCounts,
    marker: { color: LEVEL_COLORS },
    text: readinessCounts.map(String),
    textposition: 'outside',
    cliponaxis: false,
  }], [readinessLevels, readinessCounts]);

  const distLayout = useMemo(() => ({
    xaxis: { tickfont: { size: 9 }, gridcolor: 'transparent', linecolor: '#374151', tickangle: -20 },
    yaxis: { gridcolor: '#374151', linecolor: '#374151', tickfont: { size: 10 }, dtick: 1 },
    showlegend: false,
    margin: { t: 24, b: 70, l: 36, r: 10 },
  }), []);

  // ── Pillar breakdown horizontal bar ───────────────────────────────────────
  const sorted = useMemo(() => [...pillarList].sort((a, b) => a.avg - b.avg), [pillarList]);

  const pillarTraces = useMemo(() => [{
    type: 'bar',
    orientation: 'h',
    x: sorted.map(p => p.avg),
    y: sorted.map(p => p.name),
    text: sorted.map(p => p.avg.toFixed(2)),
    textposition: 'outside',
    cliponaxis: false,
    marker: {
      color: sorted.map(p => {
        const pct = (p.avg / 5) * 100;
        return pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
      }),
    },
  }], [sorted]);

  const pillarLayout = useMemo(() => ({
    xaxis: { range: [0, 5.8], gridcolor: '#374151', linecolor: '#374151', tickfont: { size: 10 } },
    yaxis: { gridcolor: 'transparent', linecolor: '#374151', tickfont: { size: 10 }, automargin: true },
    showlegend: false,
    margin: { t: 10, b: 36, l: 10, r: 48 },
  }), []);

  const levelIdx = overallAvg >= 4 ? 0 : overallAvg >= 3 ? 1 : overallAvg >= 2 ? 2 : overallAvg >= 1 ? 3 : 4;
  const levelName = (readinessLevels[levelIdx]?.name ?? readinessLevels[levelIdx]) || '—';

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{session.name}</h1>
            <p className="text-xs text-gray-400">AI Readiness — Company Report</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Code created {new Date(session.created_at).toLocaleDateString()}
          </span>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button
            onClick={onLogout}
            className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* ── Main grid ── */}
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-400 text-sm">No responses yet for this session.</p>
            <p className="text-gray-600 text-xs mt-1">Share the company code with participants to begin collecting responses.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-3 p-3 min-h-0">

          {/* Radar — spans both rows */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 row-span-2 flex flex-col min-h-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Competency Profile</p>
            <div className="flex-1 min-h-0">
              {radarTraces.length > 0
                ? <PlotlyChart traces={radarTraces} layout={radarLayout} />
                : <p className="text-xs text-gray-500 mt-4 text-center">Need ≥ 3 pillars for radar</p>
              }
            </div>
          </div>

          {/* Level distribution */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col min-h-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Readiness Distribution</p>
            <div className="flex-1 min-h-0">
              <PlotlyChart traces={distTraces} layout={distLayout} />
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-rows-4 gap-2 min-h-0">
            <KpiCard label="Total Responses" value={total} accent="#3b82f6" />
            <KpiCard label="Average Score" value={overallAvg.toFixed(2)} sub="out of 5.00" accent="#22c55e" />
            <KpiCard label="Overall Level" value={levelName} accent={LEVEL_COLORS[levelIdx]} />
            <KpiCard label="Score Range" value={`${minScore.toFixed(1)} – ${maxScore.toFixed(1)}`} sub="min – max" accent="#a78bfa" />
          </div>

          {/* Pillar breakdown — spans cols 2-3 */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 col-span-2 flex flex-col min-h-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Score by Pillar</p>
            <div className="flex-1 min-h-0">
              <PlotlyChart traces={pillarTraces} layout={pillarLayout} />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [dashData, setDashData] = useState(null);
  const [savedCode, setSavedCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const code = sessionStorage.getItem('dashboardCode');
    if (code) { setSavedCode(code); fetchData(code); }
  }, []);

  const fetchData = async (code) => {
    try {
      const res = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) setDashData(data);
      else { sessionStorage.removeItem('dashboardCode'); setDashData(null); }
    } catch {}
  };

  const handleLogin = (data) => { setDashData(data); };

  const handleRefresh = async () => {
    const code = sessionStorage.getItem('dashboardCode');
    if (!code) return;
    setRefreshing(true);
    await fetchData(code);
    setRefreshing(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dashboardCode');
    setDashData(null);
  };

  if (!dashData) return <LoginScreen onLogin={handleLogin} />;

  return <Dashboard data={dashData} onRefresh={handleRefresh} onLogout={handleLogout} refreshing={refreshing} />;
}
