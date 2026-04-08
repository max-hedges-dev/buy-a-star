import blankCertificate from '../assets/Blank Certificate.png';

const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
});

const ensureFont = async (definition) => {
    if (!document?.fonts?.load) {
        return;
    }

    try {
        await document.fonts.load(definition);
    } catch {
        // Ignore font loading failures and let the canvas fall back gracefully.
    }
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

const drawCenteredText = (context, text, x, y) => {
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillText(text, x, y);
};

export const downloadCertificate = async (order) => {
    if (!order) {
        return;
    }

    await Promise.all([
        ensureFont("400 120px 'Pinyon Script'"),
        ensureFont("500 italic 52px 'Montserrat'"),
    ]);

    const image = await loadImage(blankCertificate);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.fillStyle = '#383838';

    const ownerName = order.owner_name || '';
    const starName = order.star?.display_name || '';
    const certificateDate = formatCertificateDate(order.fulfilled_at || order.created_at);
    const registrationNumber = order.registration_number || '';

    context.font = "400 126px 'Pinyon Script', cursive";
    drawCenteredText(context, ownerName, canvas.width * 0.5, canvas.height * 0.465);
    drawCenteredText(context, starName, canvas.width * 0.5, canvas.height * 0.633);

    context.fillStyle = '#66605a';
    context.font = "italic 500 52px 'Montserrat', sans-serif";
    drawCenteredText(context, certificateDate, canvas.width * 0.216, canvas.height * 0.804);
    drawCenteredText(context, registrationNumber, canvas.width * 0.5, canvas.height * 0.804);

    const downloadLink = document.createElement('a');
    const fileSafeStarName = (starName || 'certificate').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.download = `aster-atlas-certificate-${fileSafeStarName || 'download'}.png`;
    downloadLink.click();
};
