import { useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const EmbeddedStripeCheckout = ({ createSession, onComplete, onError }) => {
    const mountRef = useRef(null);
    const embeddedCheckoutRef = useRef(null);
    const sessionIdRef = useRef('');

    useEffect(() => {
        if (!stripePromise) {
            onError?.('Stripe is not configured on the frontend.');
            return undefined;
        }

        let isActive = true;

        const mountCheckout = async () => {
            try {
                const stripe = await stripePromise;
                if (!stripe || !mountRef.current || !isActive) return;

                const checkout = await stripe.initEmbeddedCheckout({
                    fetchClientSecret: async () => {
                        const session = await createSession();
                        sessionIdRef.current = session.session_id;
                        return session.client_secret;
                    },
                    onComplete: () => {
                        onComplete?.(sessionIdRef.current);
                    },
                });

                if (!isActive || !mountRef.current) {
                    checkout.destroy();
                    return;
                }

                embeddedCheckoutRef.current = checkout;
                checkout.mount(mountRef.current);
            } catch (error) {
                onError?.(error.message || 'Unable to start Stripe Checkout.');
            }
        };

        mountCheckout();

        return () => {
            isActive = false;
            embeddedCheckoutRef.current?.destroy();
            embeddedCheckoutRef.current = null;
        };
    }, [createSession, onComplete, onError]);

    return <div ref={mountRef} />;
};

export default EmbeddedStripeCheckout;
