import React, { Suspense, lazy, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const OrderCertificatePage = lazy(() => import('./pages/OrderCertificatePage'));
const OwnedStarPage = lazy(() => import('./pages/OwnedStarPage'));
const RegistrationOwnershipPage = lazy(() => import('./pages/RegistrationOwnershipPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const StarWikiPage = lazy(() => import('./pages/StarWikiPage'));
const ClaimAccessPage = lazy(() => import('./pages/ClaimAccessPage'));
const ClaimStarPage = lazy(() => import('./pages/ClaimStarPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const CheckoutCompletePage = lazy(() => import('./pages/CheckoutCompletePage'));

const RouteFallback = () => (
    <div style={{ minHeight: '100vh', background: '#000' }} />
);

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
            <Suspense fallback={<RouteFallback />}>
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
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route
                        path="/account/orders/:transactionId"
                        element={(
                            <ProtectedRoute>
                                <OrderCertificatePage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route
                        path="/checkout/complete"
                        element={(
                            <ProtectedRoute>
                                <CheckoutCompletePage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route
                        path="/account/stars/:transactionId/:starSlug"
                        element={(
                            <ProtectedRoute>
                                <OwnedStarPage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route
                        path="/account/registrations/:registrationId"
                        element={(
                            <ProtectedRoute>
                                <RegistrationOwnershipPage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route path="/starwiki/:slug" element={<StarWikiPage />} />
                    <Route path="/claim" element={<ClaimAccessPage />} />
                    <Route path="/claim/:claimToken" element={<ClaimStarPage />} />
                    <Route path="/search/*" element={<SearchPage />} />
                    <Route path="/buy/*" element={<SearchPage />} />
                </Routes>
            </Suspense>
        </Router>
  );
}

export default App;
