import { Link, useLocation } from 'react-router-dom'
import { BookOpen, Search, Home, Library, Users } from 'lucide-react'
import { c } from '../lib/theme'

const nav = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/search', label: 'Discover', icon: Search },
  { to: '/club/new', label: 'Book Club', icon: Users },
]

export default function Layout({ children }) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: '"Inter", system-ui, sans-serif', backgroundColor: c.bg }}>
      <header style={{ backgroundColor: c.bg, borderBottom: `1px solid ${c.border}`, backdropFilter: 'blur(8px)' }} className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BookOpen size={18} style={{ color: c.accentText }} />
            <span style={{ fontFamily: '"Lora", Georgia, serif', fontWeight: 600, fontSize: '1.05rem', color: c.textPrimary }}>
              Readgoods
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map(({ to, label, icon: Icon }) => {
              const active = pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    color: active ? c.accentText : c.textSecondary,
                    backgroundColor: active ? c.accentBg : 'transparent',
                  }}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer style={{ borderTop: `1px solid ${c.border}`, color: c.textMuted }} className="text-center py-6 text-xs">
        Readgoods · Track books you love
      </footer>
    </div>
  )
}
