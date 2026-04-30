import { useStatus } from '../hooks/useStatus';

export default function TrackersView() {
  const { status, offline } = useStatus();

  const trackers = status?.trackers || [];
  const hasDownload = status?.total > 0;

  if (offline || !hasDownload) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.15 }}>↻</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>
          {offline ? 'Backend offline' : 'No active download'}
        </p>
      </div>
    );
  }

  const isActive = hasDownload && !status.paused && parseFloat(status.percent) < 100;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Trackers
        </div>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{trackers.length} tracker{trackers.length !== 1 ? 's' : ''}</span>
      </div>

      {trackers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
          No trackers available for this torrent
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trackers.map((url, i) => (
            <TrackerRow key={i} url={url} isActive={isActive} peersTotal={status.totalPeers} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrackerRow({ url, isActive, peersTotal, index }) {
  let protocol = 'HTTP';
  let dotColor = '#9ca3af';
  let statusLabel = 'Unknown';

  if (url.startsWith('udp://'))    { protocol = 'UDP';  }
  if (url.startsWith('https://'))  { protocol = 'HTTPS'; }

  if (isActive) {
    dotColor    = index === 0 ? '#16a34a' : '#6d28d9'; // first tracker likely the one that worked
    statusLabel = index === 0 ? 'Active' : 'Working';
  }

  let hostname = url;
  try { hostname = new URL(url).hostname; } catch (_) {}

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      background: '#fafaf9', border: '1.5px solid #ede9fe', borderRadius: 8,
    }}>
      {/* Status dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

      {/* Protocol badge */}
      <span style={{
        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: protocol === 'UDP' ? '#fef3c7' : protocol === 'HTTPS' ? '#dcfce7' : '#ede9fe',
        color:      protocol === 'UDP' ? '#92400e' : protocol === 'HTTPS' ? '#15803d' : '#5b21b6',
        flexShrink: 0,
      }}>{protocol}</span>

      {/* URL */}
      <span style={{ flex: 1, fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={url}>
        {url}
      </span>

      {/* Status + peer count */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: dotColor }}>{statusLabel}</span>
        {isActive && index === 0 && (
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{peersTotal ?? 0} peers</span>
        )}
      </div>
    </div>
  );
}

const emptyStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  height: '100%', gap: 10,
};
