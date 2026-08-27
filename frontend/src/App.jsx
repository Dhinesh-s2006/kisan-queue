import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Register from './pages/Register';
import BookSlot from './pages/BookSlot';
import MyStatus from './pages/MyStatus';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: 16, background: '#2e7d32', color: 'white' }}>
        <b>Kisan Queue</b>
        <Link to="/" style={{ marginLeft: 20, color: 'white' }}>Register</Link>
        <Link to="/book" style={{ marginLeft: 20, color: 'white' }}>Book Slot</Link>
        <Link to="/status" style={{ marginLeft: 20, color: 'white' }}>My Status</Link>
      </nav>
      <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/book" element={<BookSlot />} />
          <Route path="/status" element={<MyStatus />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}