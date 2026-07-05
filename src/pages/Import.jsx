import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { parseImportFile, importBooks, exportCSV } from '../lib/csv'
import { c } from '../lib/theme'

const SHELF_LABEL = {
  'read': 'Read',
  'currently-reading': 'Currently Reading',
  'want-to-read': 'Want to Read',
}

export default function Import() {
  const fileRef = useRef(null)
  const [step, setStep] = useState('idle') // idle | preview | importing | done
  const [rows, setRows] = useState([])
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' })
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) { setError('Please select a .csv file.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseImportFile(ev.target.result)
      if (!parsed.length) { setError('No books found in this file. Make sure it\'s a valid Goodreads or Readgoods CSV.'); return }
      setRows(parsed)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  async function startImport() {
    setStep('importing')
    setProgress({ current: 0, total: rows.length, status: 'Starting…' })
    const res = await importBooks(rows, (current, total, status) => {
      setProgress({ current, total, status })
    })
    setResults(res)
    setStep('done')
  }

  const shelfCounts = rows.reduce((acc, r) => {
    acc[r.shelf] = (acc[r.shelf] || 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <Link to="/library" className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: c.textSecondary }}>
        <ArrowLeft size={14} /> Library
      </Link>

      <h1 style={{ fontFamily: '"Lora", serif', fontWeight: 700, color: c.textPrimary, fontSize: '2rem', marginBottom: 6 }}>
        Import & Export
      </h1>
      <p style={{ color: c.textSecondary, fontSize: '0.95rem', marginBottom: 32 }}>
        Import from Goodreads or export your library as a CSV file.
      </p>

      {/* Export card */}
      <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
        <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1.05rem', marginBottom: 6 }}>
          Export your library
        </h2>
        <p style={{ color: c.textSecondary, fontSize: '0.85rem', marginBottom: 16 }}>
          Download all your shelved books as a CSV file.
        </p>
        <button
          onClick={async () => {
            const ok = await exportCSV()
            if (!ok) alert('Your library is empty — nothing to export.')
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, border: 'none', cursor: 'pointer' }}
        >
          <Download size={15} /> Download CSV
        </button>
      </div>

      {/* Import card */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: c.surface, border: `1px solid ${c.border}` }}>
        <h2 style={{ fontFamily: '"Lora", serif', fontWeight: 600, color: c.textPrimary, fontSize: '1.05rem', marginBottom: 6 }}>
          Import from CSV
        </h2>
        <p style={{ color: c.textSecondary, fontSize: '0.85rem', marginBottom: 16 }}>
          Supports Goodreads exports and Readgoods CSV files. Each book will be looked up on Google Books — this may take a few minutes for large libraries.
        </p>

        {step === 'idle' && (
          <>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: c.surface2, color: c.textPrimary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
            >
              <Upload size={15} /> Choose CSV file
            </button>
            {error && <p className="mt-3 text-sm" style={{ color: '#e55' }}>{error}</p>}
            <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${c.border}` }}>
              <p style={{ fontSize: '0.78rem', color: c.textMuted, marginBottom: 8 }}>How to export from Goodreads:</p>
              <ol style={{ fontSize: '0.78rem', color: c.textMuted, paddingLeft: 16, lineHeight: 1.8 }}>
                <li>Go to goodreads.com → My Books</li>
                <li>Click "Import and Export" in the left sidebar</li>
                <li>Click "Export Library" and download the CSV</li>
                <li>Upload that file here</li>
              </ol>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: c.surface2 }}>
              <p className="text-sm font-medium mb-3" style={{ color: c.textPrimary }}>
                Found <strong>{rows.length}</strong> book{rows.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(shelfCounts).map(([shelf, count]) => (
                  <span key={shelf} className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: c.accentBg, color: c.accentText }}>
                    {count} → {SHELF_LABEL[shelf] || shelf}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="rounded-xl overflow-hidden mb-5" style={{ border: `1px solid ${c.border}` }}>
              <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: c.surface2 }}>
                      <th className="text-left px-3 py-2" style={{ color: c.textMuted, fontWeight: 500 }}>Title</th>
                      <th className="text-left px-3 py-2" style={{ color: c.textMuted, fontWeight: 500 }}>Author</th>
                      <th className="text-left px-3 py-2" style={{ color: c.textMuted, fontWeight: 500 }}>Shelf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${c.border}` }}>
                        <td className="px-3 py-2" style={{ color: c.textPrimary, maxWidth: 220 }}>
                          <span className="line-clamp-1">{row.title}</span>
                        </td>
                        <td className="px-3 py-2" style={{ color: c.textSecondary }}>{row.author}</td>
                        <td className="px-3 py-2" style={{ color: c.textMuted }}>{SHELF_LABEL[row.shelf]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 && (
                <div className="px-3 py-2 text-xs" style={{ color: c.textMuted, borderTop: `1px solid ${c.border}` }}>
                  Showing first 100 of {rows.length} books
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={startImport}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText, border: 'none', cursor: 'pointer' }}
              >
                Import {rows.length} books
              </button>
              <button
                onClick={() => { setStep('idle'); setRows([]) }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'transparent', color: c.textSecondary, border: `1px solid ${c.border}`, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === 'importing' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Loader2 size={18} className="animate-spin" style={{ color: c.accentText }} />
              <span style={{ color: c.textPrimary, fontSize: '0.9rem' }}>
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="rounded-full overflow-hidden mb-3" style={{ height: 6, backgroundColor: c.surface2 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%`, backgroundColor: c.accent }}
              />
            </div>
            <p className="text-xs" style={{ color: c.textMuted }}>{progress.status}</p>
          </div>
        )}

        {step === 'done' && results && (
          <div>
            <div className="flex flex-col gap-3 mb-5">
              <div className="flex items-center gap-3">
                <CheckCircle size={18} style={{ color: '#5cb87a' }} />
                <span style={{ color: c.textPrimary, fontSize: '0.9rem' }}>
                  <strong>{results.imported}</strong> book{results.imported !== 1 ? 's' : ''} imported
                </span>
              </div>
              {results.failed > 0 && (
                <div className="flex items-center gap-3">
                  <XCircle size={18} style={{ color: '#e55' }} />
                  <span style={{ color: c.textSecondary, fontSize: '0.9rem' }}>
                    <strong>{results.failed}</strong> couldn't be found on Google Books
                  </span>
                </div>
              )}
            </div>
            <Link
              to="/library"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium"
              style={{ backgroundColor: c.btnPrimary, color: c.btnPrimaryText }}
            >
              View my library
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
