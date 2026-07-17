import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { getShelves } from '../lib/shelves'
import { c } from '../lib/theme'

const EDGE_AUTHOR = '#5b9fd4'  // steel blue — same author
const EDGE_GENRE  = '#c4913a'  // amber — same genre

const W = 900, H = 600
const REPEL = 4000
const ATTRACT = 0.012
const DAMPING = 0.82
const MIN_DIST = 60

// Normalize author names so minor formatting differences don't break matching
function normAuthor(name) {
  return name.toLowerCase()
    .replace(/\s*(jr\.?|sr\.?|i{2,4}|iv|vi{0,3}|viii)\.?\s*$/i, '')
    .replace(/\.\s*/g, '').replace(/\s+/g, ' ').trim()
}

function buildGraph(books) {
  const nodes = books.map(b => ({
    id: b.id,
    title: b.title,
    cover: b.cover,
    authors: b.authors || [],
    authorsNorm: (b.authors || []).map(normAuthor),
    categories: b.categories || [],
    x: W / 2 + (Math.random() - 0.5) * 400,
    y: H / 2 + (Math.random() - 0.5) * 300,
    vx: 0, vy: 0,
  }))

  const edges = []
  const seen = new Set()

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const key = `${a.id}-${b.id}`
      if (seen.has(key)) continue

      const matchedAuthorNorm = a.authorsNorm.find(au => b.authorsNorm.includes(au))
      const sharedAuthor = !!matchedAuthorNorm
      // Only fall back to genre if no author match
      const sharedGenre = !sharedAuthor && a.categories.some(g => b.categories.includes(g))

      if (sharedAuthor || sharedGenre) {
        seen.add(key)
        const authorLabel = sharedAuthor
          ? a.authors[a.authorsNorm.indexOf(matchedAuthorNorm)]
          : null
        edges.push({
          source: i, target: j,
          strength: sharedAuthor ? 0.08 : 0.03,
          type: sharedAuthor ? 'author' : 'genre',
          label: authorLabel ?? a.categories.find(g => b.categories.includes(g)),
        })
      }
    }
  }
  return { nodes, edges }
}

function simulate(nodes, edges) {
  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = REPEL / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      nodes[i].vx -= fx; nodes[i].vy -= fy
      nodes[j].vx += fx; nodes[j].vy += fy
    }
  }

  // Attraction along edges
  for (const e of edges) {
    const a = nodes[e.source], b = nodes[e.target]
    const dx = b.x - a.x, dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const target = Math.max(dist - MIN_DIST, 0)
    const f = target * e.strength
    const fx = (dx / dist) * f, fy = (dy / dist) * f
    a.vx += fx; a.vy += fy
    b.vx -= fx; b.vy -= fy
  }

  // Center gravity
  for (const n of nodes) {
    n.vx += (W / 2 - n.x) * ATTRACT
    n.vy += (H / 2 - n.y) * ATTRACT
    n.vx *= DAMPING; n.vy *= DAMPING
    n.x += n.vx; n.y += n.vy
    n.x = Math.max(30, Math.min(W - 30, n.x))
    n.y = Math.max(30, Math.min(H - 30, n.y))
  }
}

const COVER = 36 // node cover size

export default function LibraryGraph() {
  const [graph, setGraph] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [tick, setTick] = useState(0)
  const rafRef = useRef(null)
  const iterRef = useRef(0)
  const graphRef = useRef(null)

  useEffect(() => {
    getShelves().then(shelves => {
    const books = Object.values(shelves).flat()
    if (!books.length) { setGraph({ nodes: [], edges: [] }); return }
    const g = buildGraph(books)
    graphRef.current = g
    setGraph({ ...g })

    let running = true
    function loop() {
      if (!running) return
      iterRef.current++
      simulate(graphRef.current.nodes, graphRef.current.edges)
      if (iterRef.current % 3 === 0) setTick(t => t + 1)
      if (iterRef.current < 300) rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
    }) // end getShelves().then
  }, [])

  // Drag support
  const dragging = useRef(null)

  const onMouseDown = useCallback((e, idx) => {
    e.preventDefault()
    dragging.current = idx
  }, [])

  useEffect(() => {
    function onMove(e) {
      if (dragging.current === null || !graphRef.current) return
      const svg = document.getElementById('lib-graph-svg')
      const rect = svg.getBoundingClientRect()
      const scaleX = W / rect.width
      const scaleY = H / rect.height
      const x = (e.clientX - rect.left) * scaleX
      const y = (e.clientY - rect.top) * scaleY
      const n = graphRef.current.nodes[dragging.current]
      n.x = x; n.y = y; n.vx = 0; n.vy = 0
      setTick(t => t + 1)
    }
    function onUp() { dragging.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const nodes = graphRef.current?.nodes || []
  const edges = graphRef.current?.edges || []
  const hoveredNode = hovered !== null ? nodes[hovered] : null

  const totalBooks = graph ? graph.nodes.length : 0

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link to="/library" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Library
      </Link>

      <div className="mb-6">
        <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1.8rem', marginBottom: 4 }}>
          Library Connections
        </h1>
        <p style={{ color: c.textSecondary, fontSize: '0.9rem' }}>
          Books connected by shared authors <span style={{ color: EDGE_AUTHOR }}>━</span> or genres <span style={{ color: EDGE_GENRE }}>━</span>. Drag to rearrange.
        </p>
      </div>

      {nodes.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: c.surface, border: `1px dashed ${c.border}` }}>
          <p style={{ color: c.textSecondary, fontFamily: '"Lora", serif' }}>Add books to your library to see connections.</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.border}`, backgroundColor: '#0a0f1a', position: 'relative' }}>
          <svg
            id="lib-graph-svg"
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', display: 'block', cursor: 'grab' }}
          >
            <defs>
              {nodes.map((n, i) => (
                <clipPath key={n.id} id={`clip-lg-${i}`}>
                  <rect x={-COVER / 2} y={-COVER / 2} width={COVER} height={COVER} rx={4} />
                </clipPath>
              ))}
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const a = nodes[e.source], b = nodes[e.target]
              const isHov = hovered === e.source || hovered === e.target
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={e.type === 'author' ? EDGE_AUTHOR : EDGE_GENRE}
                  strokeWidth={isHov ? 2 : 1}
                  strokeOpacity={isHov ? 0.9 : 0.4}
                />
              )
            })}

            {/* Nodes */}
            {nodes.map((n, i) => {
              const isHov = hovered === i
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x},${n.y})`}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={ev => onMouseDown(ev, i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Shadow ring on hover */}
                  {isHov && (
                    <rect
                      x={-COVER / 2 - 3} y={-COVER / 2 - 3}
                      width={COVER + 6} height={COVER + 6}
                      rx={6} fill="none"
                      stroke={c.accentText} strokeWidth={2} strokeOpacity={0.7}
                    />
                  )}
                  <g clipPath={`url(#clip-lg-${i})`}>
                    <rect x={-COVER / 2} y={-COVER / 2} width={COVER} height={COVER} rx={4} fill={c.surface2} />
                    {n.cover && (
                      <image
                        href={n.cover}
                        x={-COVER / 2} y={-COVER / 2}
                        width={COVER} height={COVER}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                  </g>
                </g>
              )
            })}
          </svg>

          {/* Tooltip */}
          {hoveredNode && (
            <div
              className="absolute pointer-events-none rounded-xl px-4 py-3"
              style={{
                bottom: 16, left: '50%', transform: 'translateX(-50%)',
                backgroundColor: c.surface, border: `1px solid ${c.border}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)', maxWidth: 300,
              }}
            >
              <p style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '0.88rem' }}>
                {hoveredNode.title}
              </p>
              {hoveredNode.authors[0] && (
                <p style={{ color: c.textSecondary, fontSize: '0.75rem', marginTop: 2 }}>
                  {hoveredNode.authors[0]}
                </p>
              )}
              {/* Connected edges */}
              {edges
                .filter(e => e.source === hovered || e.target === hovered)
                .slice(0, 3)
                .map((e, i) => {
                  const other = nodes[e.source === hovered ? e.target : e.source]
                  return (
                    <p key={i} style={{ fontSize: '0.7rem', color: c.textMuted, marginTop: 3 }}>
                      {e.type === 'author' ? '✍️' : '📚'} {e.label} · {other.title}
                    </p>
                  )
                })
              }
              <p style={{ fontSize: '0.65rem', color: c.textMuted, marginTop: 6 }}>Click to open book</p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-6 mt-4 justify-center text-xs" style={{ color: c.textMuted }}>
        <span className="flex items-center gap-2">
          <span style={{ display: 'inline-block', width: 24, height: 2, backgroundColor: EDGE_AUTHOR, borderRadius: 1 }} />
          Same author
        </span>
        <span className="flex items-center gap-2">
          <span style={{ display: 'inline-block', width: 24, height: 2, backgroundColor: EDGE_GENRE, borderRadius: 1 }} />
          Same genre
        </span>
      </div>
    </div>
  )
}
