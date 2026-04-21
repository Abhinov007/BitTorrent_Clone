import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import TorrentTable from './components/TorrentTable';
import StatsPanel from './components/StatsPanel';
import { searchTorrents } from './api';

export default function App() {
  const [results, setResults]         = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching]     = useState(false);
  const [activeNav, setActiveNav]     = useState('search');
  const [activeName, setActiveName]   = useState(null);

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
    /* outer purple shell */
    <div style={{ minHeight: '100vh', background: '#1e1147', padding: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>

      {/* floating app card */}
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: '1200px',
        height: 'calc(100vh - 64px)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>

        <Sidebar activeNav={activeNav} onNav={setActiveNav} />

        {/* right panel — white */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#ffffff' }}>
          <Toolbar onSearch={handleSearch} searching={searching} />

          <main style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
            {activeNav === 'search' ? (
              <TorrentTable
                results={results}
                error={searchError}
                searching={searching}
                onDownloadStart={name => { setActiveName(name); setActiveNav('downloading'); }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#c4b5fd' }}>
                <div style={{ fontSize: 48, opacity: 0.3 }}>🚧</div>
                <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>Coming soon</p>
              </div>
            )}
          </main>

          <StatsPanel activeName={activeName} />
        </div>

      </div>
    </div>
  );
}
