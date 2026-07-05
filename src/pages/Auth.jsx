import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { c } from '../lib/theme'

export default function Auth() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    if (mode === 'signin') {
      const err = await signInWithEmail(email, password)
      if (err) setError(err.message)
      else navigate('/')
    } else {
      const err = await signUpWithEmail(email, password)
      if (err) setError(err.message)
      else setMessage('Check your email for a confirmation link.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: c.bg }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <BookOpen size={22} style={{ color: c.accentText }} />
          <span style={{ fontFamily: '"Lora", serif', fontWeight: 700, fontSize: '1.3rem', color: c.textPrimary }}>
            Readgoods
          </span>
        </Link>

        <div className="rounded-2xl p-8" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
          <h1 style={{ fontFamily: '"Lora", serif', fontSize: '1.3rem', fontWeight: 700, color: c.textPrimary, marginBottom: 6 }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ color: c.textSecondary, fontSize: '0.85rem', marginBottom: 24 }}>
            {mode === 'signin' ? 'Sign in to access your library across devices.' : 'Your reading data syncs across all your devices.'}
          </p>

          {/* Google */}
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg text-sm font-medium mb-4"
            style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ backgroundColor: c.border }} />
            <span style={{ fontSize: '0.75rem', color: c.textMuted }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: c.border }} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
              style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}` }}
            />

            {error && <p style={{ color: '#e55', fontSize: '0.83rem' }}>{error}</p>}
            {message && <p style={{ color: '#5cb87a', fontSize: '0.83rem' }}>{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium mt-1"
              style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: c.textSecondary }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}
              style={{ color: c.accentText, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: c.textMuted }}>
          Your data is stored securely. No tracking, no ads.
        </p>
      </div>
    </div>
  )
}
