import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchPage from './pages/SearchPage';
import AboutPage from './pages/AboutPage';
import FaqPage from './pages/FaqPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/buy" element={<SearchPage />} />
      </Routes>
    </Router>
  );
}

export default App;
