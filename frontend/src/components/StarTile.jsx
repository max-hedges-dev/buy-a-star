import React, { useState } from 'react';
import { Sparkles, ShoppingCart, Eye } from 'lucide-react';

const StarTile = ({ star, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Map star category to CSS colors for the preview
    const getStarColor = (category) => {
        if (!category) return '#ffffff';
        if (category.includes('Blue')) return '#aaccff';
        if (category.includes('Red Giant')) return '#ff8866';
        if (category.includes('Red')) return '#ffaa88';
        if (category.includes('Yellow')) return '#ffeebb';
        return '#ffffff';
    };

    const color = getStarColor(star.category);
    const isClaimed = star.is_bought;

    return (
        <div 
            className={`star-tile ${isClaimed ? 'claimed' : ''} ${isHovered ? 'hovered' : ''}`}
            onClick={() => onClick(star)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                background: isClaimed ? 'rgba(30,30,40,0.8)' : 'rgba(20,20,30,0.8)',
                border: `1px solid ${isHovered ? color : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '15px',
                position: 'relative',
                overflow: 'hidden',
                opacity: isClaimed ? 0.6 : 1,
                transform: isHovered ? 'translateY(-5px)' : 'none',
                boxShadow: isHovered ? `0 10px 20px rgba(0,0,0,0.5), 0 0 15px ${color}33` : '0 4px 6px rgba(0,0,0,0.3)',
            }}
        >
            {/* Animated Star Preview */}
            <div style={{
                height: '100px',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Glow effect */}
                <div style={{
                    position: 'absolute',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: color,
                    filter: 'blur(20px)',
                    opacity: isHovered ? 0.6 : 0.2,
                    transition: 'all 0.5s ease',
                    transform: isHovered ? 'scale(1.5)' : 'scale(1)'
                }} />
                
                {/* The star icon itself */}
                <Sparkles 
                    size={40} 
                    color={color} 
                    style={{
                        position: 'relative',
                        zIndex: 1,
                        transition: 'all 0.5s ease',
                        transform: isHovered ? 'rotate(15deg) scale(1.1)' : 'rotate(0deg) scale(1)',
                        filter: `drop-shadow(0 0 10px ${color})`
                    }} 
                />
            </div>

            {/* Star Info */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.2rem', 
                    color: 'white',
                    fontFamily: 'serif'
                }}>
                    {star.common_name || star.scientific_name}
                </h3>
                <span style={{ color: '#aaa', fontSize: '0.9rem' }}>
                    {star.category} • {star.distance_ly} ly
                </span>
            </div>

            {/* Ownership Status */}
            {isClaimed ? (
                <div style={{
                    background: 'rgba(0,0,0,0.5)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    borderLeft: '2px solid #666',
                    fontSize: '0.85rem',
                    color: '#888'
                }}>
                    <strong>Owned by:</strong><br/>
                    {star.owner_name}
                </div>
            ) : (
                <div style={{ height: '37px' }}></div> /* Spacer to keep tiles uniform */
            )}

            {/* Action Button */}
            <button style={{
                width: '100%',
                padding: '10px',
                background: isClaimed ? 'transparent' : 'var(--primary)',
                color: isClaimed ? '#aaa' : 'white',
                border: isClaimed ? '1px solid #555' : 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                marginTop: 'auto'
            }}>
                {isClaimed ? (
                    <><Eye size={18} /> View Star</>
                ) : (
                    <><ShoppingCart size={18} /> View / Buy (£{star.price})</>
                )}
            </button>
        </div>
    );
};

export default StarTile;
