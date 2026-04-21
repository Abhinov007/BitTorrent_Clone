import { useEffect, useState } from 'react';
import { getStatus } from '../api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(2) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  if (bytes >= 1024)      return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export default function DownloadManager({ activeName }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let interval;

    async function poll() {
      try {
        const data = await getStatus();
        setStats(data);
        setError(false);
      } catch {
        setError(true);
      }
    }

    poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const percent = stats ? parseFloat(stats.percent) : 0;
  const isDone = percent >= 100;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
      <h2 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
        ⬇ Download Manager
        {!error && stats && (
          <span className="ml-auto text-xs text-gray-400 font-normal">
            {isDone ? '✅ Complete' : 'Active'}
          </span>
        )}
      </h2>

      {error ? (
        <p className="text-sm text-gray-500">Backend offline — start the server to see progress</p>
      ) : stats === null ? (
        <p className="text-sm text-gray-500">Connecting…</p>
      ) : (
        <>
          {/* Current torrent name */}
          {activeName && (
            <p className="text-sm text-gray-300 mb-3 truncate" title={activeName}>
              📄 {activeName}
            </p>
          )}

          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden mb-2">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${isDone ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{formatBytes(stats.downloaded)} / {formatBytes(stats.total)}</span>
            <span className={isDone ? 'text-green-400 font-semibold' : 'text-blue-400'}>
              {percent}%
            </span>
          </div>

          {/* No active download */}
          {stats.total === 0 && (
            <p className="text-xs text-gray-500 mt-3">No active download — search and click Download to begin</p>
          )}
        </>
      )}
    </div>
  );
}
