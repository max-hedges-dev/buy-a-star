import React from 'react';
import Navbar from '../components/Navbar';
import AboutSection from '../components/AboutSection';
import Footer from '../components/Footer';

const AboutPage = () => {
    return (
        <>
            <Navbar />
            <div style={{ paddingTop: 'var(--nav-height)' }}>
                <AboutSection />
            </div>
            <Footer />
        </>
    );
};

export default AboutPage;
