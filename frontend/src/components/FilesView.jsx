import { useStatus } from '../hooks/useStatus';

function formatBytes(b) {
  if (!b) return '0 B';
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + ' GB';
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + ' MB';
  if (b >= 1024)      return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

export default function FilesView() {
  const { status, offline } = useStatus();

  if (offline || !status?.total) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.15 }}>📁</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
          {offline ? 'Backend offline' : 'No active download'}
        </p>
      </div>
    );
  }

  const pct    = Math.min(parseFloat(status.percent), 100);
  const isDone = pct >= 100;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Download File
      </div>

      {/* File card */}
      <div style={{ background: '#fafaf9', border: '1.5px solid #ede9fe', borderRadius: 12, padding: '20px 24px' }}>
        {/* Icon + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10,
            background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, flexShrink: 0,
          }}>
            📄
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {status.name || 'Unknown file'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontFamily: 'monospace' }}>
              {status.downloadPath || '—'}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ height: 8, background: '#ede9fe', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              height: '100%', borderRadius: 8,
              background: isDone ? '#16a34a' : 'linear-gradient(90deg, #7c3aed, #6d28d9)',
              width: `${pct}%`,
              transition: 'width 0.7s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {formatBytes(status.downloaded)} of {formatBytes(status.total)}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: isDone ? '#16a34a' : '#6d28d9' }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <MetaItem label="Total Size"    value={formatBytes(status.total)} />
          <MetaItem label="Downloaded"   value={formatBytes(status.downloaded)} />
          <MetaItem label="Remaining"    value={formatBytes(Math.max(0, status.total - status.downloaded))} />
          <MetaItem label="Pieces Total" value={`${status.totalPieces ?? '—'}`} />
          <MetaItem label="Pieces Done"  value={`${status.piecesComplete ?? '—'}`} />
          <MetaItem label="Status"       value={isDone ? '✓ Complete' : status.paused ? '⏸ Paused' : '⬇ Downloading'} highlight={isDone} />
        </div>
      </div>
    </div>
  );
}

function MetaItem({ label, value, highlight }) {
  return (
    <div style={{ padding: '10px 12px', background: '#ffffff', border: '1px solid #f3f4f6', borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? '#16a34a' : '#374151' }}>
        {value}
      </div>
    </div>
  );
}

const emptyStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  height: '100%', gap: 10,
};
