import { useState } from 'react';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import DownloadManager from './components/DownloadManager';
import { searchTorrents } from './api';

export default function App() {
  const [results, setResults]         = useState(null);   // null = never searched
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching]     = useState(false);
  const [activeName, setActiveName]   = useState(null);   // last started torrent name

  async function handleSearch(query) {
    setSearching(true);
    setSearchError(null);
    try {
      const data = await searchTorrents(query);
      setResults(data);
    } catch (err) {
      setSearchError(err.response?.data?.error || err.message || 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🧲</span>
        <h1 className="text-xl font-bold tracking-tight">BitTorrent Client</h1>
        <span className="ml-auto text-xs text-gray-500">Node.js + React</span>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* Search */}
        <section className="flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-gray-100">Search Torrents</h2>
          <SearchBar onSearch={handleSearch} loading={searching} />
        </section>

        {/* Two-column layout: results | download manager */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Results */}
          <div className="flex-1 min-w-0">
            <SearchResults
              results={results}
              error={searchError}
              onDownloadStart={name => setActiveName(name)}
            />
          </div>

          {/* Download Manager sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            <DownloadManager activeName={activeName} />
          </div>
        </div>
      </main>
    </div>
  );
}
