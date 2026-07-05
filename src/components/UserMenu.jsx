import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { c } from '../lib/theme'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)

  if (!user) {
    return (
      <Link
        to="/auth"
        className="px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText }}
      >
        Sign in
      </Link>
    )
  }

  const initial = (user.email?.[0] || '?').toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: c.accent, color: '#fff', cursor: 'pointer', border: 'none' }}
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 z-50 rounded-xl overflow-hidden py-1 w-52"
            style={{ backgroundColor: c.surface, border: `1px solid ${c.border}`, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
          >
            <div className="px-4 py-2.5" style={{ borderBottom: `1px solid ${c.border}` }}>
              <div className="flex items-center gap-2 mb-0.5">
                <User size={12} style={{ color: c.textMuted }} />
                <span style={{ fontSize: '0.72rem', color: c.textMuted, letterSpacing: '0.04em' }}>Signed in as</span>
              </div>
              <p className="text-xs font-medium truncate" style={{ color: c.textPrimary }}>{user.email}</p>
            </div>
            <button
              onClick={async () => { setOpen(false); await signOut(); window.location.href = '/' }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left"
              style={{ color: c.textSecondary, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
