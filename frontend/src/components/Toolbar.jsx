import { useState } from 'react';

export default function Toolbar({ onSearch, searching }) {
  const [query, setQuery] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (query.trim().length >= 2) onSearch(query.trim());
  }

  return (
    <header className="h-14 bg-[#161720] border-b border-white/5 flex items-center px-5 gap-4 shrink-0">
      {/* Search */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1 max-w-lg">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search torrents..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#0d0e18] border border-white/8
                       text-sm text-gray-200 placeholder-gray-600
                       focus:outline-none focus:border-violet-500/60 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={searching || query.trim().length < 2}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500
                     text-white text-sm font-medium
                     disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {searching
            ? <span className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"/>
                </svg>
                Searching
              </span>
            : 'Search'
          }
        </button>
      </form>
    </header>
  );
}
