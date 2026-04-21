const NAV_ITEMS = [
  { id: 'search',      label: 'Search',      icon: SearchIcon },
  { id: 'downloading', label: 'Downloading',  icon: DownloadIcon },
  { id: 'completed',   label: 'Completed',    icon: CheckIcon },
  { id: 'active',      label: 'Active',       icon: BoltIcon },
  { id: 'inactive',    label: 'Inactive',     icon: PauseIcon },
];

function SearchIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function DownloadIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function CheckIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg> }
function BoltIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> }
function PauseIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> }

export default function Sidebar({ activeNav, onNav }) {
  return (
    <aside className="w-44 bg-[#161720] border-r border-white/5 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="font-bold text-sm text-white tracking-wide">BitClient</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNav(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
              ${activeNav === id
                ? 'bg-violet-600/20 text-violet-300'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-gray-700">v1.0.0</div>
    </aside>
  );
}
