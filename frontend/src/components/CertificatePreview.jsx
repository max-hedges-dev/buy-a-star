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

const resolvePreviewData = ({ order, previewData }) => {
    if (order) {
        return {
            ownerName: order.owner_name,
            starName: order.star.display_name,
            certificateDate: formatCertificateDate(order.fulfilled_at || order.created_at),
            registrationNumber: order.registration_number,
        };
    }

    return {
        ownerName: previewData?.ownerName || '[Recipient name]',
        starName: previewData?.starName || '[Star name]',
        certificateDate: previewData?.certificateDate || 'After purchase',
        registrationNumber: previewData?.registrationNumber || 'AA-00000000-EXAMPLE',
    };
};

const CertificatePreview = ({ order = null, previewData = null, exampleNote = null }) => {
    const resolvedPreview = resolvePreviewData({ order, previewData });
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
                {resolvedPreview.ownerName}
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
                {resolvedPreview.starName}
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
                {resolvedPreview.certificateDate}
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
                {resolvedPreview.registrationNumber}
            </div>

            {exampleNote ? (
                <div
                    style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: '5.5%',
                        transform: 'translateX(-50%)',
                        padding: '8px 12px',
                        borderRadius: '999px',
                        background: 'rgba(255, 248, 237, 0.86)',
                        color: '#574231',
                        fontSize: 'clamp(0.68rem, 1vw, 0.84rem)',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {exampleNote}
                </div>
            ) : null}
        </div>
    );
};

export default CertificatePreview;
