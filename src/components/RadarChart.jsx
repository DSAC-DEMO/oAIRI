function splitLabel(name) {
  const words = name.split(' ');
  if (words.length <= 1) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

// Single-series: pillars=[{name,pct}], color
// Multi-series:  series=[{name, color, pillars:[{name,pct}]}]  — renders overlaid, responsive
function RadarChart({ pillars, series, size = 240, color = '#22c55e', title }) {
  const multi = series && series.length > 0;
  const allSeries = multi ? series : [{ name: '', color, pillars }];
  const axisPillars = allSeries[0].pillars;
  const n = axisPillars.length;
  if (n < 3) return null;

  const V = multi ? 300 : size;
  const cx = V / 2;
  const cy = V / 2;
  const r = V / 2 - 54;
  const angle = (i) => (i * 2 * Math.PI / n) - Math.PI / 2;
  const pt = (i, frac) => ({
    x: cx + r * frac * Math.cos(angle(i)),
    y: cy + r * frac * Math.sin(angle(i)),
  });
  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const svgEl = (
    <svg
      width={multi ? '100%' : size}
      height={multi ? '100%' : size}
      viewBox={`0 0 ${V} ${V}`}
      preserveAspectRatio="xMidYMid meet"
      style={multi ? { flex: 1, minHeight: 0, display: 'block' } : {}}
    >
      {/* Grid rings */}
      {gridLevels.map(level => {
        const pts = axisPillars.map((_, i) => { const p = pt(i, level); return `${p.x},${p.y}`; }).join(' ');
        return <polygon key={level} points={pts} fill="none"
          stroke={level === 1.0 ? '#d1d5db' : '#e5e7eb'} strokeWidth={level === 1.0 ? 1.5 : 1} />;
      })}
      {/* Axes */}
      {axisPillars.map((_, i) => {
        const op = pt(i, 1.0);
        return <line key={i} x1={cx} y1={cy} x2={op.x} y2={op.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {/* Series polygons */}
      {allSeries.map((s, si) => {
        const poly = s.pillars.map((p, i) => { const dp = pt(i, p.pct / 100); return `${dp.x},${dp.y}`; }).join(' ');
        return (
          <g key={si}>
            <polygon points={poly} fill={s.color} fillOpacity="0.13" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {s.pillars.map((p, i) => {
              const dp = pt(i, p.pct / 100);
              return <circle key={i} cx={dp.x} cy={dp.y} r="3.5" fill={s.color} stroke="white" strokeWidth="1.5" />;
            })}
          </g>
        );
      })}
      {/* Labels */}
      {axisPillars.map((p, i) => {
        const a = angle(i);
        const lx = cx + (r + 26) * Math.cos(a);
        const ly = cy + (r + 26) * Math.sin(a);
        const lines = splitLabel(p.name);
        return (
          <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="600" fill="#374151">
            {lines.map((line, li) => (
              <tspan key={li} x={lx} dy={li === 0 ? (lines.length > 1 ? '-5' : '0') : '11'}>{line}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );

  if (!multi) return svgEl;

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {svgEl}
      {allSeries.length > 1 && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 pb-1 flex-shrink-0">
          {allSeries.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-gray-600 whitespace-nowrap">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RadarChart;
