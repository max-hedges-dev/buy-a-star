import React, { useState, useEffect } from 'react';
import { fetchStars } from '../services/api';
import StarTile from './StarTile';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const BuyAStarGrid = ({ onSelectStar }) => {
    const [stars, setStars] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Filters & Pagination
    const [isBoughtFilter, setIsBoughtFilter] = useState(false); // Default: Unclaimed
    const [page, setPage] = useState(0);
    const LIMIT = 24;

    useEffect(() => {
        loadPage(page, isBoughtFilter);
    }, [page, isBoughtFilter]);

    const loadPage = async (pageNum, isBought) => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchStars({ 
                skip: pageNum * LIMIT, 
                limit: LIMIT, 
                isBought: isBought 
            });
            setStars(data);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (status) => {
        setIsBoughtFilter(status);
        setPage(0); // reset to page 0 on filter change
    };

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            overflowY: 'auto',
            background: 'black',
            color: 'white',
            zIndex: 10,
            padding: '100px 40px 40px 40px'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontFamily: 'serif', margin: 0 }}>
                        Buy A Star
                    </h1>
                    
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '5px', borderRadius: '12px' }}>
                        <button
                            onClick={() => handleFilterChange(false)}
                            style={{
                                padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: isBoughtFilter === false ? 'var(--primary)' : 'transparent',
                                color: isBoughtFilter === false ? 'white' : '#aaa',
                                fontWeight: 'bold', transition: 'all 0.2s'
                            }}
                        >
                            Unclaimed
                        </button>
                        <button
                            onClick={() => handleFilterChange(true)}
                            style={{
                                padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                background: isBoughtFilter === true ? '#333' : 'transparent',
                                color: isBoughtFilter === true ? 'white' : '#aaa',
                                fontWeight: 'bold', transition: 'all 0.2s'
                            }}
                        >
                            Claimed
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {loading && stars.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                        <Loader2 className="spinner" size={40} color="var(--primary)" />
                    </div>
                ) : error ? (
                    <div style={{ color: 'red', textAlign: 'center', padding: '40px' }}>{error}</div>
                ) : stars.length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '100px', fontSize: '1.2rem' }}>
                        No stars found matching this criteria.
                    </div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: '25px',
                        marginBottom: '50px'
                    }}>
                        {stars.map((star) => (
                            <StarTile key={star.id} star={star} onClick={onSelectStar} />
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {stars.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', paddingBottom: '40px' }}>
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(p => p - 1)}
                            style={{
                                padding: '12px 24px', borderRadius: '8px', border: '1px solid #444',
                                background: page === 0 ? 'transparent' : 'rgba(255,255,255,0.1)',
                                color: page === 0 ? '#666' : 'white', cursor: page === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            <ChevronLeft size={20} /> Previous
                        </button>
                        <span style={{ fontSize: '1.1rem', color: '#aaa' }}>Page {page + 1}</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={stars.length < LIMIT} // Disable if we fetched fewer than LIMIT (last page)
                            style={{
                                padding: '12px 24px', borderRadius: '8px', border: '1px solid #444',
                                background: stars.length < LIMIT ? 'transparent' : 'rgba(255,255,255,0.1)',
                                color: stars.length < LIMIT ? '#666' : 'white', cursor: stars.length < LIMIT ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                        >
                            Next <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>
            
            {/* Dark gradient overlay at the bottom for aesthetic */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '100px', background: 'linear-gradient(to top, black, transparent)', pointerEvents: 'none', zIndex: 11 }} />
        </div>
    );
};

export default BuyAStarGrid;
