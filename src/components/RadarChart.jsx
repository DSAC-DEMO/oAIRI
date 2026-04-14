function splitLabel(name) {
  const words = name.split(' ');
  if (words.length <= 1) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

// pillars: [{ name: string, pct: number (0-100) }]
function RadarChart({ pillars, size = 240, color = '#3b82f6', title }) {
  const n = pillars.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 44;
  const angle = (i) => (i * 2 * Math.PI / n) - Math.PI / 2;

  const pt = (i, frac) => ({
    x: cx + r * frac * Math.cos(angle(i)),
    y: cy + r * frac * Math.sin(angle(i)),
  });

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const dataPolyPoints = pillars
    .map((p, i) => { const dp = pt(i, p.pct / 100); return `${dp.x},${dp.y}`; })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {gridLevels.map(level => {
        const pts = pillars.map((_, i) => { const p = pt(i, level); return `${p.x},${p.y}`; }).join(' ');
        return (
          <polygon key={level} points={pts} fill="none"
            stroke={level === 1.0 ? '#d1d5db' : '#e5e7eb'} strokeWidth={level === 1.0 ? 1.5 : 1} />
        );
      })}

      {/* Axes */}
      {pillars.map((_, i) => {
        const op = pt(i, 1.0);
        return <line key={i} x1={cx} y1={cy} x2={op.x} y2={op.y} stroke="#e5e7eb" strokeWidth="1" />;
      })}

      {/* Data fill */}
      <polygon points={dataPolyPoints}
        fill={color} fillOpacity="0.18"
        stroke={color} strokeWidth="2" strokeLinejoin="round" />

      {/* Data dots */}
      {pillars.map((p, i) => {
        const dp = pt(i, p.pct / 100);
        return <circle key={i} cx={dp.x} cy={dp.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />;
      })}

      {/* Labels */}
      {pillars.map((p, i) => {
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
}

export default RadarChart;
