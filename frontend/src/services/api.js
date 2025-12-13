const API_URL = "http://127.0.0.1:8000/api/v1";

export async function fetchStars({ skip = 0, limit = 100, search = "" } = {}) {
    const params = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
        ...(search && { search }),
    });

    const response = await fetch(`${API_URL}/stars?${params}`);
    if (!response.ok) {
        throw new Error("Failed to fetch stars");
    }
    return response.json();
}

export async function fetchStarById(id) {
    const response = await fetch(`${API_URL}/stars/${id}`);
    if (!response.ok) {
        throw new Error("Failed to fetch star");
    }
    return response.json();
}

export async function buyStar(id, ownerName, includeCertificate) {
    const response = await fetch(`${API_URL}/stars/${id}/buy`, {
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
    return response.json();
}
