import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Truck } from 'lucide-react';

import CertificatePreview from '../components/CertificatePreview';
import EmbeddedStripeCheckout from '../components/EmbeddedStripeCheckout';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import useResponsiveScale from '../hooks/useResponsiveScale';
import {
    createBulkCheckoutSession,
    fetchAccountOverview,
    fetchCheckoutOptions,
    notifyCartUpdated,
    removeCartItems,
} from '../services/api';
import { formatMoney, getStarDisplayName } from '../utils/ownership';

const pageStyle = {
    minHeight: '100vh',
    background: `
        radial-gradient(circle at top center, rgba(255,101,24,0.18), transparent 24%),
        radial-gradient(circle at 14% 24%, rgba(0,188,212,0.11), transparent 20%),
        linear-gradient(180deg, #040404 0%, #090909 100%)
    `,
};

const panelStyle = {
    padding: '30px 32px',
    borderRadius: 28,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '15px',
    borderRadius: '14px',
    border: '1px solid rgba(245,239,226,0.14)',
    background: 'rgba(7,10,17,0.76)',
    color: 'white',
    fontSize: '1rem',
};

const addOnCardStyle = (selected) => ({
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    width: '100%',
    padding: '16px',
    borderRadius: '18px',
    border: `1px solid ${selected ? 'var(--border-gold)' : 'rgba(255,255,255,0.1)'}`,
    background: selected ? 'rgba(200,121,58,0.12)' : 'rgba(255,255,255,0.03)',
    color: 'white',
    textAlign: 'left',
});

const placeholderAddOns = [
    {
        code: 'social_media_package',
        label: 'Social media package',
        description: 'Create shareable story and post assets in Star Studio after purchase.',
        actionLabel: 'Create later',
        isPlaceholder: true,
    },
    {
        code: 'keepsakes_coming_soon',
        label: 'Physical keepsakes',
        description: 'Small gift objects and keepsakes are still being prepared.',
        actionLabel: 'Coming soon',
        isPlaceholder: true,
    },
];

const getBaseStarPrice = (item) => {
    if (typeof item.star?.price === 'number' && Number.isFinite(item.star.price)) {
        return item.star.price;
    }
    if (typeof item.star?.model_value === 'number' && Number.isFinite(item.star.model_value)) {
        return item.star.model_value;
    }
    return typeof item.amount === 'number' ? item.amount : 0;
};

const BulkCartCheckoutPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isCompact, isNarrow, px } = useResponsiveScale({ compactWidth: 920 });
    const ids = useMemo(
        () => (searchParams.get('items') || '')
            .split(',')
            .map((value) => Number.parseInt(value.trim(), 10))
            .filter((value) => Number.isInteger(value)),
        [searchParams]
    );

    const [status, setStatus] = useState('loading');
    const [items, setItems] = useState([]);
    const [ownerName, setOwnerName] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [isCheckoutReviewOpen, setIsCheckoutReviewOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [showAddOns, setShowAddOns] = useState(false);
    const [showCertificateExample, setShowCertificateExample] = useState(false);
    const [pendingRemovalItem, setPendingRemovalItem] = useState(null);
    const [isRemoving, setIsRemoving] = useState(false);
    const [checkoutOptions, setCheckoutOptions] = useState([]);
    const [checkoutOptionsStatus, setCheckoutOptionsStatus] = useState('loading');
    const [selectedCountryCode, setSelectedCountryCode] = useState('GB');
    const [pricingCurrency, setPricingCurrency] = useState('gbp');
    const [certificateType, setCertificateType] = useState('digital');

    useEffect(() => {
        const load = async () => {
            try {
                const [overview, checkoutOptionsResponse] = await Promise.all([
                    fetchAccountOverview(),
                    fetchCheckoutOptions('GB'),
                ]);
                const selectedItems = (overview.cart_items || []).filter((item) => ids.includes(item.id));
                setItems(selectedItems);
                if (selectedItems[0]) {
                    setOwnerName(selectedItems[0].owner_name || '');
                }
                const nextOptions = checkoutOptionsResponse.options || [];
                setCheckoutOptions(nextOptions);
                setCertificateType(checkoutOptionsResponse.default_certificate_type || nextOptions[0]?.code || 'digital');
                setSelectedCountryCode(checkoutOptionsResponse.country_code || 'GB');
                setPricingCurrency(checkoutOptionsResponse.currency || 'gbp');
                setCheckoutOptionsStatus('ready');
                setStatus('ready');
            } catch (error) {
                setCheckoutError(error.message);
                setCheckoutOptionsStatus('error');
                setStatus('error');
            }
        };

        load();
    }, [ids]);

    const selectedCertificateOption = useMemo(
        () => checkoutOptions.find((option) => option.code === certificateType) || checkoutOptions[0] || null,
        [checkoutOptions, certificateType]
    );

    const baseTotal = items.reduce((sum, item) => sum + getBaseStarPrice(item), 0);
    const addOnTotal = (selectedCertificateOption?.price || 0) * items.length;
    const shippingTotal = selectedCertificateOption?.shipping_required
        ? (selectedCertificateOption?.shipping_amount || 0) * items.length
        : 0;
    const estimatedTotal = baseTotal + addOnTotal + shippingTotal;
    const pagePaddingX = px(isNarrow ? 18 : 24);
    const heroPadding = `${px(42)}px ${px(40)}px`;

    const createSession = async () => createBulkCheckoutSession({
        transactionIds: items.map((item) => item.id),
        ownerName,
        certificateType,
        countryCode: selectedCountryCode,
        acceptedTerms,
        acceptedPrivacy,
    });

    const handleOpenCheckoutReview = () => {
        if (!ownerName.trim()) {
            setCheckoutError('Please choose the shared registered display name for these stars.');
            return;
        }
        setCheckoutError('');
        setIsCheckoutReviewOpen(true);
        setIsPaymentOpen(false);
    };

    const handleContinueToPayment = () => {
        if (!acceptedTerms || !acceptedPrivacy) {
            setCheckoutError('Please accept the Terms & Conditions and Privacy Notice before continuing.');
            return;
        }
        setCheckoutError('');
        setIsPaymentOpen(true);
    };

    const handleConfirmRemove = async () => {
        if (!pendingRemovalItem) return;
        try {
            setIsRemoving(true);
            await removeCartItems([pendingRemovalItem.id]);
            notifyCartUpdated();
            const nextItems = items.filter((item) => item.id !== pendingRemovalItem.id);
            setItems(nextItems);
            setPendingRemovalItem(null);
            if (!nextItems.length) {
                navigate('/account/cart');
            }
        } catch (error) {
            setCheckoutError(error.message);
        } finally {
            setIsRemoving(false);
        }
    };

    const certificateExampleData = {
        ownerName: ownerName || '[Recipient name]',
        starName: items[0] ? getStarDisplayName(items[0].star) : '[Star name]',
    };

    return (
        <div style={pageStyle}>
            <Navbar />
            <main style={{ padding: `calc(var(--nav-height) + ${px(42)}px) ${pagePaddingX}px ${px(90)}px` }}>
                <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: px(26) }}>
                    <section className="glass-card" style={{ padding: heroPadding }}>
                        <p className="eyebrow" style={{ marginBottom: 16 }}>Checkout review</p>
                        <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4.6rem)', lineHeight: 0.95, marginBottom: 16 }}>
                            Review these stars together.
                        </h1>
                        <p className="muted-copy" style={{ maxWidth: 760 }}>
                            Keep payment simple now. Your purchase saves these stars to your account, and any deeper certificate wording, dedication text, or social assets can be created later in Star Studio.
                        </p>
                    </section>

                    {status === 'loading' ? (
                        <section className="glass-card" style={{ padding: heroPadding }}>
                            <p className="muted-copy">Loading your selected cart stars...</p>
                        </section>
                    ) : null}

                    {status === 'error' ? (
                        <section className="glass-card" style={{ padding: heroPadding }}>
                            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>We couldn't prepare this checkout</h2>
                            <p className="muted-copy" style={{ marginBottom: 20 }}>{checkoutError}</p>
                            <Link to="/account/cart" className="secondary-button">Back to cart</Link>
                        </section>
                    ) : null}

                    {status === 'ready' ? (
                        <>
                            <section className="glass-card" style={{ padding: heroPadding }}>
                                <div style={{ display: 'grid', gap: 18 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '1.05fr 0.95fr', gap: 18 }}>
                                        <div className="glass-card" style={{ padding: '22px 22px' }}>
                                            <div className="eyebrow" style={{ marginBottom: 10 }}>What you are getting today</div>
                                            <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                                <li>A selected real star from the Aster Atlas catalogue</li>
                                                <li>Registration in your Aster Atlas account</li>
                                                <li>Access to your Star Page</li>
                                                <li>Access to Star Studio, where you can create certificates, dedication text, social assets, and add-ons after purchase</li>
                                            </ul>
                                        </div>
                                        <div style={{ ...panelStyle, padding: '22px 22px' }}>
                                            <div className="eyebrow" style={{ marginBottom: 8 }}>Shared registered display name</div>
                                            <input
                                                value={ownerName}
                                                onChange={(event) => setOwnerName(event.target.value)}
                                                style={inputStyle}
                                                placeholder="Who should these stars be registered to?"
                                            />
                                            <p className="muted-copy" style={{ margin: '12px 0 0' }}>
                                                This shared checkout uses one display name for all selected stars. You can personalise each one later in Star Studio and the ownership pages.
                                            </p>
                                        </div>
                                    </div>

                                    <div style={{ ...panelStyle, padding: '22px 22px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                                            <div className="eyebrow">Optional gift and keepsake add-ons</div>
                                            <button type="button" className="secondary-button" onClick={() => setShowAddOns((current) => !current)}>
                                                {showAddOns ? 'Hide optional add-ons' : 'View optional add-ons'}
                                            </button>
                                        </div>
                                        <p className="muted-copy" style={{ margin: 0 }}>
                                            You can add these now to estimate your total cost, or customise them later in Star Studio.
                                        </p>
                                        {showAddOns ? (
                                            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
                                                {checkoutOptionsStatus === 'ready' ? checkoutOptions.map((option) => {
                                                    const isSelected = option.code === certificateType;
                                                    return (
                                                        <button
                                                            key={option.code}
                                                            type="button"
                                                            onClick={() => setCertificateType(option.code)}
                                                            style={addOnCardStyle(isSelected)}
                                                        >
                                                            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                                                {option.shipping_required ? <Truck color={isSelected ? 'var(--primary)' : '#8f8678'} size={18} /> : <FileText color={isSelected ? 'var(--primary)' : '#8f8678'} size={18} />}
                                                                <div>
                                                                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{option.label}</div>
                                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>{option.description}</div>
                                                                    {option.shipping_required ? (
                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: 8 }}>
                                                                            {option.code === 'a4_card'
                                                                                ? 'Frames and heavier formats may require parcel shipping, so shipping may be higher than a flat certificate.'
                                                                                : 'Estimated shipping will depend on destination and package size.'}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                            <div style={{ textAlign: 'right', minWidth: 120 }}>
                                                                <div style={{ fontWeight: 700 }}>{formatMoney(option.price, pricingCurrency)}</div>
                                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                                                                    {isSelected ? 'Included now' : 'Add to checkout'}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    );
                                                }) : null}

                                                {placeholderAddOns.map((option) => (
                                                    <div key={option.code} style={addOnCardStyle(false)}>
                                                        <div>
                                                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{option.label}</div>
                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>{option.description}</div>
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{option.actionLabel}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>

                                    <div style={{ ...panelStyle, padding: '22px 22px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                            <div>
                                                <div className="eyebrow" style={{ marginBottom: 8 }}>Certificate example</div>
                                                <p className="muted-copy" style={{ margin: 0 }}>
                                                    Example only. You can personalise this in Star Studio after purchase.
                                                </p>
                                            </div>
                                            <button type="button" className="secondary-button" onClick={() => setShowCertificateExample(true)}>
                                                See certificate example
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ ...panelStyle, padding: '22px 22px' }}>
                                        <div className="eyebrow" style={{ marginBottom: 12 }}>Cost summary</div>
                                        <div style={{ display: 'grid', gap: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Base star price</span>
                                                <strong>{formatMoney(baseTotal, pricingCurrency)}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{selectedCertificateOption?.label || 'Selected add-on'}</span>
                                                <strong>{formatMoney(addOnTotal, pricingCurrency)}</strong>
                                            </div>
                                            {selectedCertificateOption?.shipping_required ? (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Estimated shipping</span>
                                                    <strong>{formatMoney(shippingTotal, pricingCurrency)}</strong>
                                                </div>
                                            ) : null}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>{selectedCertificateOption?.shipping_required ? 'Estimated total' : 'Total'}</span>
                                                <strong style={{ fontSize: '1.35rem' }}>{formatMoney(estimatedTotal, pricingCurrency)}</strong>
                                            </div>
                                            {selectedCertificateOption?.shipping_required ? (
                                                <p className="muted-copy" style={{ margin: '4px 0 0' }}>
                                                    Estimated shipping will depend on destination and package size.
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>

                                    {checkoutError ? <div className="status-banner status-banner-error">{checkoutError}</div> : null}

                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        {!isCheckoutReviewOpen ? (
                                            <button type="button" className="secondary-button" onClick={handleOpenCheckoutReview}>
                                                Review checkout
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    className="primary-button"
                                                    onClick={handleContinueToPayment}
                                                >
                                                    Continue to payment
                                                </button>
                                                <button
                                                    type="button"
                                                    className="secondary-button"
                                                    onClick={() => setIsCheckoutReviewOpen(false)}
                                                >
                                                    Customise later
                                                </button>
                                            </>
                                        )}
                                        <Link to="/account/cart" className="secondary-button">
                                            Back to cart
                                        </Link>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-card" style={{ padding: heroPadding }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                                    <p className="eyebrow" style={{ margin: 0 }}>Selected stars</p>
                                    <p className="muted-copy" style={{ margin: 0 }}>You can still remove a star before payment.</p>
                                </div>
                                <div style={{ display: 'grid', gap: 12 }}>
                                    {items.map((item) => (
                                        <div key={item.id} style={panelStyle}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'start' }}>
                                                <div>
                                                    <strong style={{ display: 'block', marginBottom: 8 }}>{getStarDisplayName(item.star)}</strong>
                                                    <span className="muted-copy">{formatMoney(getBaseStarPrice(item), pricingCurrency)}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="secondary-button"
                                                    onClick={() => setPendingRemovalItem(item)}
                                                >
                                                    Remove star
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {isCheckoutReviewOpen ? (
                                <section className="glass-card" style={{ padding: heroPadding }}>
                                    <div className="status-banner" style={{ marginBottom: 18 }}>
                                        Buying multiple stars in one go may not allow you to put tailored information for each star. You can edit each star separately later from its ownership page once purchased.
                                    </div>
                                    <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
                                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                                            <span>I accept the <Link to="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Terms & Conditions</Link>.</span>
                                        </label>
                                        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <input type="checkbox" checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} />
                                            <span>I accept the <Link to="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Privacy Notice</Link>.</span>
                                        </label>
                                    </div>

                                    {isPaymentOpen ? (
                                        <div style={{ display: 'grid', gap: 18 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Pay now</div>
                                                    <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Continue with Stripe when you are ready. Creative customisation can wait until Star Studio.</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsPaymentOpen(false)}
                                                    style={{
                                                        padding: '10px 16px',
                                                        borderRadius: '999px',
                                                        background: 'rgba(255,255,255,0.06)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        color: 'white',
                                                    }}
                                                >
                                                    Edit checkout
                                                </button>
                                            </div>

                                            <div style={{ background: '#ffffff', borderRadius: '18px', overflow: 'hidden', padding: '8px' }}>
                                                <EmbeddedStripeCheckout
                                                    createSession={createSession}
                                                    onComplete={(sessionId) => navigate(`/checkout/complete?session_id=${encodeURIComponent(sessionId)}`)}
                                                    onError={(message) => setCheckoutError(message)}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                            <button type="button" className="primary-button" onClick={handleContinueToPayment}>
                                                Continue to payment
                                            </button>
                                            <button type="button" className="secondary-button" onClick={() => setIsCheckoutReviewOpen(false)}>
                                                Customise later
                                            </button>
                                        </div>
                                    )}
                                </section>
                            ) : null}
                        </>
                    ) : null}
                </div>
            </main>

            {showCertificateExample ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.62)',
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 130,
                        padding: 24,
                    }}
                >
                    <div className="glass-card" style={{ maxWidth: 980, width: '100%', padding: heroPadding }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', marginBottom: 18, flexWrap: 'wrap' }}>
                            <div>
                                <p className="eyebrow" style={{ marginBottom: 12 }}>Certificate example</p>
                                <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', marginBottom: 10 }}>
                                    Example only.
                                </h2>
                                <p className="muted-copy" style={{ margin: 0 }}>
                                    Your certificate can be personalised after purchase in Star Studio. You do not need to finish the wording now.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <button type="button" className="secondary-button" onClick={() => setShowCertificateExample(false)}>
                                    Close
                                </button>
                                <button type="button" className="primary-button" onClick={() => setShowCertificateExample(false)}>
                                    Continue checkout
                                </button>
                            </div>
                        </div>
                        <CertificatePreview
                            previewData={certificateExampleData}
                            exampleNote="Example only"
                        />
                    </div>
                </div>
            ) : null}

            {pendingRemovalItem ? (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.56)',
                        display: 'grid',
                        placeItems: 'center',
                        zIndex: 130,
                        padding: 24,
                    }}
                >
                    <div className="glass-card" style={{ maxWidth: 620, width: '100%', padding: heroPadding }}>
                        <p className="eyebrow" style={{ marginBottom: 16 }}>Remove from checkout</p>
                        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.6rem)', marginBottom: 14 }}>
                            Remove this star from your cart?
                        </h2>
                        <p className="muted-copy" style={{ marginBottom: 14 }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{getStarDisplayName(pendingRemovalItem.star)}</strong>
                        </p>
                        <p className="muted-copy" style={{ marginBottom: 24 }}>
                            This exact star may be hard to find again. If you remove it, your hold on this star may be released.
                        </p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <button type="button" className="secondary-button" onClick={() => setPendingRemovalItem(null)} disabled={isRemoving}>
                                Cancel
                            </button>
                            <button type="button" className="primary-button" onClick={handleConfirmRemove} disabled={isRemoving}>
                                {isRemoving ? 'Removing...' : 'Remove star'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <Footer />
        </div>
    );
};

export default BulkCartCheckoutPage;
