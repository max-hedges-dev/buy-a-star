import { useCallback, useEffect, useState } from 'react';

import { fetchAccountOverview, CART_UPDATED_EVENT } from '../services/api';
import { useAuth } from './useAuth';

export function useCartCount() {
    const { isAuthenticated } = useAuth();
    const [cartCount, setCartCount] = useState(0);

    const refreshCartCount = useCallback(async () => {
        if (!isAuthenticated) {
            setCartCount(0);
            return;
        }

        try {
            const overview = await fetchAccountOverview();
            setCartCount(Array.isArray(overview?.cart_items) ? overview.cart_items.length : 0);
        } catch {
            setCartCount(0);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        refreshCartCount();
    }, [refreshCartCount]);

    useEffect(() => {
        if (!isAuthenticated) {
            return undefined;
        }

        const handleCartUpdated = () => {
            refreshCartCount();
        };

        window.addEventListener(CART_UPDATED_EVENT, handleCartUpdated);
        window.addEventListener('focus', handleCartUpdated);

        return () => {
            window.removeEventListener(CART_UPDATED_EVENT, handleCartUpdated);
            window.removeEventListener('focus', handleCartUpdated);
        };
    }, [isAuthenticated, refreshCartCount]);

    return cartCount;
}
