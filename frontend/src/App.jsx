import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Toolbar from './components/Toolbar';
import TorrentTable from './components/TorrentTable';
import StatsPanel from './components/StatsPanel';
import DownloadingView from './components/DownloadingView';
import GeneralView from './components/GeneralView';
import TrackersView from './components/TrackersView';
import FilesView from './components/FilesView';
import PeersView from './components/PeersView';
import SpeedView from './components/SpeedView';
import { searchTorrents, pauseDownload, resumeDownload, deleteDownload } from './api';

export default function App() {
  const [results, setResults]         = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching]     = useState(false);
  const [view, setView]               = useState('search'); // unified nav (torrents + details)
  const [activeName, setActiveName]   = useState(null);
  const [isPaused, setIsPaused]       = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const hasDownload                   = !!activeName;

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

  async function handlePause() {
    try { await pauseDownload(); setIsPaused(true); } catch (_) {}
  }

  async function handleResume() {
    try { await resumeDownload(); setIsPaused(false); } catch (_) {}
  }

  async function handleDelete(deleteFiles) {
    setDeleteModal(false);
    try {
      await deleteDownload(deleteFiles);
      setActiveName(null);
      setIsPaused(false);
      setView('search');
    } catch (_) {}
  }

  function renderMain() {
    switch (view) {
      case 'search':
        return (
          <TorrentTable
            results={results}
            error={searchError}
            searching={searching}
            onDownloadStart={name => { setActiveName(name); setView('downloading'); }}
          />
        );
      case 'downloading':
      case 'active':
        return (
          <DownloadingView
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            onPause={handlePause}
            onResume={handleResume}
          />
        );
      case 'general':
        return <GeneralView />;
      case 'trackers':
        return <TrackersView />;
      case 'files':
        return <FilesView />;
      case 'peers':
        return <PeersView />;
      case 'speed':
        return <SpeedView />;
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <div style={{ fontSize: 48, opacity: 0.15 }}>🚧</div>
            <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>Coming soon</p>
          </div>
        );
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1e1147', padding: '32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{
        display: 'flex',
        width: '100%',
        maxWidth: '1200px',
        height: 'calc(100vh - 64px)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        <Sidebar activeView={view} onNav={setView} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#ffffff' }}>
          <Toolbar
            onSearch={handleSearch}
            searching={searching}
            isPaused={isPaused}
            hasDownload={hasDownload}
            onPause={handlePause}
            onResume={handleResume}
            onDelete={() => setDeleteModal(true)}
          />

          <main style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
            {renderMain()}
          </main>

          <StatsPanel activeName={activeName} onPausedChange={setIsPaused} />
        </div>
      </div>
      {/* Delete confirmation modal */}
      {deleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }} onClick={() => setDeleteModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '28px 32px',
            minWidth: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', gap: 20,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1f2937' }}>Remove Download</div>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              Do you also want to delete the downloaded files from disk?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteModal(false)} style={modalBtn}>Cancel</button>
              <button onClick={() => handleDelete(false)} style={{ ...modalBtn, background: '#ede9fe', color: '#6d28d9', borderColor: '#ddd6fe', fontWeight: 600 }}>
                Remove Only
              </button>
              <button onClick={() => handleDelete(true)} style={{ ...modalBtn, background: '#fee2e2', color: '#dc2626', borderColor: '#fecaca', fontWeight: 600 }}>
                Remove &amp; Delete Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalBtn = {
  padding: '7px 16px', borderRadius: 8,
  border: '1.5px solid #e5e7eb',
  background: '#f9fafb', color: '#374151',
  fontSize: 13, cursor: 'pointer',
};
