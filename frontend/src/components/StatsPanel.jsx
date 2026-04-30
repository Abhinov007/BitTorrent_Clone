import { useEffect, useState } from 'react';
import { getStatus } from '../api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' Gb';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' Mb';
  if (bytes >= 1024)      return (bytes / 1024).toFixed(1) + ' Kb';
  return bytes + ' B';
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: highlight ? '#6d28d9' : '#1f2937', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function StatsPanel({ activeName, onPausedChange }) {
  const [stats, setStats]     = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let id;
    async function poll() {
      try {
        const s = await getStatus();
        setStats(s);
        setOffline(false);
        // Keep App's isPaused state in sync with what the server reports
        if (onPausedChange && s.paused !== undefined) onPausedChange(s.paused);
        id = setTimeout(poll, 2000);
      } catch {
        setOffline(true);
        id = setTimeout(poll, 10000);
      }
    }
    poll();
    return () => clearTimeout(id);
  }, []);

  const percent  = stats ? parseFloat(stats.percent) : 0;
  const hasActive = stats?.total > 0;
  const isDone    = hasActive && percent >= 100;

  const statusColor = isDone    ? { background: '#dcfce7', color: '#16a34a' }
    : hasActive                 ? { background: '#ede9fe', color: '#6d28d9' }
    :                             { background: '#f3f4f6', color: '#9ca3af' };

  return (
    <footer style={{
      borderTop: '1.5px solid #f3f4f6',
      background: '#fafaf9',
      padding: '16px 24px',
    }}>

      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Transfer
      </div>

      <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap' }}>

        <Stat label="Downloaded"  value={offline ? '—' : formatBytes(stats?.downloaded)} />
        <Stat label="Total Size"  value={offline ? '—' : formatBytes(stats?.total)} />
        <Stat label="Progress"    value={`${percent.toFixed(1)}%`} highlight />

        {/* Progress bar */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ height: 4, background: '#ede9fe', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              background: isDone ? '#16a34a' : 'linear-gradient(90deg, #7c3aed, #6d28d9)',
              width: `${Math.min(percent, 100)}%`,
              transition: 'width 0.7s',
            }} />
          </div>
        </div>

        {/* Active file name */}
        {activeName && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 200, overflow: 'hidden' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>File</span>
            <span style={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeName}>{activeName}</span>
          </div>
        )}

        {/* Status badge */}
        <span style={{
          marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          ...statusColor,
        }}>
          {offline ? 'Offline' : isDone ? 'Complete' : hasActive ? 'Downloading' : 'Idle'}
        </span>

      </div>
    </footer>
  );
}
