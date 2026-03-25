import React from 'react';
import Navbar from '../components/Navbar';
import FaqSection from '../components/FaqSection';
import Footer from '../components/Footer';

const FaqPage = () => {
    return (
        <>
            <Navbar />
            <div style={{ paddingTop: 'var(--nav-height)' }}>
                <FaqSection />
            </div>
            <Footer />
        </>
    );
};

export default FaqPage;
