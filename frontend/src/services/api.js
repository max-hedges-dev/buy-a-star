const API_URL = "http://127.0.0.1:8000/api/v1";
const STARS_URL = `${API_URL}/stars/`;
const STARS_CACHE_PREFIX = 'aster-atlas-stars-cache:';
const STARS_CACHE_TTL_MS = 60 * 1000;

const getStarsCacheKey = (params) => `${STARS_CACHE_PREFIX}${params.toString()}`;

const readStarsCache = (cacheKey) => {
    try {
        const rawValue = window.localStorage.getItem(cacheKey);
        if (!rawValue) return null;

        const parsedValue = JSON.parse(rawValue);
        if (!parsedValue.timestamp || !Array.isArray(parsedValue.data)) return null;

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
    if (cachedData) {
        return cachedData;
    }

    const response = await fetch(`${STARS_URL}?${params}`);
    if (!response.ok) {
        throw new Error("Failed to fetch stars");
    }
    const data = await response.json();
    writeStarsCache(cacheKey, data);
    return data;
}

export async function fetchStarById(id) {
    const response = await fetch(`${STARS_URL}${id}`);
    if (!response.ok) {
        throw new Error("Failed to fetch star");
    }
    return response.json();
}

export async function buyStar(id, ownerName, includeCertificate) {
    const response = await fetch(`${STARS_URL}${id}/buy`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            owner_name: ownerName,
            include_certificate: includeCertificate,
            payment_method: 'paypal_mock'
        }),
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to buy star");
    }
    clearStarsCache();
    return response.json();
}
