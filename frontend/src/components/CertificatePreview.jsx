import React from 'react';

import blankCertificate from '../assets/Blank Certificate.png';

const overlayStyle = {
    position: 'absolute',
    textAlign: 'center',
    color: '#2e2e2e',
    whiteSpace: 'nowrap',
};

const formatCertificateDate = (value) => {
    if (!value) {
        return '';
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(value));
};

const scriptStyle = {
    fontFamily: "'Pinyon Script', cursive",
    fontWeight: 400,
    fontStyle: 'normal',
    letterSpacing: '0.01em',
    color: '#383838',
};

const metaStyle = {
    fontFamily: "'Montserrat', sans-serif",
    fontStyle: 'italic',
    fontWeight: 500,
    color: '#66605a',
    letterSpacing: '0.01em',
};

const CertificatePreview = ({ order }) => {
    const certificateDate = formatCertificateDate(order.fulfilled_at || order.created_at);
    const lineOffset = '1px';
    const scriptLineOffset = '-7px';

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                maxWidth: '1120px',
                margin: '0 auto',
                filter: 'drop-shadow(0 30px 80px rgba(0, 0, 0, 0.28))',
            }}
        >
            <img
                src={blankCertificate}
                alt="Aster Atlas certificate"
                style={{ width: '100%', height: 'auto', borderRadius: '16px' }}
            />

            <div
                style={{
                    ...overlayStyle,
                    ...scriptStyle,
                    left: '50%',
                    top: '47%',
                    transform: `translate(-50%, calc(-100% - ${scriptLineOffset}))`,
                    fontSize: 'clamp(1.4rem, 2.5vw, 2.35rem)',
                    lineHeight: 1,
                }}
            >
                {order.owner_name}
            </div>

            <div
                style={{
                    ...overlayStyle,
                    ...scriptStyle,
                    left: '50%',
                    top: '63.7%',
                    transform: `translate(-50%, calc(-100% - ${scriptLineOffset}))`,
                    fontSize: 'clamp(1.4rem, 2.45vw, 2.3rem)',
                    lineHeight: 1,
                }}
            >
                {order.star.display_name}
            </div>

            <div
                style={{
                    ...overlayStyle,
                    ...metaStyle,
                    left: '21.6%',
                    top: '80.7%',
                    transform: `translate(-50%, calc(-100% - ${lineOffset}))`,
                    fontSize: 'clamp(0.8rem, 1.2vw, 1.08rem)',
                }}
            >
                {certificateDate}
            </div>

            <div
                style={{
                    ...overlayStyle,
                    ...metaStyle,
                    left: '50%',
                    top: '80.7%',
                    transform: `translate(-50%, calc(-100% - ${lineOffset}))`,
                    fontSize: 'clamp(0.76rem, 1.16vw, 1.02rem)',
                }}
            >
                {order.registration_number}
            </div>
        </div>
    );
};

export default CertificatePreview;
