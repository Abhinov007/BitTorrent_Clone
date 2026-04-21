import TorrentCard from './TorrentCard';

export default function SearchResults({ results, error, onDownloadStart }) {
  if (error) {
    return (
      <div className="text-center text-red-400 py-12">
        <p className="text-lg">⚠️ {error}</p>
        <p className="text-sm text-gray-500 mt-1">Make sure Prowlarr is running at localhost:9696</p>
      </div>
    );
  }

  if (results === null) {
    return (
      <div className="text-center text-gray-500 py-16">
        <p className="text-4xl mb-3">🔍</p>
        <p>Search for a torrent to get started</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center text-gray-500 py-16">
        <p className="text-4xl mb-3">😶</p>
        <p>No results found</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-gray-400 text-sm mb-4">{results.length} result{results.length !== 1 ? 's' : ''}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((r, i) => (
          <TorrentCard key={r.infoHash || r.title + i} result={r} onDownloadStart={onDownloadStart} />
        ))}
      </div>
    </div>
  );
}
