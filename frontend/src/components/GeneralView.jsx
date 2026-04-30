import { useStatus } from '../hooks/useStatus';

function formatBytes(b) {
  if (!b) return '0 B';
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(2) + ' GB';
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + ' MB';
  if (b >= 1024)      return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

function formatSpeed(bps) {
  if (!bps) return '0 KB/s';
  if (bps >= 1024 ** 2) return (bps / 1024 ** 2).toFixed(2) + ' MB/s';
  return (bps / 1024).toFixed(1) + ' KB/s';
}

export default function GeneralView() {
  const { status, offline } = useStatus();

  if (offline || !status?.total) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.15 }}>◻</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
          {offline ? 'Backend offline' : 'No active download'}
        </p>
      </div>
    );
  }

  const pct    = Math.min(parseFloat(status.percent), 100);
  const isDone = pct >= 100;
  const remaining = Math.max(0, status.total - status.downloaded);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
        General
      </div>

      {/* Big progress section */}
      <div style={{ background: '#fafaf9', border: '1.5px solid #ede9fe', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Download Progress</span>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: isDone ? '#dcfce7' : status.paused ? '#fef9c3' : '#ede9fe',
            color:      isDone ? '#16a34a' : status.paused ? '#ca8a04' : '#6d28d9',
          }}>
            {isDone ? 'Complete' : status.paused ? 'Paused' : 'Downloading'}
          </span>
        </div>

        <div style={{ height: 12, background: '#ede9fe', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{
            height: '100%', borderRadius: 8,
            background: isDone ? '#16a34a' : 'linear-gradient(90deg, #7c3aed, #6d28d9)',
            width: `${pct}%`,
            transition: 'width 0.7s',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{formatBytes(status.downloaded)} downloaded</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>{pct.toFixed(2)}%</span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{formatBytes(status.total)} total</span>
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <InfoRow label="Name"       value={status.name || '—'} />
        <InfoRow label="Save Path"  value={status.downloadPath || '—'} mono />
        <InfoRow label="Total Size" value={formatBytes(status.total)} />
        <InfoRow label="Downloaded" value={formatBytes(status.downloaded)} />
        <InfoRow label="Remaining"  value={formatBytes(remaining)} />
        <InfoRow label="Speed"      value={formatSpeed(status.speedBps)} highlight />
        <InfoRow label="Pieces"     value={`${status.piecesComplete ?? 0} / ${status.totalPieces ?? 0}`} />
        <InfoRow label="Peers"      value={`${status.connectedPeers ?? 0} connected (${status.totalPeers ?? 0} known)`} />
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight, mono }) {
  return (
    <div style={{ background: '#fafaf9', border: '1.5px solid #ede9fe', borderRadius: 8, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: highlight ? '#6d28d9' : '#374151',
        fontFamily: mono ? 'monospace' : undefined,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={value}>
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
