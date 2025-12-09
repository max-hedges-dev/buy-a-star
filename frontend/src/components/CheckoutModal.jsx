import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { buyStar } from '../services/api';

const CheckoutModal = ({ star, onClose, onSuccess }) => {
    const [includeCertificate, setIncludeCertificate] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [ownerName, setOwnerName] = useState("");

    const basePrice = 12.99;
    const certPrice = 5.00;
    const total = includeCertificate ? basePrice + certPrice : basePrice;

    const handlePurchase = async () => {
        if (!ownerName.trim()) {
            alert("Please enter the owner name");
            return;
        }
        setProcessing(true);
        try {
            await buyStar(star.id, ownerName, includeCertificate);

            // Success
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: '#111',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px',
                        padding: '40px',
                        width: '100%',
                        maxWidth: '500px',
                        position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: 20, right: 20,
                            background: 'transparent', color: '#666'
                        }}
                    >
                        <X />
                    </button>

                    <h2 style={{ fontSize: '2rem', marginBottom: '10px', textTransform: 'uppercase' }}>Claim Star</h2>
                    <p style={{ color: '#888', marginBottom: '30px' }}>You are about to purchase ownership of:</p>

                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '10px', marginBottom: '30px' }}>
                        <h3 style={{ fontSize: '1.4rem' }}>{star.common_name || star.scientific_name}</h3>
                        <p style={{ color: '#aaa' }}>{star.category} • {star.distance_ly} light years away</p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '10px', color: '#ccc' }}>Name to appear on Certificate</label>
                        <input
                            type="text"
                            value={ownerName}
                            onChange={e => setOwnerName(e.target.value)}
                            placeholder="e.g. John Doe"
                            style={{
                                width: '100%',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.2)',
                                background: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    <div style={{ marginBottom: '30px' }}>
                        <div
                            onClick={() => setIncludeCertificate(!includeCertificate)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '15px',
                                border: '1px solid ' + (includeCertificate ? 'var(--primary)' : 'rgba(255,255,255,0.1)'),
                                borderRadius: '10px',
                                cursor: 'pointer',
                                background: includeCertificate ? 'rgba(255, 77, 0, 0.1)' : 'transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{
                                    width: '24px', height: '24px',
                                    borderRadius: '50%',
                                    border: '2px solid ' + (includeCertificate ? 'var(--primary)' : '#666'),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {includeCertificate && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--primary)' }} />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>Official Digital Certificate</div>
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>High-res PDF with coordinates</div>
                                </div>
                            </div>
                            <div style={{ fontWeight: 'bold' }}>+£{certPrice.toFixed(2)}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px', fontSize: '1.2rem', fontWeight: 'bold' }}>
                        <span>Total</span>
                        <span>£{total.toFixed(2)}</span>
                    </div>

                    <button
                        onClick={handlePurchase}
                        disabled={processing}
                        style={{
                            width: '100%',
                            padding: '20px',
                            background: 'var(--primary)',
                            color: 'white',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            borderRadius: '12px',
                            opacity: processing ? 0.7 : 1
                        }}
                    >
                        {processing ? 'Processing...' : 'Pay with PayPal'}
                    </button>

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default CheckoutModal;
