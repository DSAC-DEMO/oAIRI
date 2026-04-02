import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const SCENARIO_LABELS = [
  'Crisis Management', 'Team Leadership', 'Strategic Planning',
  'Resource Management', 'Stakeholder Comms', 'Performance Management',
  'Conflict Resolution', 'Change Management', 'Decision Making',
  'Innovation', 'Customer Relations', 'Ethical Dilemma',
  'Time Management', 'Quality vs Speed', 'Delegation',
  'Learning & Development', 'Feedback', 'Cross-Functional', 'Risk Management', 'Org Politics'
];

const LEVEL_COLORS = {
  'Expert Ready':     { bg: 'bg-emerald-100', text: 'text-emerald-800', bar: 'bg-emerald-500' },
  'Advanced Ready':   { bg: 'bg-green-100',   text: 'text-green-800',   bar: 'bg-green-500' },
  'Moderately Ready': { bg: 'bg-yellow-100',  text: 'text-yellow-800',  bar: 'bg-yellow-500' },
  'Developing':       { bg: 'bg-orange-100',  text: 'text-orange-800',  bar: 'bg-orange-500' },
  'Novice':           { bg: 'bg-red-100',     text: 'text-red-800',     bar: 'bg-red-500' },
};

// Pure-CSS horizontal bar
function Bar({ pct, colorClass, label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${Math.max(pct, 0)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct.toFixed(0)}%</span>
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

function AdminPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      fetchData(token);
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const result = await res.json();
      if (result.success) {
        localStorage.setItem('adminToken', result.token);
        setIsAuthenticated(true);
        setPassword('');
        fetchData(result.token);
      } else {
        setAuthError('Invalid password');
      }
    } catch {
      setAuthError('Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setData(null);
    navigate('/');
  };

  const fetchData = async (token) => {
    try {
      const res = await fetch('/api/admin', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        localStorage.removeItem('adminToken');
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch data');
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data?.responses?.length) return;
    const headers = ['ID', 'Readiness Level', 'Score', 'Score %', 'Submitted At',
      ...Array.from({ length: 20 }, (_, i) => `Q${i + 1}`)];
    const rows = data.responses.map(r => [
      r.id, r.readiness_level, r.total_score, r.score_pct, r.submitted_at,
      r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8, r.q9, r.q10,
      r.q11, r.q12, r.q13, r.q14, r.q15, r.q16, r.q17, r.q18, r.q19, r.q20
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `responses_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── Login screen ────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              placeholder="Enter admin password"
              required
            />
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {authError}
              </div>
            )}
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-lg text-gray-500">Loading analytics...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-lg text-red-600">Error: {error}</div>
    </div>
  );

  const { stats, questionAvgs, dailyTrend, scoreBuckets, responses } = data;
  const total = stats.total_responses || 0;

  // Build question difficulty array
  const questionDifficulty = SCENARIO_LABELS.map((label, i) => ({
    label,
    avg: questionAvgs ? Math.round((questionAvgs[`q${i + 1}`] || 0) * 100) / 100 : 0,
    pct: questionAvgs ? ((questionAvgs[`q${i + 1}`] || 0) / 5) * 100 : 0
  })).sort((a, b) => a.avg - b.avg);

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
        <div className="flex flex-wrap justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Readiness Assessment Analytics</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportCSV}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Export CSV
            </button>
            <button
              onClick={() => fetchData(localStorage.getItem('adminToken'))}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Responses" value={total} color="text-blue-600" />
          <StatCard label="Average Score" value={`${Math.round(stats.avg_score || 0)}/100`} color="text-green-600" />
          <StatCard label="Highest Score" value={`${stats.max_score || 0}/100`} color="text-emerald-600" />
          <StatCard label="Lowest Score" value={`${stats.min_score || 0}/100`} color="text-orange-600" />
        </div>

        {/* Distribution + Score Buckets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Readiness Level Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Readiness Level Distribution</h2>
            <div className="space-y-4">
              {[
                { key: 'Expert Ready',     count: stats.expert_count },
                { key: 'Advanced Ready',   count: stats.advanced_count },
                { key: 'Moderately Ready', count: stats.moderate_count },
                { key: 'Developing',       count: stats.developing_count },
                { key: 'Novice',           count: stats.novice_count },
              ].map(({ key, count }) => {
                const c = count || 0;
                const pct = total ? (c / total) * 100 : 0;
                const colors = LEVEL_COLORS[key];
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`font-semibold ${colors.text}`}>{key}</span>
                      <span className="text-gray-500">{c} ({pct.toFixed(1)}%)</span>
                    </div>
                    <Bar pct={pct} colorClass={colors.bar} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score Bucket Distribution */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Score Distribution</h2>
            {scoreBuckets.length === 0 ? (
              <p className="text-gray-400 text-sm">No data yet</p>
            ) : (
              <div className="space-y-4">
                {['85-100', '70-84', '55-69', '40-54', '20-39'].map((bucket) => {
                  const found = scoreBuckets.find(b => b.bucket === bucket);
                  const count = found?.count || 0;
                  const pct = total ? (count / total) * 100 : 0;
                  return (
                    <div key={bucket}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{bucket} pts</span>
                        <span className="text-gray-500">{count} ({pct.toFixed(1)}%)</span>
                      </div>
                      <Bar pct={pct} colorClass="bg-blue-500" />
                    </div>
                  );
                })}
              </div>
            )}
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

            // Y-axis labels: 0 and max
            const yLabels = [
              { y: PAD.top + plotH, val: 0 },
              { y: PAD.top, val: cumulativeMax },
              { y: PAD.top + plotH / 2, val: Math.round(cumulativeMax / 2) },
            ];

            // X-axis: show up to 6 evenly-spaced date labels
            const labelStep = Math.max(1, Math.ceil(pts.length / 6));
            const xLabels = pts.filter((_, i) => i % labelStep === 0 || i === pts.length - 1);

            return (
              <div className="overflow-x-auto">
                <svg width={SVG_W} height={SVG_H} style={{ minWidth: SVG_W, display: 'block' }}>
                  {/* Gridlines */}
                  {yLabels.map(({ y }) => (
                    <line key={y} x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y}
                      stroke="#f0f0f0" strokeWidth="1" />
                  ))}

                  {/* Y-axis labels */}
                  {yLabels.map(({ y, val }) => (
                    <text key={y} x={PAD.left - 4} y={y + 4} textAnchor="end"
                      fontSize="10" fill="#9ca3af">{val}</text>
                  ))}

                  {/* Fill area */}
                  <path d={fillPath} fill="#3b82f6" fillOpacity="0.1" />

                  {/* Line */}
                  <polyline fill="none" stroke="#3b82f6" strokeWidth="2"
                    strokeLinejoin="round" points={linePts} />

                  {/* Data points */}
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="4" fill="#3b82f6" stroke="white" strokeWidth="1.5" />
                      <title>{p.date}: {p.cumulative} total ({p.count} new)</title>
                    </g>
                  ))}

                  {/* X-axis labels */}
                  {xLabels.map((p) => (
                    <text key={p.date} x={p.x} y={SVG_H - 4} textAnchor="middle"
                      fontSize="10" fill="#9ca3af">{p.date.slice(5)}</text>
                  ))}
                </svg>
              </div>
            );
          })()}
        </div>

        {/* Per-Question Performance */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Scenario Performance</h2>
          <p className="text-xs text-gray-500 mb-5">Average score per scenario (sorted: hardest → easiest). Lower = respondents struggled more.</p>
          {total === 0 ? (
            <p className="text-gray-400 text-sm">No data yet</p>
          ) : (
            <div className="space-y-3">
              {questionDifficulty.map((q, idx) => {
                const barColor = q.pct >= 70 ? 'bg-green-500' : q.pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={idx}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-gray-700">{q.label}</span>
                      <span className="text-gray-500">{q.avg}/5 avg</span>
                    </div>
                    <Bar pct={q.pct} colorClass={barColor} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                  {responses.map((r) => {
                    const colors = LEVEL_COLORS[r.readiness_level] || LEVEL_COLORS['Novice'];
                    const isExpanded = expandedRow === r.id;
                    const qScores = Array.from({ length: 20 }, (_, i) => r[`q${i + 1}`]);
                    return (
                      <>
                        <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-500">{r.id}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors.bg} ${colors.text}`}>
                              {r.readiness_level}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.total_score}/100</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(r.submitted_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {isExpanded ? 'Hide' : 'View'} answers
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${r.id}-expand`} className="bg-blue-50">
                            <td colSpan={5} className="px-4 py-4">
                              <div className="grid grid-cols-4 sm:grid-cols-10 gap-2">
                                {qScores.map((score, i) => (
                                  <div key={i} className="text-center">
                                    <div className="text-xs text-gray-500 mb-1">Q{i + 1}</div>
                                    <div className={`text-sm font-bold rounded px-2 py-1 ${
                                      score >= 4 ? 'bg-green-100 text-green-700' :
                                      score === 3 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {score}/5
                                    </div>
                                  </div>
                                ))}
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

      </div>
    </div>
  );
}

export default AdminPage;
