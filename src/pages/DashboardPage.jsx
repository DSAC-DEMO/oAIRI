import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ── Plotly light chart config ─────────────────────────────────────────────────
const LIGHT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor:  'transparent',
  font:  { color: '#374151', family: 'inherit', size: 11 },
  margin: { t: 10, b: 36, l: 10, r: 10, pad: 0 },
};

const CFG = { displayModeBar: false, responsive: true };

// Admin analytics blue palette — index 0 = Expert (darkest) … 4 = Novice (lightest)
const LEVEL_COLORS = ['#1e40af', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe'];

const READINESS_LEVEL_STYLES = [
  { accent: '#1e40af' },
  { accent: '#2563eb' },
  { accent: '#60a5fa' },
  { accent: '#93c5fd' },
  { accent: '#bfdbfe' },
];

// Distinct colours per round for progression view
const ROUND_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#0891b2', '#dc2626'];

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = '#3b82f6' }) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col justify-center border border-gray-200 shadow-sm">
      <div className="text-2xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-xs font-semibold text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Chart wrapper ─────────────────────────────────────────────────────────────
function PlotlyChart({ traces, layout, onReady, onClickPoint }) {
  const ref      = useRef(null);
  const clickRef = useRef(onClickPoint);
  useEffect(() => { clickRef.current = onClickPoint; }, [onClickPoint]);

  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    import('plotly.js-dist-min').then(Plotly => {
      if (cancelled || !ref.current) return;
      const merged = { ...LIGHT, ...layout, autosize: true };
      Plotly.react(ref.current, traces, merged, CFG);
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
    <div className="h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-10 w-full max-w-sm shadow-lg">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Company Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Enter your company code to view results</p>
        </div>
        <form onSubmit={submit}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Enter your company code"
            className="w-full border border-gray-300 text-gray-900 rounded-lg px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-3"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button
            type="submit"
            disabled={!code.trim() || loading}
            className={`w-full py-3 rounded-lg text-sm font-semibold transition-colors ${
              code.trim() && !loading ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
  const { session, responses: rawResponses, questions, readinessLevels, rounds: rawRounds = [] } = data;
  // Always sort rounds by session creation time so Round 1 = earliest, regardless of which code was entered
  const rounds = useMemo(
    () => [...rawRounds]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((r, i) => ({ ...r, roundNum: i + 1 })),
    [rawRounds]
  );
  const dashboardRef = useRef(null);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Round tab state — only active when multiple rounds exist
  const hasMultipleRounds = rounds.length > 1;
  const initialRound = useMemo(() => {
    if (!hasMultipleRounds) return null;
    return rounds.find(r => r.sessionId === session.id)?.roundNum ?? rounds[0].roundNum;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeRound, setActiveRound] = useState(initialRound);

  const switchRound = useCallback((round) => {
    setActiveRound(round);
    setSelectedLevel(null);
  }, []);

  // Active responses: switch based on selected round tab
  const responses = useMemo(() => {
    if (!hasMultipleRounds) return rawResponses;
    if (activeRound === 'overall') return rounds.flatMap(r => r.responses);
    const round = rounds.find(r => r.roundNum === activeRound);
    return round ? round.responses : rawResponses;
  }, [hasMultipleRounds, activeRound, rounds, rawResponses]);

  // Per-round breakdown for overlay charts in overall mode
  const perRoundStats = useMemo(() => {
    if (activeRound !== 'overall' || !questions.length) return null;
    return rounds.map((round) => {
      const pillarMap = {};
      const counts = [0, 0, 0, 0, 0];
      for (const r of round.responses) {
        const s = r.score_pct || 0;
        counts[s >= 4 ? 0 : s >= 3 ? 1 : s >= 2 ? 2 : s >= 1 ? 3 : 4]++;
        let ans = {};
        try { ans = JSON.parse(r.answers_json); } catch {}
        for (const q of questions) {
          const score = parseFloat(ans[q.id]);
          if (isNaN(score)) continue;
          if (!pillarMap[q.category]) pillarMap[q.category] = { sum: 0, count: 0 };
          pillarMap[q.category].sum += score;
          pillarMap[q.category].count += 1;
        }
      }
      const pillarList = Object.entries(pillarMap).map(([name, { sum, count }]) => ({
        name, avg: count > 0 ? sum / count : 0,
      }));
      const scores = round.responses.map(r => r.score_pct || 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        roundNum: round.roundNum,
        label: round.label,
        createdAt: round.createdAt,
        totalResponses: round.responses.length,
        readinessCounts: counts,
        pillarList,
        avg,
      };
    });
  }, [activeRound, rounds, questions]);

  // Consistent pillar ordering (from question list order) for overall grouped bars
  const pillarOrder = useMemo(
    () => [...new Map(questions.map(q => [q.category, null])).keys()],
    [questions]
  );

  const readinessCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of responses) {
      const s = r.score_pct || 0;
      counts[s >= 4 ? 0 : s >= 3 ? 1 : s >= 2 ? 2 : s >= 1 ? 3 : 4]++;
    }
    return counts;
  }, [responses]);

  const filteredResponses = useMemo(() =>
    selectedLevel === null || activeRound === 'overall'
      ? responses
      : responses.filter(r => {
          const s = r.score_pct || 0;
          return (s >= 4 ? 0 : s >= 3 ? 1 : s >= 2 ? 2 : s >= 1 ? 3 : 4) === selectedLevel;
        }),
    [responses, selectedLevel, activeRound]
  );

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
    return { pillarList, overallAvg, maxScore: scores.length ? Math.max(...scores) : 0, minScore: scores.length ? Math.min(...scores) : 0 };
  }, [filteredResponses, questions]);

  const total         = responses.length;
  const filteredTotal = filteredResponses.length;
  const levelIdx      = overallAvg >= 4 ? 0 : overallAvg >= 3 ? 1 : overallAvg >= 2 ? 2 : overallAvg >= 1 ? 3 : 4;
  const levelName     = (readinessLevels[levelIdx]?.name ?? readinessLevels[levelIdx]) || '—';

  const handleDistClick = useCallback((point) => {
    if (activeRound === 'overall') return;
    setSelectedLevel(prev => prev === point.pointIndex ? null : point.pointIndex);
  }, [activeRound]);

  // ── Chart traces / layouts ────────────────────────────────────────────────

  const radarTraces = useMemo(() => {
    // Overall: one overlaid trace per round
    if (activeRound === 'overall' && perRoundStats) {
      return perRoundStats.map((rs, i) => {
        if (rs.pillarList.length < 3) return null;
        const cats = [...rs.pillarList.map(p => p.name), rs.pillarList[0].name];
        const vals = [...rs.pillarList.map(p => p.avg), rs.pillarList[0].avg];
        const color = ROUND_COLORS[i % ROUND_COLORS.length];
        return {
          type: 'scatterpolar', r: vals, theta: cats, fill: 'toself', mode: 'lines+markers',
          fillcolor: `${color}22`, line: { color, width: 2.5 }, marker: { color, size: 6 },
          name: `Round ${rs.roundNum}${rs.label ? ` · ${rs.label}` : ''}`,
        };
      }).filter(Boolean);
    }
    // Single round
    if (pillarList.length < 3) return [];
    const cats  = [...pillarList.map(p => p.name), pillarList[0].name];
    const vals  = [...pillarList.map(p => p.avg), pillarList[0].avg];
    const color = selectedLevel !== null ? LEVEL_COLORS[selectedLevel] : '#3b82f6';
    return [{
      type: 'scatterpolar', r: vals, theta: cats, fill: 'toself', mode: 'lines+markers+text',
      text: vals.map(v => v.toFixed(2)), textposition: 'top center', textfont: { size: 10, color: '#374151' },
      fillcolor: `${color}33`, line: { color, width: 2 }, marker: { color, size: 5 }, name: 'Avg Score',
    }];
  }, [activeRound, perRoundStats, pillarList, selectedLevel]);

  const radarLayout = useMemo(() => ({
    polar: {
      bgcolor: 'transparent',
      radialaxis: { visible: true, range: [0, 5], tickfont: { size: 10, color: '#6b7280' }, gridcolor: '#e5e7eb', linecolor: '#e5e7eb', tickvals: [1, 2, 3, 4, 5] },
      angularaxis: { tickfont: { size: 10, color: '#374151' }, gridcolor: '#e5e7eb', linecolor: '#e5e7eb' },
    },
    showlegend: activeRound === 'overall',
    legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.18, font: { size: 9 } },
    margin: { t: 20, b: activeRound === 'overall' ? 60 : 20, l: 56, r: 56 },
  }), [activeRound]);

  const distTraces = useMemo(() => {
    // Overall: grouped bars, one per round
    if (activeRound === 'overall' && perRoundStats) {
      return perRoundStats.map((rs, i) => {
        const color = ROUND_COLORS[i % ROUND_COLORS.length];
        return {
          type: 'bar',
          x: readinessLevels.map(l => l.name ?? l),
          y: rs.readinessCounts,
          name: `Round ${rs.roundNum}${rs.label ? ` · ${rs.label}` : ''}`,
          marker: { color, opacity: 0.85 },
          text: rs.readinessCounts.map(String),
          textposition: 'outside',
          cliponaxis: false,
          hovertemplate: `Round ${rs.roundNum} %{x}: %{y}<extra></extra>`,
        };
      });
    }
    // Single round
    return [{
      type: 'bar',
      x: readinessLevels.map(l => l.name ?? l),
      y: readinessCounts,
      marker: {
        color: LEVEL_COLORS.map((c, i) => selectedLevel === null || i === selectedLevel ? c : `${c}44`),
        line: { width: LEVEL_COLORS.map((_, i) => i === selectedLevel ? 2 : 0), color: LEVEL_COLORS.map((_, i) => i === selectedLevel ? '#1e3a8a' : 'transparent') },
      },
      text: readinessCounts.map(String),
      textposition: 'outside',
      cliponaxis: false,
      hovertemplate: '%{x}: %{y}<extra></extra>',
    }];
  }, [activeRound, perRoundStats, readinessLevels, readinessCounts, selectedLevel]);

  const distLayout = useMemo(() => ({
    barmode: activeRound === 'overall' ? 'group' : undefined,
    xaxis: {
      tickfont: { size: 9 }, gridcolor: 'transparent', linecolor: '#e5e7eb', tickangle: -20,
      categoryorder: 'array',
      categoryarray: [...readinessLevels.map(l => l.name ?? l)].reverse(),
    },
    yaxis: { gridcolor: '#f3f4f6', linecolor: '#e5e7eb', tickfont: { size: 10 }, dtick: 1 },
    showlegend: activeRound === 'overall',
    legend: { orientation: 'h', x: 0, y: 1.18, font: { size: 9 } },
    margin: { t: activeRound === 'overall' ? 56 : 36, b: 70, l: 36, r: 16 },
  }), [activeRound, readinessLevels]);

  const sorted = useMemo(() => [...pillarList].sort((a, b) => a.avg - b.avg), [pillarList]);

  const pillarTraces = useMemo(() => {
    // Overall: grouped horizontal bars, one per round, consistent pillar order
    if (activeRound === 'overall' && perRoundStats) {
      return perRoundStats.map((rs, i) => {
        const color = ROUND_COLORS[i % ROUND_COLORS.length];
        const avgs = pillarOrder.map(name => {
          const p = rs.pillarList.find(pl => pl.name === name);
          return p ? p.avg : 0;
        });
        return {
          type: 'bar', orientation: 'h',
          x: avgs,
          y: pillarOrder,
          name: `Round ${rs.roundNum}${rs.label ? ` · ${rs.label}` : ''}`,
          marker: { color, opacity: 0.85 },
          text: avgs.map(v => v.toFixed(2)),
          textposition: 'outside',
          cliponaxis: false,
        };
      });
    }
    // Single round
    return [{
      type: 'bar', orientation: 'h',
      x: sorted.map(p => p.avg),
      y: sorted.map(p => p.name),
      text: sorted.map(p => p.avg.toFixed(2)),
      textposition: 'outside', cliponaxis: false,
      marker: { color: sorted.map(p => { const a = p.avg; return a > 3.75 ? LEVEL_COLORS[0] : a > 2.5 ? LEVEL_COLORS[1] : a > 1.25 ? LEVEL_COLORS[2] : a > 0 ? LEVEL_COLORS[3] : LEVEL_COLORS[4]; }) },
    }];
  }, [activeRound, perRoundStats, pillarOrder, sorted]);

  const pillarLayout = useMemo(() => {
    const annotations = [];
    if (activeRound === 'overall' && perRoundStats && perRoundStats.length > 1) {
      const first = perRoundStats[0];
      const last  = perRoundStats[perRoundStats.length - 1];
      for (const name of pillarOrder) {
        const a = first.pillarList.find(p => p.name === name)?.avg ?? 0;
        const b = last.pillarList.find(p => p.name === name)?.avg ?? 0;
        const delta = b - a;
        annotations.push({
          x: 1.02, xref: 'paper',
          y: name,  yref: 'y',
          text: `<b>${delta >= 0 ? '+' : ''}${delta.toFixed(2)}</b>`,
          showarrow: false,
          font: { size: 10, color: delta > 0 ? '#22c55e' : delta < 0 ? '#f87171' : '#9ca3af' },
          xanchor: 'left',
        });
      }
    }
    return {
      barmode: activeRound === 'overall' ? 'group' : undefined,
      annotations,
      xaxis: { range: [0, activeRound === 'overall' ? 6.8 : 5.8], gridcolor: '#f3f4f6', linecolor: '#e5e7eb', tickfont: { size: 10 } },
      yaxis: { gridcolor: 'transparent', linecolor: '#e5e7eb', tickfont: { size: 10 }, automargin: true },
      showlegend: activeRound === 'overall',
      legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 9 } },
      margin: { t: activeRound === 'overall' ? 56 : 16, b: 36, l: 10, r: activeRound === 'overall' ? 88 : 64 },
    };
  }, [activeRound, perRoundStats, pillarOrder]);

  const accentColor       = selectedLevel !== null ? LEVEL_COLORS[selectedLevel] : '#3b82f6';
  const selectedLevelName = selectedLevel !== null ? (readinessLevels[selectedLevel]?.name ?? readinessLevels[selectedLevel]) : null;

  // ── PDF export ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    const el = dashboardRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' });
      const imgData = canvas.toDataURL('image/png');
      const w = canvas.width / 2;
      const h = canvas.height / 2;
      const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });
      pdf.addImage(imgData, 'PNG', 0, 0, w, h);
      pdf.save(`${session.name}_AI_Readiness_Report.pdf`);
    } catch (err) {
      alert('PDF export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // ── KPI section — differs between overall and single-round ────────────────
  const kpiSection = useMemo(() => {
    if (activeRound === 'overall' && perRoundStats) {
      const totalAll = perRoundStats.reduce((s, rs) => s + rs.totalResponses, 0);
      // Most improved pillar: compare first round vs last round pillar avgs
      const first = perRoundStats[0];
      const last  = perRoundStats[perRoundStats.length - 1];
      let mostImproved = null;
      if (first && last && first !== last) {
        const deltas = first.pillarList.map(p => {
          const latest = last.pillarList.find(lp => lp.name === p.name);
          return { name: p.name, delta: latest ? latest.avg - p.avg : 0 };
        });
        const best = deltas.reduce((a, b) => b.delta > a.delta ? b : a, deltas[0] ?? null);
        if (best) mostImproved = best;
      }
      return { mode: 'overall', totalAll, perRoundStats, mostImproved };
    }
    return { mode: 'single' };
  }, [activeRound, perRoundStats, rounds]);

  return (
    <div className="h-screen bg-gray-50 text-gray-900 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">{session.name}</h1>
            <p className="text-xs text-gray-400">AI Readiness — Company Report</p>
          </div>
          {selectedLevelName && activeRound !== 'overall' && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border cursor-pointer"
              style={{ borderColor: accentColor, color: accentColor, backgroundColor: `${accentColor}18` }}
              onClick={() => setSelectedLevel(null)}
              title="Click to clear filter"
            >
              {selectedLevelName}
              <span className="opacity-60 text-sm leading-none">×</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            disabled={exporting}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button
            onClick={onLogout}
            className="text-xs bg-white hover:bg-gray-50 border border-gray-200 text-gray-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Exit
          </button>
        </div>
      </div>

      {/* ── Round tabs (only when multiple rounds exist) ── */}
      {hasMultipleRounds && (
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-gray-400 font-semibold mr-1 flex-shrink-0">Round:</span>
          <button
            onClick={() => switchRound('overall')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex-shrink-0 ${
              activeRound === 'overall'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            Overall
          </button>
          {rounds.map((r) => {
            const isActive = activeRound === r.roundNum;
            const isCurrent = r.sessionId === session.id;
            const dateStr = new Date(r.createdAt).toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
            return (
              <button
                key={r.roundNum}
                onClick={() => switchRound(r.roundNum)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex-shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                Round {r.roundNum}
                {r.label ? ` · ${r.label}` : ''}
                <span className={`ml-1 ${isActive ? 'opacity-70' : 'text-gray-400'}`}>· {dateStr}</span>
                {isCurrent && <span className={`ml-1 ${isActive ? 'opacity-80' : 'text-blue-500'}`}>★</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Main grid ── */}
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-500 text-sm">No responses yet for this session.</p>
            <p className="text-gray-400 text-xs mt-1">Share the company code with participants to begin collecting responses.</p>
          </div>
        </div>
      ) : (
        <div ref={dashboardRef} className="flex-1 grid grid-cols-3 grid-rows-2 gap-3 p-3 min-h-0">

          {/* Radar */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 row-span-2 flex flex-col min-h-0 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Competency Profile</p>
            {activeRound !== 'overall' && selectedLevel !== null && (
              <p className="text-xs mb-1 flex-shrink-0" style={{ color: accentColor }}>
                {selectedLevelName} · {filteredTotal} respondent{filteredTotal !== 1 ? 's' : ''}
              </p>
            )}
            {activeRound === 'overall' && (
              <p className="text-xs text-gray-400 mb-1 flex-shrink-0">All rounds overlaid</p>
            )}
            <div className="flex-1 min-h-0">
              {radarTraces.length > 0
                ? <PlotlyChart traces={radarTraces} layout={radarLayout} />
                : <p className="text-xs text-gray-400 mt-4 text-center">Need ≥ 3 pillars for radar</p>
              }
            </div>
          </div>

          {/* Distribution */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col min-h-0 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">
              Readiness Distribution
              {activeRound !== 'overall' && selectedLevel === null && (
                <span className="text-gray-300 font-normal ml-1">(click a bar to filter)</span>
              )}
            </p>
            <div className="flex-1 min-h-0">
              <PlotlyChart
                traces={distTraces}
                layout={distLayout}
                onClickPoint={activeRound !== 'overall' ? handleDistClick : undefined}
              />
            </div>
          </div>

          {/* KPIs */}
          {kpiSection.mode === 'overall' ? (
            <div className="grid grid-rows-3 gap-2 min-h-0">
              <KpiCard
                label="Total Responses (All Rounds)"
                value={kpiSection.totalAll}
                accent="#2563eb"
              />
              {/* Avg score trend card */}
              <div className="bg-white rounded-xl p-4 flex flex-col justify-center border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-600 mb-2">Avg Score by Round</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {kpiSection.perRoundStats.map((rs, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {i > 0 && (
                        <span className={`text-sm font-bold ${rs.avg >= kpiSection.perRoundStats[i - 1].avg ? 'text-green-500' : 'text-red-400'}`}>
                          {rs.avg >= kpiSection.perRoundStats[i - 1].avg ? '↑' : '↓'}
                        </span>
                      )}
                      <div className="text-center">
                        <div className="text-lg font-bold tabular-nums" style={{ color: ROUND_COLORS[i % ROUND_COLORS.length] }}>
                          {rs.avg.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">R{rs.roundNum}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Most improved pillar card */}
              <div className="bg-white rounded-xl p-4 flex flex-col justify-center border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-600 mb-1">Most Improved Pillar</div>
                {kpiSection.mostImproved ? (
                  <>
                    <div className="text-sm font-bold text-gray-800 leading-tight">{kpiSection.mostImproved.name}</div>
                    <div className={`text-lg font-bold tabular-nums mt-0.5 ${kpiSection.mostImproved.delta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                      {kpiSection.mostImproved.delta >= 0 ? '+' : ''}{kpiSection.mostImproved.delta.toFixed(2)}
                      <span className="text-xs font-normal text-gray-400 ml-1">R1 → R{perRoundStats.length}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-400">—</div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-rows-3 gap-2 min-h-0">
              <KpiCard
                label={selectedLevel !== null ? `${selectedLevelName} Responses` : 'Total Responses'}
                value={filteredTotal}
                sub={selectedLevel !== null ? `of ${total} total` : undefined}
                accent={accentColor}
              />
              <div className="bg-white rounded-xl p-4 flex flex-col justify-center border border-gray-200 shadow-sm">
                <div className="flex items-baseline gap-2 flex-wrap" style={{ color: READINESS_LEVEL_STYLES[levelIdx].accent }}>
                  <span className="text-2xl font-bold tabular-nums">{overallAvg.toFixed(2)}</span>
                  <span className="text-2xl font-bold">({levelName})</span>
                </div>
                <div className="text-xs font-semibold text-gray-600 mt-0.5">Average Score</div>
                <div className="text-xs text-gray-400 mt-0.5">out of 5.00</div>
              </div>
              <div className="bg-white rounded-xl p-4 flex flex-col justify-center border border-gray-200 shadow-sm">
                <div className="text-xs font-semibold text-gray-600 mb-1">Top Pillar</div>
                {pillarList.length > 0 ? (() => {
                  const top = [...pillarList].sort((a, b) => b.avg - a.avg)[0];
                  return (
                    <>
                      <div className="text-sm font-bold text-gray-800 leading-tight truncate">{top.name}</div>
                      <div className="text-lg font-bold tabular-nums mt-0.5" style={{ color: accentColor }}>
                        {top.avg.toFixed(2)} <span className="text-xs font-normal text-gray-400">/ 5</span>
                      </div>
                    </>
                  );
                })() : <div className="text-sm text-gray-400">—</div>}
              </div>
            </div>
          )}

          {/* Pillar breakdown */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 col-span-2 flex flex-col min-h-0 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 flex-shrink-0">Score by Pillar</p>
            <div className="flex-1 min-h-0" style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}>
              <div style={{ gridArea: '1/1' }}>
                {filteredTotal > 0 || activeRound === 'overall'
                  ? <PlotlyChart traces={pillarTraces} layout={pillarLayout} />
                  : <p className="text-xs text-gray-400 text-center mt-4">No responses for this level</p>
                }
              </div>
              {/* Level legend — only shown in single-round mode */}
              {activeRound !== 'overall' && (
                <div style={{ gridArea: '1/1', alignSelf: 'start', justifySelf: 'end', zIndex: 10, margin: '8px' }} className="bg-white border border-gray-200 rounded-lg shadow-sm px-2.5 py-2 flex flex-col gap-1 pointer-events-none">
                  {LEVEL_COLORS.map((color, i) => (
                    <span key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="whitespace-nowrap">{readinessLevels[i]?.name ?? readinessLevels[i]}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [dashData, setDashData]   = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const code = sessionStorage.getItem('dashboardCode');
    if (code) fetchData(code);
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

  const handleLogin   = (data) => setDashData(data);
  const handleRefresh = async () => {
    const code = sessionStorage.getItem('dashboardCode');
    if (!code) return;
    setRefreshing(true);
    await fetchData(code);
    setRefreshing(false);
  };
  const handleLogout  = () => { sessionStorage.removeItem('dashboardCode'); setDashData(null); };

  if (!dashData) return <LoginScreen onLogin={handleLogin} />;
  return <Dashboard data={dashData} onRefresh={handleRefresh} onLogout={handleLogout} refreshing={refreshing} />;
}
