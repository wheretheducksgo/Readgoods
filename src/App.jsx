import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Search from './pages/Search'
import Book from './pages/Book'
import Connections from './pages/Connections'
import Shelf from './pages/Shelf'
import BookNotes from './pages/BookNotes'
import Library from './pages/Library'
import YearInReview from './pages/YearInReview'
import LibraryGraph from './pages/LibraryGraph'
import BookClub from './pages/BookClub'
import Auth from './pages/Auth'
import Import from './pages/Import'
import Analytics from './pages/Analytics'
import Community from './pages/Community'

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <p style={{ fontFamily: '"Lora", serif', fontSize: '4rem', fontWeight: 700, color: 'var(--color-text-muted, #666)', lineHeight: 1 }}>404</p>
      <p style={{ fontFamily: '"Lora", serif', fontSize: '1.2rem', color: 'var(--color-text-secondary, #aaa)', marginTop: 12, marginBottom: 24 }}>Page not found</p>
      <Link to="/" style={{ fontSize: '0.9rem', color: 'var(--color-accent-text, #7ba7bc)', textDecoration: 'underline' }}>Go home</Link>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/book/:id" element={<Book />} />
          <Route path="/connections/:id" element={<Connections />} />
          <Route path="/shelf/:id" element={<Shelf />} />
          <Route path="/notes/:id" element={<BookNotes />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/graph" element={<LibraryGraph />} />
          <Route path="/year-in-review" element={<YearInReview />} />
          <Route path="/year-in-review/:year" element={<YearInReview />} />
          <Route path="/club/new" element={<BookClub />} />
          <Route path="/club/:id" element={<BookClub />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/import" element={<Import />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/community" element={<Community />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
    </AuthProvider>
  )
}
