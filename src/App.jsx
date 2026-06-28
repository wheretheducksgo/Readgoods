import { BrowserRouter, Routes, Route } from 'react-router-dom'
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

export default function App() {
  return (
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
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
