import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

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

// ── Chart wrapper ─────────────────────────────────────────────────────────────
// onClickPoint receives the raw Plotly point object; stored in a ref so the
// effect dependency list stays stable and doesn't cause flicker.
function PlotlyChart({ traces, layout, onReady, onClickPoint }) {
  const ref       = useRef(null);
  const clickRef  = useRef(onClickPoint);
  useEffect(() => { clickRef.current = onClickPoint; }, [onClickPoint]);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    import('plotly.js-dist-min').then(Plotly => {
      if (cancelled || !ref.current) return;
      const merged = { ...DARK, ...layout, autosize: true };
      Plotly.react(ref.current, traces, merged, CFG);
      // re-bind click listener each time traces/layout change
      ref.current.removeAllListeners?.('plotly_click');
      ref.current.on('plotly_click', (evt) => {
        if (evt.points?.length > 0) clickRef.current?.(evt.points[0]);
      });
      if (onReady) onReady();
    });
    return () => { cancelled = true; };
  }, [traces, layout]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={ref}
      className="w-full h-full"
      style={{ cursor: onClickPoint ? 'pointer' : 'default' }}
    />
  );
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

  // null = show all; 0-4 = filter to that readiness level index
  const [selectedLevel, setSelectedLevel] = useState(null);

  // Always-full distribution counts (used in the bar chart so all bars stay visible)
  const readinessCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of responses) {
      const s = r.score_pct || 0;
      counts[s >= 4 ? 0 : s >= 3 ? 1 : s >= 2 ? 2 : s >= 1 ? 3 : 4]++;
    }
    return counts;
  }, [responses]);

  // Responses filtered by the selected level
  const filteredResponses = useMemo(() =>
    selectedLevel === null
      ? responses
      : responses.filter(r => {
          const s = r.score_pct || 0;
          return (s >= 4 ? 0 : s >= 3 ? 1 : s >= 2 ? 2 : s >= 1 ? 3 : 4) === selectedLevel;
        }),
    [responses, selectedLevel]
  );

  // Aggregates from filtered responses
  const { pillarList, overallAvg, maxScore, minScore } = useMemo(() => {
    const pillarMap = {};
    for (const r of filteredResponses) {
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
    const scores = filteredResponses.map(r => r.score_pct || 0);
    const overallAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      pillarList,
      overallAvg,
      maxScore: scores.length ? Math.max(...scores) : 0,
      minScore: scores.length ? Math.min(...scores) : 0,
    };
  }, [filteredResponses, questions]);

  const total         = responses.length;
  const filteredTotal = filteredResponses.length;

  const levelIdx  = overallAvg >= 4 ? 0 : overallAvg >= 3 ? 1 : overallAvg >= 2 ? 2 : overallAvg >= 1 ? 3 : 4;
  const levelName = (readinessLevels[levelIdx]?.name ?? readinessLevels[levelIdx]) || '—';

  // Click on a distribution bar → toggle filter
  const handleDistClick = useCallback((point) => {
    setSelectedLevel(prev => prev === point.pointIndex ? null : point.pointIndex);
  }, []);

  // ── Radar chart ───────────────────────────────────────────────────────────
  const radarTraces = useMemo(() => {
    if (pillarList.length < 3) return [];
    const cats = [...pillarList.map(p => p.name), pillarList[0].name];
    const vals = [...pillarList.map(p => p.avg), pillarList[0].avg];
    const color = selectedLevel !== null ? LEVEL_COLORS[selectedLevel] : '#3b82f6';
    return [{
      type: 'scatterpolar',
      r: vals,
      theta: cats,
      fill: 'toself',
      fillcolor: `${color}33`,
      line: { color, width: 2 },
      marker: { color, size: 5 },
      name: 'Avg Score',
    }];
  }, [pillarList, selectedLevel]);

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

  // ── Distribution bar (always shows all, highlights selected) ─────────────
  const distTraces = useMemo(() => [{
    type: 'bar',
    x: readinessLevels.map(l => l.name ?? l),
    y: readinessCounts,
    marker: {
      color: LEVEL_COLORS.map((c, i) =>
        selectedLevel === null || i === selectedLevel ? c : `${c}44`
      ),
      line: {
        width: LEVEL_COLORS.map((_, i) => i === selectedLevel ? 2 : 0),
        color: LEVEL_COLORS.map((c, i) => i === selectedLevel ? '#ffffff55' : 'transparent'),
      },
    },
    text: readinessCounts.map(String),
    textposition: 'outside',
    cliponaxis: false,
    hovertemplate: '%{x}: %{y}<extra></extra>',
  }], [readinessLevels, readinessCounts, selectedLevel]);

  const distLayout = useMemo(() => ({
    xaxis: { tickfont: { size: 9 }, gridcolor: 'transparent', linecolor: '#374151', tickangle: -20 },
    yaxis: { gridcolor: '#374151', linecolor: '#374151', tickfont: { size: 10 }, dtick: 1 },
    showlegend: false,
    margin: { t: 24, b: 70, l: 36, r: 10 },
  }), []);

  // ── Pillar breakdown ──────────────────────────────────────────────────────
  const sorted = useMemo(() => [...pillarList].sort((a, b) => a.avg - b.avg), [pillarList]);

  const barColor = selectedLevel !== null ? LEVEL_COLORS[selectedLevel] : null;

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
        if (barColor) return barColor;
        const pct = (p.avg / 5) * 100;
        return pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
      }),
    },
  }], [sorted, barColor]);

  const pillarLayout = useMemo(() => ({
    xaxis: { range: [0, 5.8], gridcolor: '#374151', linecolor: '#374151', tickfont: { size: 10 } },
    yaxis: { gridcolor: 'transparent', linecolor: '#374151', tickfont: { size: 10 }, automargin: true },
    showlegend: false,
    margin: { t: 10, b: 36, l: 10, r: 48 },
  }), []);

  const accentColor = selectedLevel !== null ? LEVEL_COLORS[selectedLevel] : '#3b82f6';
  const selectedLevelName = selectedLevel !== null
    ? (readinessLevels[selectedLevel]?.name ?? readinessLevels[selectedLevel])
    : null;

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
          {/* Active filter badge */}
          {selectedLevelName && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border cursor-pointer"
              style={{ borderColor: accentColor, color: accentColor, backgroundColor: `${accentColor}22` }}
              onClick={() => setSelectedLevel(null)}
              title="Click to clear filter"
            >
              {selectedLevelName}
              <span className="opacity-60 text-sm leading-none">×</span>
            </div>
          )}
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

          {/* Radar — spans both rows, updates with filter */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 row-span-2 flex flex-col min-h-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Competency Profile</p>
            {selectedLevel !== null && (
              <p className="text-xs mb-1 flex-shrink-0" style={{ color: accentColor }}>
                {selectedLevelName} · {filteredTotal} respondent{filteredTotal !== 1 ? 's' : ''}
              </p>
            )}
            <div className="flex-1 min-h-0">
              {radarTraces.length > 0
                ? <PlotlyChart traces={radarTraces} layout={radarLayout} />
                : <p className="text-xs text-gray-500 mt-4 text-center">Need ≥ 3 pillars for radar</p>
              }
            </div>
          </div>

          {/* Level distribution — click to filter */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col min-h-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">
              Readiness Distribution
              {selectedLevel === null && <span className="text-gray-600 font-normal ml-1">(click a bar to filter)</span>}
            </p>
            <div className="flex-1 min-h-0">
              <PlotlyChart traces={distTraces} layout={distLayout} onClickPoint={handleDistClick} />
            </div>
          </div>

          {/* KPI cards — reflect filtered data */}
          <div className="grid grid-rows-4 gap-2 min-h-0">
            <KpiCard
              label={selectedLevel !== null ? `${selectedLevelName} Responses` : 'Total Responses'}
              value={filteredTotal}
              sub={selectedLevel !== null ? `of ${total} total` : undefined}
              accent={accentColor}
            />
            <KpiCard label="Average Score" value={overallAvg.toFixed(2)} sub="out of 5.00" accent="#22c55e" />
            <KpiCard label="Overall Level" value={levelName} accent={LEVEL_COLORS[levelIdx]} />
            <KpiCard label="Score Range" value={filteredTotal > 0 ? `${minScore.toFixed(1)} – ${maxScore.toFixed(1)}` : '—'} sub="min – max" accent="#a78bfa" />
          </div>

          {/* Pillar breakdown — spans cols 2-3, updates with filter */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 col-span-2 flex flex-col min-h-0">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Score by Pillar</p>
            <div className="flex-1 min-h-0">
              {filteredTotal > 0
                ? <PlotlyChart traces={pillarTraces} layout={pillarLayout} />
                : <p className="text-xs text-gray-500 text-center mt-4">No responses for this level</p>
              }
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

  const handleLogin  = (data) => { setDashData(data); };
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
