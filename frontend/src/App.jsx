import React, { useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchPage from './pages/SearchPage';
import AboutPage from './pages/AboutPage';
import FaqPage from './pages/FaqPage';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage';
import ProtectedRoute from './components/ProtectedRoute';

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
};

function App() {
  return (
        <Router>
            <ScrollToTop />
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route
                    path="/account"
                    element={(
                        <ProtectedRoute>
                            <AccountPage />
                        </ProtectedRoute>
                    )}
                />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/buy" element={<SearchPage />} />
            </Routes>
        </Router>
  );
}

export default App;
