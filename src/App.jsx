import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
        </Routes>
      </Layout>
    </BrowserRouter>
    </AuthProvider>
  )
}
