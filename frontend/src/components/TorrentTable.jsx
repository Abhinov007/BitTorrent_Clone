import { useState } from 'react';
import { downloadByUrl, downloadByMagnet, downloadByHash } from '../api';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' Gb';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' Mb';
  if (bytes >= 1024)      return (bytes / 1024).toFixed(1) + ' Kb';
  return bytes + ' B';
}

function ProgressBar({ value = 0 }) {
  const pct = Math.min(value, 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 4, background: '#ede9fe', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          background: 'linear-gradient(90deg, #7c3aed, #6d28d9)',
          width: `${pct}%`,
          transition: 'width 0.5s',
        }} />
      </div>
      <span style={{ fontSize: 11, color: '#6b7280', minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

function SeedCount({ value }) {
  const color = value > 20 ? '#16a34a' : value > 5 ? '#ca8a04' : '#dc2626';
  return <span style={{ color, fontWeight: 500, fontSize: 13 }}>{value ?? 0}</span>;
}

function TypeBadge({ magnetLink, torrentUrl }) {
  if (magnetLink) return <span style={badge('#f3e8ff', '#7c3aed')}>magnet</span>;
  if (torrentUrl) return <span style={badge('#dbeafe', '#2563eb')}>.torrent</span>;
  return <span style={badge('#f3f4f6', '#9ca3af')}>hash</span>;
}

function badge(bg, color) {
  return { background: bg, color, fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600 };
}

function TorrentRow({ result, onDownloadStart }) {
  const { title, size, seeders, leechers, infoHash, magnetLink, torrentUrl, source } = result;
  const [status, setStatus] = useState('idle');
  const [hovered, setHovered] = useState(false);

  async function handleDownload(e) {
    e.stopPropagation();
    setStatus('loading');

    // Fallback chain: URL → magnet → hash
    // If the Prowlarr proxy URL fails (500/429), try the next available source
    const attempts = [
      torrentUrl  ? () => downloadByUrl(torrentUrl)        : null,
      magnetLink  ? () => downloadByMagnet(magnetLink)     : null,
      infoHash    ? () => downloadByHash(infoHash, title)  : null,
    ].filter(Boolean);

    if (attempts.length === 0) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }

    for (const attempt of attempts) {
      try {
        await attempt();
        setStatus('started');
        onDownloadStart?.(title);
        return;                          // success — stop trying
      } catch (err) {
        const code = err.response?.status;
        // Only fall through on server/indexer errors (5xx) or rate limit (429)
        if (code && (code >= 500 || code === 429)) continue;
        break;                           // client error or network — don't retry
      }
    }

    setStatus('error');
    setTimeout(() => setStatus('idle'), 4000);
  }

  const dlBtnStyle = {
    padding: '5px 14px',
    borderRadius: 6,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: status === 'loading' || status === 'started' ? 'default' : 'pointer',
    transition: 'all 0.15s',
    opacity: hovered || status !== 'idle' ? 1 : 0,
    ...(status === 'started' ? { background: '#dcfce7', color: '#16a34a' }
      : status === 'error'   ? { background: '#fee2e2', color: '#dc2626' }
      : status === 'loading' ? { background: '#f3f4f6', color: '#9ca3af' }
      :                        { background: '#ede9fe', color: '#6d28d9' }),
  };

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderBottom: '1px solid #f9fafb', background: hovered ? '#fafaf9' : 'transparent', transition: 'background 0.1s' }}
    >
      <td style={{ padding: '12px 16px', maxWidth: 280 }}>
        <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
          {title}
        </div>
        <div style={{ marginTop: 3 }}>
          <TypeBadge magnetLink={magnetLink} torrentUrl={torrentUrl} />
        </div>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        <ProgressBar value={0} />
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        {formatBytes(size)}
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
        —
      </td>
      <td style={{ padding: '12px 16px' }}>
        <SeedCount value={seeders} />
        <span style={{ fontSize: 11, color: '#d1d5db', marginLeft: 2 }}>/{leechers ?? 0}</span>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {source}
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
        <button onClick={handleDownload} disabled={status === 'loading' || status === 'started'} style={dlBtnStyle}>
          {status === 'started' ? '✓ Added' : status === 'loading' ? '…' : status === 'error' ? 'Failed' : '↓ Download'}
        </button>
      </td>
    </tr>
  );
}

const COL = ['Name', 'Progress', 'Size', 'Done', 'Seeds / Peers', 'Source', ''];

export default function TorrentTable({ results, error, searching, onDownloadStart }) {
  if (searching) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #ede9fe', borderTopColor: '#7c3aed',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>Searching indexers…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
        <p style={{ margin: 0, color: '#dc2626', fontSize: 14 }}>⚠ {error}</p>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Make sure Prowlarr is running at localhost:9696</p>
      </div>
    );
  }

  if (results === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, userSelect: 'none' }}>
        <div style={{ fontSize: 48, opacity: 0.15 }}>🔍</div>
        <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>Search for torrents to get started</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>No results found</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #f3f4f6' }}>
            {COL.map(c => (
              <th key={c} style={{
                padding: '10px 16px', textAlign: 'left',
                fontSize: 11, fontWeight: 700, color: '#9ca3af',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <TorrentRow key={r.infoHash || r.title + i} result={r} onDownloadStart={onDownloadStart} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
