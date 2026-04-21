import { useState } from 'react';
import { downloadByUrl, downloadByMagnet, downloadByHash } from '../api';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024)      return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export default function TorrentCard({ result, onDownloadStart }) {
  const { title, size, seeders, leechers, infoHash, magnetLink, torrentUrl, source } = result;
  const [status, setStatus] = useState('idle'); // idle | loading | started | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleDownload() {
    setStatus('loading');
    setErrorMsg('');
    try {
      if (torrentUrl) {
        await downloadByUrl(torrentUrl);
      } else if (magnetLink) {
        await downloadByMagnet(magnetLink);
      } else if (infoHash) {
        await downloadByHash(infoHash, title);
      } else {
        throw new Error('No download source available');
      }
      setStatus('started');
      onDownloadStart?.(title);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || err.message);
    }
  }

  const seedColor = seeders > 10 ? 'text-green-400' : seeders > 0 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col gap-3 hover:border-gray-500 transition-colors">
      {/* Title */}
      <p className="text-white font-medium text-sm leading-snug line-clamp-2" title={title}>
        {title}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span>📦 {formatBytes(size)}</span>
        <span className={seedColor}>▲ {seeders ?? '—'} seeders</span>
        <span>▼ {leechers ?? '—'} leechers</span>
        <span className="ml-auto text-gray-500">{source}</span>
      </div>

      {/* Source badge */}
      <div className="flex gap-1 text-xs flex-wrap">
        {magnetLink && (
          <span className="px-2 py-0.5 bg-purple-900 text-purple-300 rounded-full">magnet</span>
        )}
        {torrentUrl && (
          <span className="px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full">.torrent</span>
        )}
        {infoHash && (
          <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">hash</span>
        )}
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={status === 'loading' || status === 'started'}
        className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors
          ${status === 'started'  ? 'bg-green-700 text-green-200 cursor-default' :
            status === 'error'    ? 'bg-red-700 hover:bg-red-600 text-white' :
            status === 'loading'  ? 'bg-gray-600 text-gray-300 cursor-wait' :
                                    'bg-blue-600 hover:bg-blue-500 text-white'}`}
      >
        {status === 'started'  ? '✅ Download started' :
         status === 'loading'  ? 'Starting…' :
         status === 'error'    ? '⚠️ Retry' :
                                 '⬇ Download'}
      </button>

      {/* Error message */}
      {status === 'error' && errorMsg && (
        <p className="text-xs text-red-400 break-words">{errorMsg}</p>
      )}
    </div>
  );
}
