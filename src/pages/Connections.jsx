import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { getVolume, searchBooks } from '../lib/googleBooks'
import { c } from '../lib/theme'

const PROXY = ''

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchSeriesInfo(title, author) {
  try {
    const p = new URLSearchParams({ title, author: author || '' })
    const r = await fetch(`${PROXY}/api/series?${p}`)
    return r.ok ? r.json() : { found: false }
  } catch { return { found: false } }
}

// Extract book number from a Google Books title string
function parseBookNumber(title = '') {
  const WORDS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 }
  const m =
    title.match(/book\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)/i) ||
    title.match(/#\s*(\d+)/i) ||
    title.match(/vol(?:ume)?\s*\.?\s*(\d+)/i) ||
    title.match(/part\s+(\d+)/i)
  if (!m) return null
  const v = m[1].toLowerCase()
  return WORDS[v] ?? parseInt(v)
}

// Fetch series books from OL (complete, ordered by publication year).
// Returns OL-sourced entries: { title, year, position, cover, olKey, id: null }
async function fetchSeriesBooksOL(seriesName) {
  if (!seriesName) return []
  try {
    const p = new URLSearchParams({ seriesName })
    const r = await fetch(`${PROXY}/api/series/books?${p}`)
    if (!r.ok) return []
    return await r.json()
  } catch { return [] }
}

// Resolve a title to a Google Books ID for navigation (best-effort, may return null)
async function resolveGoogleBooksId(title, author) {
  try {
    const q = `intitle:"${title}" inauthor:"${author}"`
    const { books } = await searchBooks(q, { maxResults: 5 })
    return books[0]?.id || null
  } catch { return null }
}

// Fallback connection types for standalone books
async function fetchThematicBooks(book) {
  const cats = book.categories || []
  const desc = book.description || ''
  const themes = [
    ...cats.slice(0, 2),
    ...(desc.match(/\b(war|love|grief|identity|survival|memory|belonging|exile|revolution|power|friendship|family|loss|redemption)\b/gi) || [])
      .map(t => t.toLowerCase()).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2),
  ]
  if (!themes.length) return []
  const q = themes.slice(0, 2).map(t => `subject:"${t}"`).join('+')
  const { books } = await searchBooks(q, { maxResults: 12 })
  return books.filter(b => b.id !== book.id).slice(0, 6)
}

async function fetchAuthorBooks(book) {
  const author = book.authors?.[0]
  if (!author) return []
  const { books } = await searchBooks(`inauthor:"${author}"`, { maxResults: 20 })
  return books.filter(b => b.id !== book.id).slice(0, 6)
}

// ── Series chain layout (SVG) ─────────────────────────────────────────────────

const NODE_W = 72
const NODE_H = 108
const NODE_GAP = 70      // horizontal gap between nodes
const CHAIN_Y = 180      // vertical center of chain
const CORNER = 6

const SERIES_COLOR = '#4e8fc8'
const THEMATIC_COLOR = '#7e9bbf'
const AUTHOR_COLOR = '#7fad8a'

function SeriesNode({ book, x, isCurrent, onClick, hovered, onHover }) {
  const scale = isCurrent ? 1.15 : 1
  const sw = NODE_W * scale
  const sh = NODE_H * scale
  const shw = sw / 2
  const shh = sh / 2
  // Stable unique key that works for both GB books (id) and OL-only books (olKey)
  const nodeKey = book.id || book.olKey || book.title

  return (
    <g
      transform={`translate(${x}, ${CHAIN_Y})`}
      style={{ cursor: isCurrent ? 'default' : 'pointer' }}
      onClick={() => !isCurrent && onClick(book.id, book.title, book.authors?.[0])}
      onMouseEnter={() => !isCurrent && onHover(nodeKey)}
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <clipPath id={`sc-${nodeKey}`}>
          <rect x={-shw} y={-shh} width={sw} height={sh} rx={CORNER + (isCurrent ? 2 : 0)} />
        </clipPath>
        {isCurrent && (
          <filter id="current-glow">
            <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={SERIES_COLOR} floodOpacity="0.5" />
          </filter>
        )}
      </defs>

      {/* glow ring for current */}
      {isCurrent && (
        <rect
          x={-shw - 3} y={-shh - 3} width={sw + 6} height={sh + 6}
          rx={CORNER + 4} fill="none"
          stroke={SERIES_COLOR} strokeWidth={2.5}
          filter="url(#current-glow)"
        />
      )}

      {/* shadow */}
      <rect x={-shw + 3} y={-shh + 3} width={sw} height={sh} rx={CORNER} fill="rgba(0,0,0,0.3)" />

      {/* bg */}
      <rect
        x={-shw} y={-shh} width={sw} height={sh} rx={CORNER}
        fill={c.surface2}
        stroke={hovered === nodeKey ? SERIES_COLOR : (isCurrent ? SERIES_COLOR : c.border)}
        strokeWidth={isCurrent ? 2 : 1}
      />

      {book.cover && (
        <image
          href={book.cover} x={-shw} y={-shh} width={sw} height={sh}
          clipPath={`url(#sc-${nodeKey})`}
          preserveAspectRatio="xMidYMid slice"
        />
      )}

      {/* dim on hover */}
      {hovered === nodeKey && (
        <rect x={-shw} y={-shh} width={sw} height={sh} rx={CORNER} fill="rgba(0,0,0,0.3)" />
      )}

      {/* Book number badge */}
      {book.seriesNumber != null && (
        <g>
          <rect
            x={-shw} y={shh - 22} width={sw} height={22}
            fill={isCurrent ? SERIES_COLOR : 'rgba(0,0,0,0.65)'}
            rx={`0 0 ${CORNER} ${CORNER}`}
          />
          <text
            textAnchor="middle" y={shh - 8}
            fontSize={isCurrent ? 11 : 10} fontWeight="700"
            fill={isCurrent ? '#fff' : c.textPrimary}
            fontFamily='"Inter", system-ui'
            style={{ userSelect: 'none' }}
          >
            {isCurrent ? `★  Book ${book.seriesNumber}` : `Book ${book.seriesNumber}`}
          </text>
        </g>
      )}

      {/* permanent title label below the node */}
      <text
        textAnchor="middle" y={shh + 14}
        fontSize={9} fill={c.textSecondary}
        fontFamily='"Inter", system-ui'
        style={{ userSelect: 'none' }}
      >
        {book.title && book.title.length > 18 ? book.title.slice(0, 16) + '…' : book.title}
      </text>
    </g>
  )
}

function SeriesEdge({ x1, x2, label }) {
  const mx = (x1 + x2) / 2
  return (
    <g>
      <line
        x1={x1 + NODE_W / 2 + 4} y1={CHAIN_Y}
        x2={x2 - NODE_W / 2 - 4} y2={CHAIN_Y}
        stroke={SERIES_COLOR} strokeWidth={1.5} strokeOpacity={0.5}
      />
      {/* arrow */}
      <polygon
        points={`${x2 - NODE_W / 2 - 2},${CHAIN_Y - 5} ${x2 - NODE_W / 2 + 7},${CHAIN_Y} ${x2 - NODE_W / 2 - 2},${CHAIN_Y + 5}`}
        fill={SERIES_COLOR} opacity={0.5}
      />
      {/* label */}
      <rect x={mx - 26} y={CHAIN_Y - 20} width={52} height={14} rx={4}
        fill={c.surface} stroke={SERIES_COLOR} strokeWidth={0.7} opacity={0.85} />
      <text
        x={mx} y={CHAIN_Y - 10}
        textAnchor="middle" fontSize={7.5}
        fill={SERIES_COLOR} fontFamily='"Inter", system-ui'
        style={{ userSelect: 'none' }}
      >
        {label}
      </text>
    </g>
  )
}

function SeriesChain({ seriesBooks, currentId, onNodeClick }) {
  const [hovered, setHovered] = useState(null)

  // Cap display at 9 books — if more, show ±4 around current
  let display = seriesBooks
  const currentIdx = seriesBooks.findIndex(b => b.id === currentId)
  if (seriesBooks.length > 9 && currentIdx >= 0) {
    const start = Math.max(0, currentIdx - 4)
    display = seriesBooks.slice(start, start + 9)
  }

  const totalW = display.length * (NODE_W + NODE_GAP) - NODE_GAP
  const W = Math.max(totalW + 200, 760)
  const H = 340

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <pattern id="sdots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill={c.border} opacity="0.4" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#sdots)" />

      {/* connecting edges */}
      {display.map((book, i) => {
        if (i === 0) return null
        const prev = display[i - 1]
        const x1 = (W - totalW) / 2 + (i - 1) * (NODE_W + NODE_GAP) + NODE_W / 2
        const x2 = (W - totalW) / 2 + i * (NODE_W + NODE_GAP) + NODE_W / 2
        const label = `Book ${prev.seriesNumber} → ${book.seriesNumber}`
        return <SeriesEdge key={i} x1={x1} x2={x2} label={label} />
      })}

      {/* nodes */}
      {display.map((book, i) => {
        const x = (W - totalW) / 2 + i * (NODE_W + NODE_GAP) + NODE_W / 2
        return (
          <SeriesNode
            key={book.id}
            book={book}
            x={x}
            isCurrent={book.id === currentId}
            onClick={onNodeClick}
            hovered={hovered}
            onHover={setHovered}
          />
        )
      })}
    </svg>
  )
}

// ── Radial web for standalones ────────────────────────────────────────────────

const WEB_W = 900
const WEB_H = 560
const WEB_CX = WEB_W / 2
const WEB_CY = WEB_H / 2

const WEB_SECTORS = {
  author:   { startDeg: -150, endDeg: -30,  radius: 210 },
  thematic: { startDeg:  30,  endDeg: 150,  radius: 220 },
}
const WEB_COLORS = { author: AUTHOR_COLOR, thematic: THEMATIC_COLOR }
const WEB_LABELS = { author: 'same author', thematic: 'similar themes' }

function buildWebNodes(connections) {
  const placed = []
  for (const type of ['author', 'thematic']) {
    const group = connections.filter(n => n.type === type)
    if (!group.length) continue
    const { startDeg, endDeg, radius } = WEB_SECTORS[type]
    group.forEach((conn, i) => {
      const t = group.length === 1 ? 0.5 : i / (group.length - 1)
      const deg = startDeg + t * (endDeg - startDeg)
      const r = radius + (i % 2 === 1 ? 30 : 0)
      const rad = deg * Math.PI / 180
      placed.push({ ...conn, x: WEB_CX + r * Math.cos(rad), y: WEB_CY + r * Math.sin(rad) })
    })
  }
  return placed
}

const WN_W = 54, WN_H = 81, WN_CORNER = 5
const CN_W = 82, CN_H = 123

function WebNode({ node, onClick, hovered, onHover }) {
  const hw = WN_W / 2, hh = WN_H / 2
  const color = WEB_COLORS[node.type]
  return (
    <g transform={`translate(${node.x},${node.y})`}
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(node.book.id, node.book.title, node.book.authors?.[0])}
      onMouseEnter={() => onHover(node.book.id)}
      onMouseLeave={() => onHover(null)}>
      <defs>
        <clipPath id={`wc-${node.book.id}`}>
          <rect x={-hw} y={-hh} width={WN_W} height={WN_H} rx={WN_CORNER} />
        </clipPath>
      </defs>
      <rect x={-hw+2} y={-hh+2} width={WN_W} height={WN_H} rx={WN_CORNER} fill="rgba(0,0,0,0.3)" />
      <rect x={-hw} y={-hh} width={WN_W} height={WN_H} rx={WN_CORNER}
        fill={c.surface2}
        stroke={hovered === node.book.id ? color : c.border}
        strokeWidth={hovered === node.book.id ? 2 : 1} />
      {node.book.cover && (
        <image href={node.book.cover} x={-hw} y={-hh} width={WN_W} height={WN_H}
          clipPath={`url(#wc-${node.book.id})`} preserveAspectRatio="xMidYMid slice" />
      )}
      {hovered === node.book.id && (
        <>
          <rect x={-hw} y={-hh} width={WN_W} height={WN_H} rx={WN_CORNER} fill="rgba(0,0,0,0.3)" />
          <foreignObject x={-80} y={hh + 6} width={160} height={52}>
            <div style={{
              background: c.surface, border: `1px solid ${c.border}`,
              borderRadius: 6, padding: '4px 7px',
              fontSize: '0.7rem', color: c.textPrimary, textAlign: 'center', lineHeight: 1.3,
            }}>
              {node.book.title}
              {node.book.authors?.[0] && <div style={{ color: c.textSecondary, marginTop: 2 }}>{node.book.authors[0]}</div>}
            </div>
          </foreignObject>
        </>
      )}
    </g>
  )
}

function WebEdge({ toNode, hovered }) {
  const active = hovered === toNode.book.id
  const color = WEB_COLORS[toNode.type]
  const dx = toNode.x - WEB_CX, dy = toNode.y - WEB_CY
  const len = Math.hypot(dx, dy)
  const ux = dx / len, uy = dy / len
  const startPad = Math.max(Math.abs(ux) * (CN_W / 2), Math.abs(uy) * (CN_H / 2)) + 4
  const endPad = Math.max(Math.abs(ux) * (WN_W / 2), Math.abs(uy) * (WN_H / 2)) + 4
  const x1 = WEB_CX + ux * startPad, y1 = WEB_CY + uy * startPad
  const x2 = toNode.x - ux * endPad, y2 = toNode.y - uy * endPad
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  let angle = Math.atan2(dy, dx) * 180 / Math.PI
  if (angle > 90 || angle < -90) angle += 180

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={active ? 1.8 : 1}
        strokeOpacity={active ? 0.9 : 0.4} strokeDasharray={active ? 'none' : '4 3'} />
      <g transform={`translate(${mx},${my}) rotate(${angle})`}>
        <rect x={-28} y={-8} width={56} height={16} rx={4}
          fill={c.surface} stroke={color} strokeWidth={0.8} opacity={active ? 1 : 0.75} />
        <text textAnchor="middle" dominantBaseline="middle"
          fontSize={7.5} fill={color} fontFamily='"Inter", system-ui'
          fontWeight={active ? '600' : '400'} style={{ userSelect: 'none' }}>
          {WEB_LABELS[toNode.type]}
        </text>
      </g>
    </g>
  )
}

function WebCenterNode({ book }) {
  const hw = CN_W / 2, hh = CN_H / 2
  return (
    <g transform={`translate(${WEB_CX},${WEB_CY})`}>
      <defs>
        <clipPath id="wcc">
          <rect x={-hw} y={-hh} width={CN_W} height={CN_H} rx={CORNER + 2} />
        </clipPath>
        <filter id="wcglow">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={c.accent} floodOpacity="0.4" />
        </filter>
      </defs>
      <rect x={-hw-2} y={-hh-2} width={CN_W+4} height={CN_H+4} rx={CORNER+3}
        fill="none" stroke={c.accent} strokeWidth={2} filter="url(#wcglow)" />
      <rect x={-hw} y={-hh} width={CN_W} height={CN_H} rx={CORNER+2} fill={c.surface2} />
      {book.cover && (
        <image href={book.cover} x={-hw} y={-hh} width={CN_W} height={CN_H}
          clipPath="url(#wcc)" preserveAspectRatio="xMidYMid slice" />
      )}
    </g>
  )
}

function StandaloneWeb({ book, authorBooks, thematicBooks, onNodeClick }) {
  const [hovered, setHovered] = useState(null)

  const connections = [
    ...authorBooks.map(b => ({ book: b, type: 'author' })),
    ...thematicBooks.map(b => ({ book: b, type: 'thematic' })),
  ]
  const nodes = buildWebNodes(connections)

  return (
    <svg viewBox={`0 0 ${WEB_W} ${WEB_H}`} style={{ width: '100%', display: 'block' }}>
      <defs>
        <pattern id="wdots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill={c.border} opacity="0.4" />
        </pattern>
      </defs>
      <rect width={WEB_W} height={WEB_H} fill="url(#wdots)" />
      {nodes.map((n, i) => <WebEdge key={i} toNode={n} hovered={hovered} />)}
      {nodes.map((n, i) => (
        <WebNode key={i} node={n} onClick={onNodeClick} hovered={hovered} onHover={setHovered} />
      ))}
      <WebCenterNode book={book} />
      <text x={WEB_CX} y={WEB_CY + CN_H / 2 + 16}
        textAnchor="middle" fontSize={10} fill={c.accentText}
        fontFamily='"Lora", serif' fontWeight="600" style={{ userSelect: 'none' }}>
        {book.title.length > 28 ? book.title.slice(0, 26) + '…' : book.title}
      </text>
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Connections() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState(null)
  const [seriesInfo, setSeriesInfo] = useState(null)   // { seriesName, position } | null
  const [seriesBooks, setSeriesBooks] = useState([])
  const [authorBooks, setAuthorBooks] = useState([])
  const [thematicBooks, setThematicBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState('Loading book…')

  useEffect(() => {
    setLoading(true)
    setSeriesInfo(null)
    setSeriesBooks([])
    setAuthorBooks([])
    setThematicBooks([])

    getVolume(id).then(async b => {
      setBook(b)
      setPhase('Checking for series…')

      const author = b.authors?.[0] || ''
      const si = await fetchSeriesInfo(b.title, author)

      if (si?.found) {
        setSeriesInfo(si)
        setPhase(`Loading ${si.seriesName}…`)
        const olBooks = await fetchSeriesBooksOL(si.seriesName)

        // Build series book list from OL data, injecting the current book at its position
        const sBooks = olBooks.map(ob => {
          if (ob.position === si.position) {
            // Slot for the current book — use the already-loaded GB data (cover, id, etc.)
            return { ...b, seriesNumber: ob.position, olCover: ob.cover }
          }
          return { ...ob, seriesNumber: ob.position, id: null, authors: [author], cover: ob.cover }
        })

        // If current book wasn't in OL results (position didn't match), inject it
        if (!sBooks.some(sb => sb.id === id) && si.position) {
          const existing = sBooks.findIndex(sb => sb.seriesNumber === si.position)
          if (existing >= 0) sBooks[existing] = { ...b, seriesNumber: si.position }
          else { sBooks.push({ ...b, seriesNumber: si.position }); sBooks.sort((a, x) => a.seriesNumber - x.seriesNumber) }
        }

        setSeriesBooks(sBooks)
      } else {
        // Standalone: load thematic + author connections
        setPhase('Finding connections…')
        const [auth, thematic] = await Promise.allSettled([fetchAuthorBooks(b), fetchThematicBooks(b)])
        setAuthorBooks(auth.status === 'fulfilled' ? auth.value : [])
        setThematicBooks(thematic.status === 'fulfilled' ? thematic.value : [])
      }

      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const handleClick = useCallback(async (bookId, bookTitle, bookAuthor) => {
    if (bookId) {
      navigate(`/book/${bookId}`)
    } else if (bookTitle) {
      // OL-sourced book — resolve to a Google Books ID first
      const gbId = await resolveGoogleBooksId(bookTitle, bookAuthor || '')
      if (gbId) navigate(`/book/${gbId}`)
    }
  }, [navigate])

  if (loading && !book) {
    return (
      <div className="flex items-center justify-center py-32" style={{ color: c.textSecondary }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }
  if (!book) return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <p style={{ color: c.textSecondary }}>Couldn't load this book.</p>
    </div>
  )

  const isSeries = !loading && seriesInfo?.found

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link to={`/book/${id}`} className="inline-flex items-center gap-1.5 text-sm mb-6"
        style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Back to book
      </Link>

      <div className="mb-5">
        <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 700, fontSize: '1.5rem', color: c.textPrimary }}>
          {isSeries ? `${seriesInfo.seriesName} — Series` : 'Book Connections'}
        </h1>
        <p style={{ fontSize: '0.82rem', color: c.textSecondary, marginTop: 4 }}>
          {book.title}
          {isSeries && seriesInfo.position && (
            <span style={{ color: c.accentText }}> · Book {seriesInfo.position}</span>
          )}
          {' · '}click any book to open it
        </p>
      </div>

      <div className="rounded-2xl overflow-hidden relative"
        style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 z-10"
            style={{ color: c.textSecondary, background: 'rgba(22,28,45,0.75)' }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">{phase}</span>
          </div>
        )}

        {isSeries ? (
          <SeriesChain
            seriesBooks={seriesBooks}
            currentId={id}
            onNodeClick={handleClick}
          />
        ) : (
          <StandaloneWeb
            book={book}
            authorBooks={authorBooks}
            thematicBooks={thematicBooks}
            onNodeClick={handleClick}
          />
        )}

        {/* Legend */}
        <div className="flex items-center gap-6 px-5 py-3 flex-wrap"
          style={{ borderTop: `1px solid ${c.border}` }}>
          {isSeries ? (
            <>
              <div className="flex items-center gap-2">
                <svg width={32} height={10}>
                  <line x1={0} y1={5} x2={20} y2={5} stroke={SERIES_COLOR} strokeWidth={1.5} />
                  <polygon points="18,2 26,5 18,8" fill={SERIES_COLOR} />
                </svg>
                <span style={{ fontSize: '0.72rem', color: c.textSecondary }}>Series order</span>
              </div>
              <div className="flex items-center gap-2">
                <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${SERIES_COLOR}`, background: SERIES_COLOR }} />
                <span style={{ fontSize: '0.72rem', color: c.textSecondary }}>Current book (★)</span>
              </div>
              <span style={{ fontSize: '0.72rem', color: c.textMuted, marginLeft: 'auto' }}>
                {seriesBooks.length} book{seriesBooks.length !== 1 ? 's' : ''} in series
              </span>
            </>
          ) : (
            <>
              {[{ color: AUTHOR_COLOR, label: 'Same author' }, { color: THEMATIC_COLOR, label: 'Similar themes' }].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <svg width={24} height={10}>
                    <line x1={0} y1={5} x2={16} y2={5} stroke={color} strokeWidth={1.5} strokeDasharray="4 2" />
                    <rect x={16} y={1} width={8} height={8} rx={2} fill={c.surface} stroke={color} strokeWidth={0.8} />
                  </svg>
                  <span style={{ fontSize: '0.72rem', color: c.textSecondary }}>{label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
