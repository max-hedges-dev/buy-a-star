import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DetailedStar from './DetailedStar';
import { ArrowLeft, CheckCircle2, FileText, ShoppingCart, Loader2, Truck } from 'lucide-react';
import { createCheckoutSession, fetchCheckoutOptions } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import EmbeddedStripeCheckout from './EmbeddedStripeCheckout';

const formatMaybeNumber = (value, digits = 2) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }
    return value.toFixed(digits);
};

const TIMEZONE_TO_COUNTRY = {
    'Europe/London': 'GB',
    'Europe/Dublin': 'IE',
    'Europe/Paris': 'FR',
    'Europe/Berlin': 'DE',
    'Europe/Madrid': 'ES',
    'Europe/Rome': 'IT',
    'Europe/Amsterdam': 'NL',
    'Europe/Brussels': 'BE',
    'Europe/Vienna': 'AT',
    'Europe/Lisbon': 'PT',
    'Europe/Helsinki': 'FI',
    'Europe/Athens': 'GR',
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Copenhagen': 'DK',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Bucharest': 'RO',
    'Europe/Budapest': 'HU',
    'Europe/Zurich': 'CH',
    'Europe/Sofia': 'BG',
    'Europe/Bratislava': 'SK',
    'Europe/Ljubljana': 'SI',
    'Europe/Zagreb': 'HR',
    'Europe/Riga': 'LV',
    'Europe/Vilnius': 'LT',
    'Europe/Tallinn': 'EE',
    'Europe/Luxembourg': 'LU',
    'Europe/Malta': 'MT',
    'Europe/Nicosia': 'CY',
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'America/Phoenix': 'US',
    'America/Anchorage': 'US',
    'Pacific/Honolulu': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Edmonton': 'CA',
    'America/Winnipeg': 'CA',
    'America/Halifax': 'CA',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
    'Asia/Tokyo': 'JP',
    'Asia/Singapore': 'SG',
    'Asia/Hong_Kong': 'HK',
    'Asia/Dubai': 'AE',
    'Asia/Jerusalem': 'IL',
    'Asia/Kolkata': 'IN',
    'Asia/Shanghai': 'CN',
    'Asia/Riyadh': 'SA',
    'Africa/Johannesburg': 'ZA',
    'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR',
    'Europe/Istanbul': 'TR',
};

const detectCountryCode = () => {
    try {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timeZone && TIMEZONE_TO_COUNTRY[timeZone]) {
            return TIMEZONE_TO_COUNTRY[timeZone];
        }
    } catch {
        // Ignore timezone detection failures and fall back to locale parsing.
    }

    const locales = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const locale of locales) {
        try {
            const parsed = new Intl.Locale(locale);
            if (parsed.region) {
                return parsed.region.toUpperCase();
            }
        } catch {
            const match = locale?.match(/[-_]([A-Za-z]{2})$/);
            if (match?.[1]) {
                return match[1].toUpperCase();
            }
        }
    }
    return 'GB';
};

const formatMoney = (amount, currency) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: (currency || 'gbp').toUpperCase(),
    }).format(amount);

const StarViewer = ({ star, onBack, onSuccess, onViewInGalaxy }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingUser } = useAuth();
    const detectedCountryCode = useMemo(() => detectCountryCode(), []);
    const [ownerName, setOwnerName] = useState('');
    const [certificateType, setCertificateType] = useState('digital');
    const [checkoutOptions, setCheckoutOptions] = useState([]);
    const [selectedCountryCode, setSelectedCountryCode] = useState(detectedCountryCode || 'GB');
    const [showCountrySelector, setShowCountrySelector] = useState(!detectedCountryCode);
    const [checkoutOptionsStatus, setCheckoutOptionsStatus] = useState('loading');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    const regionNames = useMemo(
        () => (typeof Intl.DisplayNames !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null),
        []
    );

    useEffect(() => {
        const loadCheckoutOptions = async () => {
            setCheckoutOptionsStatus('loading');
            try {
                const response = await fetchCheckoutOptions(selectedCountryCode);
                const nextOptions = response.options || [];
                const nextCountryCode = response.country_code || selectedCountryCode;
                const nextSupportedCountries = Array.from(new Set([nextCountryCode, ...(response.supported_countries || [])]));

                setCheckoutOptions(nextOptions);
                setCertificateType((currentCertificateType) => (
                    nextOptions.some((option) => option.code === currentCertificateType)
                        ? currentCertificateType
                        : (response.default_certificate_type || nextOptions[0]?.code || 'digital')
                ));
                setSelectedCountryCode(nextCountryCode);
                setShowCountrySelector(!detectedCountryCode || !nextSupportedCountries.includes(detectedCountryCode));
                setPricingCurrency(response.currency || 'gbp');
                setNamedStarPrice(response.named_star_price || 0);
                setUnnamedStarPrice(response.unnamed_star_price || 0);
                setSupportedCountries(nextSupportedCountries);
                setError(null);
                setCheckoutOptionsStatus('ready');
            } catch (requestError) {
                setError(requestError.message);
                setCheckoutOptionsStatus('error');
            }
        };

        loadCheckoutOptions();
    }, [selectedCountryCode]);

    const [pricingCurrency, setPricingCurrency] = useState('gbp');
    const [namedStarPrice, setNamedStarPrice] = useState(parseFloat(star.price));
    const [unnamedStarPrice, setUnnamedStarPrice] = useState(parseFloat(star.price));
    const [supportedCountries, setSupportedCountries] = useState([]);

    const selectedCertificateOption = useMemo(
        () => checkoutOptions.find((option) => option.code === certificateType) || checkoutOptions[0] || null,
        [certificateType, checkoutOptions]
    );
    const basePrice = star.common_name ? namedStarPrice : unnamedStarPrice;
    const certificatePrice = selectedCertificateOption?.price || 0;
    const shippingPrice = selectedCertificateOption?.shipping_amount || 0;
    const total = basePrice + certificatePrice + shippingPrice;

    const handlePurchase = async () => {
        if (!isAuthenticated) {
            navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
            return;
        }

        if (!ownerName.trim()) {
            setError('Please enter the name for the certificate.');
            return;
        }
        if (!acceptedTerms) {
            setError('Please accept the Terms & Conditions before purchasing.');
            return;
        }
        if (!acceptedPrivacy) {
            setError('Please accept the Privacy Notice before purchasing.');
            return;
        }
        if (!selectedCertificateOption) {
            setError('Certificate options are still loading. Please try again in a moment.');
            return;
        }

        setError(null);
        setIsCheckoutOpen(true);
    };

    const createStripeSession = useCallback(async () => {
        setProcessing(true);
        try {
            return await createCheckoutSession({
                starId: star.id,
                ownerName,
                certificateType,
                countryCode: selectedCountryCode,
                acceptedTerms,
                acceptedPrivacy,
            });
        } finally {
            setProcessing(false);
        }
    }, [acceptedPrivacy, acceptedTerms, certificateType, ownerName, selectedCountryCode, star.id]);

    const handleCheckoutComplete = useCallback((sessionId) => {
        if (!sessionId) {
            setError('Stripe returned without a checkout session identifier.');
            return;
        }

        navigate(`/checkout/complete?session_id=${encodeURIComponent(sessionId)}`);
    }, [navigate]);

    const handleCheckoutError = useCallback((message) => {
        setError(message);
        setIsCheckoutOpen(false);
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', inset: 0 }}>
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 5, 10]} intensity={1.5} />
                <pointLight position={[-10, -5, -10]} intensity={0.5} />
                <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />
                <group position={[2.3, 0, 0]}>
                    <DetailedStar star={star} detailLevel="hero" />
                </group>
            </Canvas>

            <div
                style={{
                    position: 'absolute',
                    top: '22px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 20,
                    pointerEvents: 'auto',
                }}
            >
                <button
                    onClick={onViewInGalaxy}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        minWidth: '240px',
                        background: 'var(--primary)',
                        border: '1px solid rgba(255,255,255,0.22)',
                        color: 'white',
                        padding: '15px 32px',
                        borderRadius: '999px',
                        cursor: 'pointer',
                        backdropFilter: 'blur(14px)',
                        transition: 'all 0.2s',
                        boxShadow: '0 16px 36px rgba(255,77,0,0.38)',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        letterSpacing: '0.02em',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px) scale(1.01)';
                        e.currentTarget.style.boxShadow = '0 20px 42px rgba(255,77,0,0.46)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 16px 36px rgba(255,77,0,0.38)';
                    }}
                >
                    View in Galaxy
                </button>
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: '88px',
                    bottom: 0,
                    width: '65%',
                    minWidth: '520px',
                    maxWidth: '936px',
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)',
                    padding: '40px 44px 40px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    pointerEvents: 'none',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '40px',
                        left: '-42px',
                        zIndex: 2,
                        pointerEvents: 'auto',
                    }}
                >
                    <button
                        onClick={onBack}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white',
                            padding: '10px 20px',
                            borderRadius: '30px',
                            cursor: 'pointer',
                            backdropFilter: 'blur(10px)',
                        }}
                    >
                        <ArrowLeft size={18} /> Back
                    </button>
                </div>

                <div style={{ flex: 1, pointerEvents: 'auto', overflowY: 'auto', paddingRight: '20px' }}>
                    <div style={{ height: '66px' }} />

                    <div style={{ paddingLeft: '54px' }}>
                    <h1 style={{ fontSize: '3.5rem', marginBottom: '5px', fontFamily: 'serif', color: 'white' }}>
                        {star.common_name || star.scientific_name}
                    </h1>

                    {star.common_name && star.scientific_name && (
                        <div style={{ color: '#8e8e9c', marginBottom: '18px', fontSize: '1rem' }}>
                            {star.scientific_name}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '15px', marginBottom: '18px', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                            {star.category}
                        </span>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                            {star.distance_ly} ly away
                        </span>
                        {star.spectral_type && (
                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                                Spectral Type: {star.spectral_type}
                            </span>
                        )}
                        {typeof star.apparent_magnitude === 'number' && (
                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                                Apparent Mag: {formatMaybeNumber(star.apparent_magnitude)}
                            </span>
                        )}
                    </div>

                    {star.is_bought ? (
                        <div
                            style={{
                                background: 'linear-gradient(135deg, rgba(26,40,30,0.92) 0%, rgba(14,20,18,0.9) 100%)',
                                border: '1px solid rgba(136,204,136,0.28)',
                                padding: '22px 24px',
                                borderRadius: '18px',
                                color: 'white',
                                marginBottom: '24px',
                                boxShadow: '0 16px 34px rgba(0,0,0,0.28)',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ce29c', marginBottom: '10px', fontWeight: 'bold', letterSpacing: '0.04em' }}>
                                <CheckCircle2 size={22} /> CURRENT OWNER
                            </div>
                            <div style={{ fontSize: '1.9rem', fontFamily: 'serif', marginBottom: '8px' }}>
                                {star.owner_name}
                            </div>
                            <div style={{ display: 'flex', gap: '22px', flexWrap: 'wrap', color: '#9aa89a', fontSize: '0.9rem' }}>
                                <div>
                                    <span style={{ color: '#6f8a73', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                                        Ownership Status
                                    </span>
                                    Claimed and recorded in the registry
                                </div>
                                {star.purchase_date && (
                                    <div>
                                        <span style={{ color: '#6f8a73', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.74rem', display: 'block', marginBottom: '4px' }}>
                                            Owned Since
                                        </span>
                                        {new Date(star.purchase_date).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div
                            style={{
                                background: 'linear-gradient(135deg, rgba(255,77,0,0.18) 0%, rgba(30,18,12,0.88) 100%)',
                                border: '1px solid rgba(255,122,64,0.32)',
                                padding: '24px 24px 22px',
                                borderRadius: '18px',
                                color: 'white',
                                marginBottom: '24px',
                                boxShadow: '0 18px 40px rgba(255,77,0,0.12)',
                            }}
                        >
                            <div style={{ color: '#ffb08a', fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px', fontWeight: 'bold' }}>
                                Ownership Status
                            </div>
                            <div style={{ fontSize: '1.85rem', fontFamily: 'serif', marginBottom: '8px' }}>
                                Be The First Owner
                            </div>
                            <div style={{ color: '#f0c2af', lineHeight: 1.6, fontSize: '0.98rem' }}>
                                This star is currently unclaimed. Register your name to become its first recorded owner and place it permanently in the registry.
                            </div>
                        </div>
                    )}

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '12px',
                            marginBottom: '30px',
                        }}
                    >
                        {typeof star.luminosity === 'number' && (
                            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ color: '#777', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
                                    Luminosity
                                </div>
                                <div style={{ color: 'white', fontSize: '1rem' }}>{formatMaybeNumber(star.luminosity, 3)} Lsol</div>
                            </div>
                        )}
                        {typeof star.absolute_magnitude === 'number' && (
                            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ color: '#777', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
                                    Absolute Magnitude
                                </div>
                                <div style={{ color: 'white', fontSize: '1rem' }}>{formatMaybeNumber(star.absolute_magnitude)}</div>
                            </div>
                        )}
                        {star.constellation && (
                            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ color: '#777', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
                                    Constellation
                                </div>
                                <div style={{ color: 'white', fontSize: '1rem' }}>{star.constellation}</div>
                            </div>
                        )}
                        {typeof star.color_index === 'number' && (
                            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '14px 16px' }}>
                                <div style={{ color: '#777', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
                                    Color Index
                                </div>
                                <div style={{ color: 'white', fontSize: '1rem' }}>{formatMaybeNumber(star.color_index, 3)}</div>
                            </div>
                        )}
                    </div>

                    <p style={{ color: '#aaa', lineHeight: 1.6, marginBottom: '40px', fontSize: '1.05rem' }}>
                        This {star.category.toLowerCase()} is located {star.distance_ly} light years from Earth.
                        {star.spectral_type ? ` Its spectral classification is ${star.spectral_type}.` : ''}
                        {typeof star.apparent_magnitude === 'number' ? ` It shines at an apparent magnitude of ${formatMaybeNumber(star.apparent_magnitude)}.` : ''}
                    </p>

                    {star.is_bought ? null : (
                        <div
                            style={{
                                background: 'rgba(20, 20, 30, 0.8)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '30px',
                                borderRadius: '16px',
                                color: 'white',
                            }}
                        >
                            <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                                Claim This Star
                            </h2>

                            {error && (
                                <div style={{ color: '#ff6666', marginBottom: '15px', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ marginBottom: '25px' }}>
                                {showCountrySelector ? (
                                    <>
                                        <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                            Country
                                        </label>
                                        <select
                                            value={selectedCountryCode}
                                            onChange={(event) => setSelectedCountryCode(event.target.value)}
                                            style={{
                                                width: '100%',
                                                maxWidth: '100%',
                                                boxSizing: 'border-box',
                                                padding: '15px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(255,255,255,0.2)',
                                                background: 'rgba(0,0,0,0.5)',
                                                color: 'white',
                                                fontSize: '1rem',
                                                marginBottom: '16px',
                                            }}
                                        >
                                            {supportedCountries.map((countryCode) => (
                                                <option key={countryCode} value={countryCode}>
                                                    {regionNames?.of(countryCode) || countryCode}
                                                </option>
                                            ))}
                                        </select>
                                    </>
                                ) : null}
                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                    Name to appear on Registry
                                </label>
                                <input
                                    type="text"
                                    value={ownerName}
                                    onChange={(e) => setOwnerName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '15px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'rgba(0,0,0,0.5)',
                                        color: 'white',
                                        fontSize: '1rem',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '30px' }}>
                                <div style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '12px' }}>Certificate option</div>
                                {checkoutOptionsStatus === 'loading' ? (
                                    <div style={{ color: '#888' }}>Loading certificate options...</div>
                                ) : (
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {checkoutOptions.map((option) => {
                                            const isSelected = option.code === certificateType;
                                            return (
                                                <button
                                                    key={option.code}
                                                    type="button"
                                                    onClick={() => setCertificateType(option.code)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        justifyContent: 'space-between',
                                                        gap: '18px',
                                                        width: '100%',
                                                        padding: '16px',
                                                        borderRadius: '14px',
                                                        border: `1px solid ${isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                                        background: isSelected ? 'rgba(255, 77, 0, 0.1)' : 'rgba(0,0,0,0.3)',
                                                        color: 'white',
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                                        {option.shipping_required ? (
                                                            <Truck color={isSelected ? 'var(--primary)' : '#888'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                        ) : (
                                                            <FileText color={isSelected ? 'var(--primary)' : '#888'} style={{ marginTop: '2px', flexShrink: 0 }} />
                                                        )}
                                                        <div>
                                                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{option.label}</div>
                                                            <div style={{ fontSize: '0.86rem', color: '#9a9aa6', lineHeight: 1.6 }}>{option.description}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', color: isSelected ? 'white' : '#c9c9d2' }}>
                                                        {formatMoney(option.price, pricingCurrency)}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#aaa' }}>Star registration</span>
                                    <span style={{ color: 'white' }}>{formatMoney(basePrice, pricingCurrency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#aaa' }}>{selectedCertificateOption?.label || 'Certificate'}</span>
                                    <span style={{ color: 'white' }}>{formatMoney(certificatePrice, pricingCurrency)}</span>
                                </div>
                                {selectedCertificateOption?.shipping_required ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#aaa' }}>Shipping</span>
                                        <span style={{ color: 'white' }}>{formatMoney(shippingPrice, pricingCurrency)}</span>
                                    </div>
                                ) : null}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                    <span style={{ color: '#aaa' }}>Total Registration Fee</span>
                                    <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{formatMoney(total, pricingCurrency)}</span>
                                </div>
                            </div>

                            {!isCheckoutOpen ? (
                                <>
                                    <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#d7d7de', lineHeight: 1.6, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={acceptedTerms}
                                                onChange={(event) => setAcceptedTerms(event.target.checked)}
                                                style={{ marginTop: '3px' }}
                                            />
                                            <span>
                                                I accept the <Link to="/terms" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Terms &amp; Conditions</Link>.
                                            </span>
                                        </label>

                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#d7d7de', lineHeight: 1.6, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={acceptedPrivacy}
                                                onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                                                style={{ marginTop: '3px' }}
                                            />
                                            <span>
                                                I accept the <Link to="/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Privacy Notice</Link>.
                                            </span>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handlePurchase}
                                        disabled={processing || isLoadingUser || checkoutOptionsStatus !== 'ready'}
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            background: 'var(--primary)',
                                            color: 'white',
                                            fontSize: '1.1rem',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            borderRadius: '12px',
                                            border: 'none',
                                            cursor: (processing || isLoadingUser || checkoutOptionsStatus !== 'ready') ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            gap: '10px',
                                            opacity: (processing || isLoadingUser || checkoutOptionsStatus !== 'ready') ? 0.7 : 1,
                                            transition: 'all 0.2s',
                                            boxShadow: '0 10px 20px rgba(255,77,0,0.2)',
                                        }}
                                    >
                                        {processing ? <Loader2 className="spinner" size={20} /> : <ShoppingCart size={20} />}
                                        {processing ? 'Starting Stripe Checkout...' : isAuthenticated ? 'Continue to Secure Payment' : 'Sign In To Purchase'}
                                    </button>
                                    {!isAuthenticated ? (
                                        <p style={{ textAlign: 'center', color: '#aaa', fontSize: '0.85rem', marginTop: '14px' }}>
                                            You&apos;ll be redirected to sign in before completing this purchase.
                                        </p>
                                    ) : null}
                                    <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', marginTop: '15px' }}>
                                        Secure payment via Stripe sandbox checkout. Physical certificate options collect the delivery address inside Stripe.
                                    </p>
                                </>
                            ) : (
                                <div style={{ display: 'grid', gap: '18px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Secure payment</div>
                                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Complete your purchase below using Stripe's sandbox checkout.</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsCheckoutOpen(false)}
                                            style={{
                                                padding: '10px 16px',
                                                borderRadius: '999px',
                                                background: 'rgba(255,255,255,0.06)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'white',
                                            }}
                                        >
                                            Edit order
                                        </button>
                                    </div>

                                    <div style={{ background: '#ffffff', borderRadius: '18px', overflow: 'hidden', padding: '8px' }}>
                                        <EmbeddedStripeCheckout
                                            createSession={createStripeSession}
                                            onComplete={handleCheckoutComplete}
                                            onError={handleCheckoutError}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StarViewer;
