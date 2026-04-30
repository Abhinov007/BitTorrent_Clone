import { useState } from 'react';

export default function Toolbar({ onSearch, searching, isPaused, onPause, onResume, hasDownload, onDelete }) {
  const [query, setQuery] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim().length >= 2) onSearch(query.trim());
  }

  return (
    <header style={{
      height: 56,
      background: '#ffffff',
      borderBottom: '1px solid #f3f4f6',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 12,
    }}>

      {/* macOS-style traffic lights */}
      <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
        {['#ff5f57', '#ffbd2e', '#28c840'].map(c => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
        ))}
      </div>

      {/* Toolbar action buttons */}
      <button
        onClick={onResume}
        disabled={!hasDownload || !isPaused}
        title="Resume"
        style={{ ...btnStyle, ...(hasDownload && isPaused ? activeGreen : disabledStyle) }}
      >▶</button>
      <button
        onClick={onPause}
        disabled={!hasDownload || isPaused}
        title="Pause"
        style={{ ...btnStyle, ...(hasDownload && !isPaused ? activeOrange : disabledStyle) }}
      >⏸</button>
      <button
        onClick={onDelete}
        disabled={!hasDownload}
        title="Delete"
        style={{ ...btnStyle, ...(hasDownload ? activeRed : disabledStyle) }}
      >🗑</button>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: '#9ca3af', fontSize: 13, pointerEvents: 'none'
          }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search torrents…"
            style={{
              paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
              borderRadius: 8, border: '1.5px solid #e5e7eb',
              fontSize: 13, color: '#1f2937', outline: 'none',
              background: '#fafafa', width: 220,
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#7c3aed'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          style={{
            padding: '7px 18px',
            borderRadius: 8,
            border: 'none',
            background: searching || query.trim().length < 2 ? '#ddd6fe' : '#6d28d9',
            color: searching || query.trim().length < 2 ? '#7c3aed' : '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            cursor: searching || query.trim().length < 2 ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {searching ? '…' : 'Search'}
        </button>
      </form>
    </header>
  );
}

const btnStyle = {
  width: 30, height: 30,
  borderRadius: 6,
  border: '1px solid #e5e7eb',
  background: '#fafafa',
  cursor: 'pointer',
  fontSize: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#6b7280',
  transition: 'all 0.15s',
};

const activeGreen  = { background: '#dcfce7', borderColor: '#86efac', color: '#16a34a', cursor: 'pointer' };
const activeOrange = { background: '#fef9c3', borderColor: '#fde047', color: '#92400e', cursor: 'pointer' };
const activeRed    = { background: '#fee2e2', borderColor: '#fca5a5', color: '#dc2626', cursor: 'pointer' };
const disabledStyle = { opacity: 0.35, cursor: 'not-allowed' };
