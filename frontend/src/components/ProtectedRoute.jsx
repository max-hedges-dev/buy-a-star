import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';

const shellStyle = {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background:
        'radial-gradient(circle at top, rgba(255,77,0,0.18), transparent 35%), linear-gradient(180deg, #050505 0%, #020202 100%)',
    color: 'white',
};

const ProtectedRoute = ({ children }) => {
    const location = useLocation();
    const { isAuthenticated, isLoadingUser } = useAuth();

    if (isLoadingUser) {
        return (
            <div style={shellStyle}>
                <div className="glass-card" style={{ padding: '24px 28px' }}>
                    Restoring your session...
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                replace
                to={`/auth?next=${encodeURIComponent(location.pathname + location.search)}`}
            />
        );
    }

    return children;
};

export default ProtectedRoute;
