import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Dataset from './pages/Dataset';
import Tools from './pages/Tools';
import About from './pages/About';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dataset" element={<Dataset />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/about" element={<About />} />
      </Routes>
      {/* <Footer /> */}
    </BrowserRouter>
  );
}

export default App;