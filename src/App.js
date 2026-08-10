import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import RequireRole from './components/RequireRole';
import Home from './pages/Home';
import Dataset from './pages/Dataset';
import Tools from './pages/Tools';
import About from './pages/About';
import VideoDetail from './pages/VideoDetail';
import Query from './pages/Query';
import Admin from './pages/Admin';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dataset" element={<Dataset />} />
          <Route path="/dataset/:videoId" element={<VideoDetail />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/about" element={<About />} />

          {/* internal, role-gated */}
          <Route
            path="/query"
            element={
              <RequireRole roles={['admin', 'developer']}>
                <Query />
              </RequireRole>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireRole roles={['admin']}>
                <Admin />
              </RequireRole>
            }
          />
        </Routes>
        {/* <Footer /> */}
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;