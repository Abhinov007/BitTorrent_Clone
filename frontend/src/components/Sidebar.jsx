const NAV = [
  { id: 'search',      label: 'Search',      icon: '🔍' },
  { id: 'downloading', label: 'Downloading',  icon: '⬇️' },
  { id: 'completed',   label: 'Completed',    icon: '✓' },
  { id: 'active',      label: 'Active',       icon: '⚡' },
  { id: 'inactive',    label: 'Inactive',     icon: '⏸' },
];

const DETAILS = [
  { id: 'general',  label: 'General',  icon: '◻' },
  { id: 'trackers', label: 'Trackers', icon: '↻' },
  { id: 'files',    label: 'Files',    icon: '📁' },
  { id: 'peers',    label: 'Peers',    icon: '👥' },
  { id: 'speed',    label: 'Speed',    icon: '📶' },
];

function NavItem({ item, active, onClick }) {
  return (
    <button
      onClick={() => onClick(item.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 12px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
        transition: 'all 0.15s',
        background: active ? '#6d28d9' : 'transparent',
        color: active ? '#ffffff' : '#6b7280',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#ede9fe'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ width: 16, textAlign: 'center', fontSize: 12 }}>{item.icon}</span>
      {item.label}
    </button>
  );
}

export default function Sidebar({ activeNav, onNav, activeView }) {
  // Support both old activeNav prop and new unified activeView prop
  const current = activeView ?? activeNav;
  return (
    <aside style={{
      width: 200,
      minWidth: 200,
      background: '#f5f3ff',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid #ede9fe',
    }}>

      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #ede9fe' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: 'white',
          }}>
            🧲
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>BitClient</div>
            <div style={{ fontSize: 10, color: '#9ca3af' }}>v1.0.0</div>
          </div>
        </div>
      </div>

      {/* Torrents section */}
      <div style={{ padding: '16px 12px 8px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', padding: '0 8px 8px', textTransform: 'uppercase' }}>
          Torrents
        </div>
        {NAV.map(item => (
          <NavItem key={item.id} item={item} active={current === item.id} onClick={onNav} />
        ))}
      </div>

      {/* Details section */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid #ede9fe', marginTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', padding: '8px 8px 8px', textTransform: 'uppercase' }}>
          Details
        </div>
        {DETAILS.map(item => (
          <NavItem key={item.id} item={item} active={current === item.id} onClick={onNav} />
        ))}
      </div>

      {/* Bandwidth footer */}
      <div style={{ marginTop: 'auto', padding: '12px 20px', borderTop: '1px solid #ede9fe', background: '#f5f3ff' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
          Bandwidth
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
          <span>⬇ 0 KB/s</span>
          <span>⬆ 0 KB/s</span>
        </div>
      </div>

    </aside>
  );
}
