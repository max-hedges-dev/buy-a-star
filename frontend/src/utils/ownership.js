export const slugifyStarName = (value) => (
    (value || '')
        .toString()
        .toLowerCase()
        .trim()
        .replace(/['’.]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
);

export const getStarDisplayName = (star) => (
    star?.display_name || star?.common_name || star?.scientific_name || 'Registered star'
);

export const getStarSlug = (star) => slugifyStarName(getStarDisplayName(star));

export const getPublicStarPath = (starOrRegistration) => {
    const publicSlug = starOrRegistration?.public_page_slug || starOrRegistration?.publicRegistration?.public_page_slug;
    if (publicSlug) {
        return `/starwiki/${publicSlug}`;
    }
    return `/search/${getStarSlug(starOrRegistration?.star || starOrRegistration)}`;
};

export const getOwnedStarPath = (registrationOrOrderOrStar) => {
    const registrationId = registrationOrOrderOrStar?.registration_id || registrationOrOrderOrStar?.id;
    if (registrationId) {
        return `/account/registrations/${registrationId}`;
    }
    const transactionId = registrationOrOrderOrStar?.id || registrationOrOrderOrStar?.transaction_id;
    const star = registrationOrOrderOrStar?.star || registrationOrOrderOrStar;
    return `/account/stars/${transactionId}/${getStarSlug(star)}`;
};

export const getOrderPath = (transactionId) => `/account/orders/${transactionId}`;

export const formatMoney = (amount, currency) =>
    new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: (currency || 'gbp').toUpperCase(),
    }).format(amount || 0);

export const formatDate = (value) => {
    if (!value) {
        return 'Pending';
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
};

export const formatDateTime = (value) => {
    if (!value) {
        return 'Pending';
    }

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(value));
};

export const getDeliveryLabel = (order) => (
    order?.shipping_required ? 'Physical certificate fulfilment' : 'Digital certificate ready now'
);

export const getVisibilityLabel = () => 'Visible in the registry when someone searches this star';

export const formatClaimStatus = (value) => (
    (value || 'not_claimable')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase())
);

export const formatOrderStatus = (value) => (
    (value || 'pending')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase())
);

export const getUserInitials = (user) => {
    const source = user?.full_name || user?.email || 'AA';
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
};
