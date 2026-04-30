import { useEffect, useState } from 'react';
import { getActivePeers } from '../api';
import { useStatus } from '../hooks/useStatus';

export default function PeersView() {
  const { status }          = useStatus();
  const [peers, setPeers]   = useState([]);
  const [error, setError]   = useState(false);

  useEffect(() => {
    let id;
    async function poll() {
      try {
        setPeers(await getActivePeers());
        setError(false);
      } catch {
        setError(true);
      }
      id = setTimeout(poll, 2000);
    }
    poll();
    return () => clearTimeout(id);
  }, []);

  const hasDownload = status?.total > 0;

  if (!hasDownload && peers.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: 40, opacity: 0.15 }}>👥</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>No active download</p>
      </div>
    );
  }

  const connected = peers.filter(p => p.connected).length;
  const total     = peers.length;

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Peers
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Chip label="Connected" value={connected} color="#16a34a" bg="#dcfce7" />
          <Chip label="Total"     value={total}     color="#6d28d9" bg="#ede9fe" />
        </div>
      </div>

      {/* Table */}
      {peers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
          No peers discovered yet
        </div>
      ) : (
        <div style={{ border: '1.5px solid #ede9fe', borderRadius: 10, overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{ ...rowStyle, background: '#f5f3ff', borderBottom: '1.5px solid #ede9fe' }}>
            <ColHead w={COL.addr}>IP : Port</ColHead>
            <ColHead w={COL.status}>Status</ColHead>
            <ColHead w={COL.choked}>Choked</ColHead>
            <ColHead w={COL.inflight}>In-Flight</ColHead>
            <ColHead w={COL.pieces}>Pieces</ColHead>
            <ColHead w={COL.attempts}>Attempts</ColHead>
          </div>

          {/* Rows */}
          {peers.map((p, i) => (
            <PeerRow key={`${p.ip}:${p.port}`} peer={p} alt={i % 2 === 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const COL = { addr: 180, status: 90, choked: 80, inflight: 80, pieces: 80, attempts: 80 };

function ColHead({ children, w }) {
  return (
    <div style={{ width: w, flexShrink: 0, fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {children}
    </div>
  );
}

function PeerRow({ peer, alt }) {
  const statusColor = peer.connected ? '#16a34a' : peer.failed ? '#dc2626' : '#9ca3af';
  const statusLabel = peer.connected ? 'Connected' : peer.failed ? 'Failed' : 'Pending';

  return (
    <div style={{ ...rowStyle, background: alt ? '#fafaf9' : '#ffffff', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ width: COL.addr, flexShrink: 0, fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>
        {peer.ip}:{peer.port}
      </div>
      <div style={{ width: COL.status, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: statusColor, marginRight: 5 }} />
          {statusLabel}
        </span>
      </div>
      <div style={{ width: COL.choked, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: peer.choked ? '#ca8a04' : '#16a34a' }}>
          {peer.choked ? 'Choked' : 'Unchoked'}
        </span>
      </div>
      <div style={{ width: COL.inflight, flexShrink: 0, fontSize: 13, color: '#374151', fontWeight: 500 }}>
        {peer.inFlight ?? 0}
      </div>
      <div style={{ width: COL.pieces, flexShrink: 0, fontSize: 13, color: '#374151', fontWeight: 500 }}>
        {peer.pieces ?? '—'}
      </div>
      <div style={{ width: COL.attempts, flexShrink: 0, fontSize: 13, color: '#9ca3af' }}>
        {peer.attempts}
      </div>
    </div>
  );
}

function Chip({ label, value, color, bg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: bg, borderRadius: 20, padding: '3px 10px' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10, color, opacity: 0.7 }}>{label}</span>
    </div>
  );
}

const rowStyle = {
  display: 'flex', alignItems: 'center',
  padding: '10px 16px', gap: 0,
};

const emptyStyle = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  height: '100%', gap: 10,
};
