import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LegalDocument from '../components/LegalDocument';
import { termsConditions } from '../content/legalContent';

const TermsPage = () => {
    return (
        <>
            <Navbar />
            <div style={{ paddingTop: 'var(--nav-height)' }}>
                <LegalDocument {...termsConditions} />
            </div>
            <Footer />
        </>
    );
};

export default TermsPage;
