import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import DetailedStar from './DetailedStar';
import { ArrowLeft, CheckCircle2, FileText, ShoppingCart, Loader2 } from 'lucide-react';
import { buyStar } from '../services/api';

const StarViewer = ({ star, onBack, onSuccess, onViewInGalaxy }) => {
    // Checkout State
    const [ownerName, setOwnerName] = useState("");
    const [includeCertificate, setIncludeCertificate] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    const basePrice = parseFloat(star.price);
    const certPrice = 5.00;
    const total = includeCertificate ? basePrice + certPrice : basePrice;

    const handlePurchase = async () => {
        if (!ownerName.trim()) {
            setError("Please enter the name for the certificate.");
            return;
        }
        setProcessing(true);
        setError(null);
        try {
            await buyStar(star.id, ownerName, includeCertificate);
            onSuccess();
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
            {/* 3D Scene - Full screen but star shifted right */}
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <ambientLight intensity={0.2} />
                <pointLight position={[10, 5, 10]} intensity={1.5} />
                <pointLight position={[-10, -5, -10]} intensity={0.5} />

                {/* Background Dust/Stars */}
                <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={0.5} />

                {/* The Star - Shifted to the right by X=2 */}
                <group position={[2.5, 0, 0]}>
                    <DetailedStar star={star} />
                </group>
            </Canvas>

            {/* UI Overlay - Left Panel */}
            <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: '45%', minWidth: '400px', maxWidth: '600px',
                background: 'linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 60%, rgba(0,0,0,0) 100%)',
                padding: '40px',
                display: 'flex', flexDirection: 'column',
                pointerEvents: 'none' // Allow clicks to pass through empty space
            }}>
                
                {/* Scrollable content area */}
                <div style={{ flex: 1, pointerEvents: 'auto', overflowY: 'auto', paddingRight: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
                        <button
                            onClick={onBack}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                color: 'white', padding: '10px 20px', borderRadius: '30px',
                                cursor: 'pointer', backdropFilter: 'blur(10px)'
                            }}
                        >
                            <ArrowLeft size={18} /> Back
                        </button>

                        <button
                            onClick={onViewInGalaxy}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                background: 'rgba(255, 77, 0, 0.2)', border: '1px solid var(--primary)',
                                color: 'white', padding: '10px 20px', borderRadius: '30px',
                                cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 77, 0, 0.2)'}
                        >
                            View in Galaxy
                        </button>
                    </div>

                    <h1 style={{ fontSize: '3.5rem', marginBottom: '5px', fontFamily: 'serif', color: 'white' }}>
                        {star.common_name || star.scientific_name}
                    </h1>
                    
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                            {star.category}
                        </span>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                            {star.distance_ly} ly away
                        </span>
                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: '#ccc' }}>
                            Mag: {star.magnitude}
                        </span>
                    </div>

                    <p style={{ color: '#aaa', lineHeight: 1.6, marginBottom: '40px', fontSize: '1.05rem' }}>
                        This {star.category.toLowerCase()} is located {star.distance_ly} light years from Earth. 
                        Its absolute magnitude is {star.magnitude}, and its galactic coordinates are 
                        ({star.x.toFixed(2)}, {star.y.toFixed(2)}, {star.z.toFixed(2)}).
                    </p>

                    {/* Ownership / Buying Section */}
                    {star.is_bought ? (
                        <div style={{
                            background: 'rgba(20, 20, 30, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
                            padding: '30px', borderRadius: '16px', color: 'white'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#88cc88', marginBottom: '15px', fontWeight: 'bold' }}>
                                <CheckCircle2 size={24} /> STAR CLAIMED
                            </div>
                            <div style={{ color: '#888', marginBottom: '5px', fontSize: '0.9rem', textTransform: 'uppercase' }}>Official Owner</div>
                            <div style={{ fontSize: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '15px' }}>
                                {star.owner_name}
                            </div>
                            <div style={{ color: '#666', fontSize: '0.85rem' }}>
                                Registered on {new Date(star.purchase_date).toLocaleDateString()}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: 'rgba(20, 20, 30, 0.8)', border: '1px solid rgba(255,255,255,0.1)',
                            padding: '30px', borderRadius: '16px', color: 'white'
                        }}>
                            <h2 style={{ fontSize: '1.5rem', margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px' }}>
                                Claim This Star
                            </h2>

                            {error && <div style={{ color: '#ff6666', marginBottom: '15px', padding: '10px', background: 'rgba(255,0,0,0.1)', borderRadius: '8px' }}>{error}</div>}

                            <div style={{ marginBottom: '25px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>
                                    Name to appear on Registry
                                </label>
                                <input
                                    type="text"
                                    value={ownerName}
                                    onChange={e => setOwnerName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    style={{
                                        width: '100%', padding: '15px', borderRadius: '8px',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '1rem'
                                    }}
                                />
                            </div>

                            <div 
                                onClick={() => setIncludeCertificate(!includeCertificate)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '15px', borderRadius: '10px', cursor: 'pointer', marginBottom: '30px',
                                    border: `1px solid ${includeCertificate ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                                    background: includeCertificate ? 'rgba(255, 77, 0, 0.1)' : 'rgba(0,0,0,0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <FileText color={includeCertificate ? 'var(--primary)' : '#666'} />
                                    <div>
                                        <div style={{ fontWeight: 'bold' }}>Digital Certificate</div>
                                        <div style={{ fontSize: '0.8rem', color: '#888' }}>High-res PDF with coordinates</div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 'bold', color: includeCertificate ? 'white' : '#888' }}>
                                    +£{certPrice.toFixed(2)}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <span style={{ color: '#aaa' }}>Total Registration Fee</span>
                                <span style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>£{total.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={handlePurchase}
                                disabled={processing}
                                style={{
                                    width: '100%', padding: '18px',
                                    background: 'var(--primary)', color: 'white',
                                    fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase',
                                    borderRadius: '12px', border: 'none', cursor: processing ? 'not-allowed' : 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                                    opacity: processing ? 0.7 : 1, transition: 'all 0.2s',
                                    boxShadow: '0 10px 20px rgba(255,77,0,0.2)'
                                }}
                            >
                                {processing ? <Loader2 className="spinner" size={20} /> : <ShoppingCart size={20} />}
                                {processing ? 'Processing Securely...' : 'Complete Purchase'}
                            </button>
                            <p style={{ textAlign: 'center', color: '#666', fontSize: '0.8rem', marginTop: '15px' }}>
                                Secure payment via Fake PayPal Mock
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StarViewer;
