import { useStatus } from '../hooks/useStatus';

function formatSpeed(bps) {
  if (!bps || bps === 0) return '0 KB/s';
  if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(2) + ' MB/s';
  if (bps >= 1024) return (bps / 1024).toFixed(1) + ' KB/s';
  return bps + ' B/s';
}

export default function SpeedView() {
  const { status, offline } = useStatus();

  const history = status?.speedHistory || [];
  const currentBps = status?.speedBps || 0;
  const hasData = history.length > 1;

  // Derived stats
  const allBps = history.map(s => s.bps);
  const peakBps = allBps.length ? Math.max(...allBps) : 0;
  const avgBps  = allBps.length ? allBps.reduce((a, b) => a + b, 0) / allBps.length : 0;

  // SVG graph dimensions
  const W = 600;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
  const gW = W - PAD.left - PAD.right;
  const gH = H - PAD.top  - PAD.bottom;

  // Build points — last 60 samples, evenly spaced
  const samples = history.slice(-60);
  const maxBps  = Math.max(peakBps, 1);
  const points  = samples.map((s, i) => {
    const x = PAD.left + (i / Math.max(samples.length - 1, 1)) * gW;
    const y = PAD.top  + gH - (s.bps / maxBps) * gH;
    return [x, y];
  });

  // SVG path from points
  const linePath = points.length < 2
    ? ''
    : 'M ' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');

  const fillPath = points.length < 2
    ? ''
    : linePath
      + ` L ${points[points.length - 1][0].toFixed(1)},${(PAD.top + gH).toFixed(1)}`
      + ` L ${points[0][0].toFixed(1)},${(PAD.top + gH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.top + gH - f * gH,
    label: formatSpeed(maxBps * f),
  }));

  // X-axis time labels (first / middle / last)
  const xLabels = samples.length >= 2
    ? [
        { x: PAD.left,           label: fmtTime(samples[0].t) },
        { x: PAD.left + gW / 2,  label: fmtTime(samples[Math.floor(samples.length / 2)].t) },
        { x: PAD.left + gW,      label: fmtTime(samples[samples.length - 1].t) },
      ]
    : [];

  if (!status?.total && !hasData) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.15 }}>📈</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>No active download</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Download Speed
      </div>

      {/* Stat chips */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatBox label="Current" value={offline ? '—' : formatSpeed(currentBps)} highlight />
        <StatBox label="Peak"    value={formatSpeed(peakBps)} />
        <StatBox label="Average" value={formatSpeed(avgBps)} />
      </div>

      {/* SVG Graph */}
      <div style={{ border: '1.5px solid #ede9fe', borderRadius: 10, overflow: 'hidden', background: '#fafaf9' }}>
        {hasData ? (
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Y grid lines + labels */}
            {yTicks.map(({ y, label }) => (
              <g key={y}>
                <line x1={PAD.left} y1={y} x2={PAD.left + gW} y2={y}
                  stroke="#ede9fe" strokeWidth="1" strokeDasharray="4 3" />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end"
                  fontSize="9" fill="#a78bfa" fontFamily="monospace">{label}</text>
              </g>
            ))}

            {/* X axis line */}
            <line x1={PAD.left} y1={PAD.top + gH} x2={PAD.left + gW} y2={PAD.top + gH}
              stroke="#ede9fe" strokeWidth="1" />

            {/* X time labels */}
            {xLabels.map(({ x, label }) => (
              <text key={x} x={x} y={H - 6} textAnchor="middle"
                fontSize="9" fill="#a78bfa" fontFamily="monospace">{label}</text>
            ))}

            {/* Fill area */}
            {fillPath && <path d={fillPath} fill="url(#speedGrad)" />}

            {/* Line */}
            {linePath && (
              <path d={linePath} fill="none" stroke="#7c3aed" strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
            )}

            {/* Current value dot */}
            {points.length > 0 && (
              <circle
                cx={points[points.length - 1][0]}
                cy={points[points.length - 1][1]}
                r="4" fill="#7c3aed" stroke="#fff" strokeWidth="2"
              />
            )}
          </svg>
        ) : (
          <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
            Waiting for data…
          </div>
        )}
      </div>

      {/* X-axis caption */}
      <div style={{ marginTop: 6, fontSize: 10, color: '#c4b5fd', textAlign: 'right' }}>
        Last {Math.round(samples.length * 5 / 60)} min of samples (5s interval)
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: highlight ? '#6d28d9' : '#374151', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

function fmtTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getHours().toString().padStart(2, '0') + ':' +
         d.getMinutes().toString().padStart(2, '0') + ':' +
         d.getSeconds().toString().padStart(2, '0');
}

const emptyStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  height: '100%', gap: 10,
};
