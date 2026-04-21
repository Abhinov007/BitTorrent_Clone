import { useState } from 'react';

export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length >= 2) onSearch(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl mx-auto">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search torrents..."
        className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-600
                   placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
      />
      <button
        type="submit"
        disabled={loading || query.trim().length < 2}
        className="px-6 py-2 rounded-lg bg-blue-600 text-white font-semibold
                   hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}
