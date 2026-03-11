import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Webhook-Secret, Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const locationId = req.headers['x-ghl-location-id'] || req.query.location_id;
        const forwardedLocationId = Array.isArray(locationId) ? locationId[0] : locationId;

        const cloudRunUrl = `${CLOUD_RUN_URL}/api/credits`;
        console.log('Proxying balance GET to:', cloudRunUrl);

        const response = await fetch(cloudRunUrl, {
            method: 'GET',
            headers: {
                'X-Webhook-Secret': WEBHOOK_SECRET,
                'Content-Type': 'application/json',
                ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
            },
        });

        if (!response.ok) {
            console.error('Credits Proxy Error:', response.status);
            return res.status(200).json({ balance: 0, status: 'error' });
        }

        const data = await response.json();

        // Map credit_balance (backend) to balance (frontend)
        return res.status(200).json({
            ...data,
            balance: data.credit_balance ?? 0
        });
    } catch (error) {
        console.error('Balance Proxy Internal Error:', error);
        return res.status(200).json({ balance: 0, error: 'Internal proxy error' });
    }
}
