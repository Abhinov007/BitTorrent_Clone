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

function formatEta(downloaded, total, speedBps) {
  if (!speedBps || downloaded >= total) return '—';
  const secsLeft = (total - downloaded) / speedBps;
  if (secsLeft > 3600) return `${Math.floor(secsLeft / 3600)}h ${Math.floor((secsLeft % 3600) / 60)}m`;
  if (secsLeft > 60)   return `${Math.floor(secsLeft / 60)}m ${Math.floor(secsLeft % 60)}s`;
  return `${Math.floor(secsLeft)}s`;
}

export default function DownloadingView({ onPause, onResume, isPaused, setIsPaused }) {
  const { status, offline } = useStatus();

  // Keep parent isPaused in sync with what the server reports
  if (status && status.paused !== isPaused) setIsPaused(status.paused);

  const hasDownload = status?.total > 0;
  const pct         = status ? Math.min(parseFloat(status.percent), 100) : 0;
  const isDone      = hasDownload && pct >= 100;

  if (offline) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.2 }}>📡</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>Backend offline</p>
      </div>
    );
  }

  if (!hasDownload) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.15 }}>⬇️</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>No active downloads</p>
        <p style={{ margin: 0, fontSize: 12, color: '#d1d5db' }}>Start a download from the Search tab</p>
      </div>
    );
  }

  const statusColor = isDone     ? '#16a34a'
    : isPaused                   ? '#ca8a04'
    :                              '#6d28d9';

  const statusLabel = isDone ? 'Complete' : isPaused ? 'Paused' : 'Downloading';

  return (
    <div style={{ padding: '24px' }}>
      {/* Section header */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Active Downloads
      </div>

      {/* Download card */}
      <div style={{
        border: '1.5px solid #ede9fe',
        borderRadius: 12,
        padding: '20px 24px',
        background: '#fafaf9',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {status.name || 'Unknown'}
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {status.downloadPath || '—'}
            </div>
          </div>

          {/* Status badge + pause/resume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: isDone ? '#dcfce7' : isPaused ? '#fef9c3' : '#ede9fe',
              color: statusColor,
            }}>
              {statusLabel}
            </span>

            {!isDone && (
              isPaused
                ? <button onClick={onResume} style={actionBtn('#6d28d9', '#ffffff')}>▶ Resume</button>
                : <button onClick={onPause}  style={actionBtn('#f3f4f6', '#374151')}>⏸ Pause</button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 8, background: '#ede9fe', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 8,
              background: isDone ? '#16a34a' : isPaused ? '#ca8a04' : 'linear-gradient(90deg, #7c3aed, #6d28d9)',
              width: `${pct}%`,
              transition: 'width 0.7s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{pct.toFixed(1)}%</span>
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              {formatBytes(status.downloaded)} / {formatBytes(status.total)}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <Stat label="Speed"   value={formatSpeed(status.speedBps)} />
          <Stat label="ETA"     value={formatEta(status.downloaded, status.total, status.speedBps)} />
          <Stat label="Peers"   value={`${status.connectedPeers ?? 0} / ${status.totalPeers ?? 0}`} />
          <Stat label="Pieces"  value={`${status.piecesComplete ?? 0} / ${status.totalPieces ?? 0}`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{value}</span>
    </div>
  );
}

function actionBtn(bg, color) {
  return {
    padding: '5px 14px', borderRadius: 6, border: 'none',
    background: bg, color, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'opacity 0.15s',
  };
}

const emptyStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  height: '100%', gap: 10,
};
