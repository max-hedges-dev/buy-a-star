import { apiRequest } from './http';

const STARS_URL = '/stars/';
const STARS_CACHE_PREFIX = 'aster-atlas-stars-cache:v2:';
const STARS_CACHE_TTL_MS = 60 * 1000;

const getStarsCacheKey = (params) => `${STARS_CACHE_PREFIX}${params.toString()}`;

const readStarsCache = (cacheKey) => {
    try {
        const rawValue = window.localStorage.getItem(cacheKey);
        if (!rawValue) return null;

        const parsedValue = JSON.parse(rawValue);
        if (!parsedValue.timestamp || parsedValue.data === undefined) return null;

        const isExpired = Date.now() - parsedValue.timestamp > STARS_CACHE_TTL_MS;
        if (isExpired) {
            window.localStorage.removeItem(cacheKey);
            return null;
        }

        return parsedValue.data;
    } catch {
        return null;
    }
};

const writeStarsCache = (cacheKey, data) => {
    try {
        window.localStorage.setItem(
            cacheKey,
            JSON.stringify({
                timestamp: Date.now(),
                data,
            })
        );
    } catch {
        // Ignore cache write failures.
    }
};

const clearStarsCache = () => {
    try {
        const keysToDelete = [];
        for (let index = 0; index < window.localStorage.length; index += 1) {
            const key = window.localStorage.key(index);
            if (key && key.startsWith(STARS_CACHE_PREFIX)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => window.localStorage.removeItem(key));
    } catch {
        // Ignore cache clear failures.
    }
};

export async function fetchStars({ skip = 0, limit = 100, search = "", isBought = undefined } = {}) {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        ...(search && { search }),
        ...(isBought !== undefined && { is_bought: isBought })
    });
    const cacheKey = getStarsCacheKey(params);
    const cachedData = readStarsCache(cacheKey);
    if (cachedData !== null) {
        return cachedData;
    }

    const data = await apiRequest(`${STARS_URL}?${params}`);
    writeStarsCache(cacheKey, data);
    return data;
}

export async function fetchStarCatalogue({
    page = 1,
    pageSize = 24,
    search = "",
    status = "all",
    colour = "all",
    constellation = "all",
    starType = "all",
    minDistanceLy = undefined,
    maxDistanceLy = undefined,
    minPrice = undefined,
    maxPrice = undefined,
    sortBy = "alphabetical",
} = {}) {
    const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString(),
        status,
        colour,
        constellation,
        star_type: starType,
        sort_by: sortBy,
        ...(search && { search }),
        ...(Number.isFinite(minDistanceLy) && minDistanceLy > 0
            ? { min_distance_ly: minDistanceLy.toString() }
            : {}),
        ...(Number.isFinite(maxDistanceLy) && maxDistanceLy > 0
            ? { max_distance_ly: maxDistanceLy.toString() }
            : {}),
        ...(Number.isFinite(minPrice) && minPrice > 0
            ? { min_price: minPrice.toString() }
            : {}),
        ...(Number.isFinite(maxPrice) && maxPrice > 0
            ? { max_price: maxPrice.toString() }
            : {}),
    });
    const cacheKey = getStarsCacheKey(new URLSearchParams(`catalogue=1&${params.toString()}`));
    const cachedData = readStarsCache(cacheKey);
    if (cachedData !== null) {
        return cachedData;
    }

    const data = await apiRequest(`${STARS_URL}catalogue?${params}`);
    writeStarsCache(cacheKey, data);
    return data;
}

export async function fetchStarById(id) {
    return apiRequest(`${STARS_URL}${id}`);
}

export async function fetchStarBySlug(slug) {
    return apiRequest(`${STARS_URL}slug/${encodeURIComponent(slug)}`);
}

export async function createCheckoutSession({
    starId,
    ownerName,
    certificateType,
    countryCode,
    acceptedTerms,
    acceptedPrivacy,
}) {
    return apiRequest('/checkout/session', {
        method: 'POST',
        body: {
            star_id: starId,
            owner_name: ownerName,
            certificate_type: certificateType,
            country_code: countryCode,
            accepted_terms: acceptedTerms,
            accepted_privacy: acceptedPrivacy,
        },
    });
}

export async function fetchCheckoutOptions(countryCode, starId = null) {
    const params = new URLSearchParams({
        country_code: countryCode,
        ...(starId ? { star_id: starId.toString() } : {}),
    });
    const response = await apiRequest(`/checkout/options?${params.toString()}`);

    if (typeof response?.star_price === 'number') {
        return response;
    }

    const fallbackStarPrice = typeof response?.named_star_price === 'number'
        ? response.named_star_price
        : typeof response?.unnamed_star_price === 'number'
            ? response.unnamed_star_price
            : 0;
    const fallbackMinorUnits = typeof response?.named_star_price_minor_units === 'number'
        ? response.named_star_price_minor_units
        : typeof response?.unnamed_star_price_minor_units === 'number'
            ? response.unnamed_star_price_minor_units
            : Math.round(fallbackStarPrice * 100);

    return {
        ...response,
        star_price: fallbackStarPrice,
        star_price_minor_units: fallbackMinorUnits,
    };
}

export async function fetchCheckoutSessionStatus(sessionId) {
    const data = await apiRequest(`/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`);
    if (data.fulfilled) {
        clearStarsCache();
    }
    return data;
}

export async function fetchAccountOverview() {
    return apiRequest('/account/overview');
}

export async function fetchAccountOrder(transactionId) {
    return apiRequest(`/account/orders/${transactionId}`);
}
