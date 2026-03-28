import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LegalDocument from '../components/LegalDocument';
import { privacyNotice } from '../content/legalContent';

const PrivacyPage = () => {
    return (
        <>
            <Navbar />
            <div style={{ paddingTop: 'var(--nav-height)' }}>
                <LegalDocument {...privacyNotice} />
            </div>
            <Footer />
        </>
    );
};

export default PrivacyPage;
