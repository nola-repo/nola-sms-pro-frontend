import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret, X-GHL-Location-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const locationId = req.headers['x-ghl-location-id'] || req.query.location_id;

    if (!locationId) {
      return res.status(400).json({ success: false, error: 'Missing location_id parameter or header' });
    }

    const cloudRunUrl = `${CLOUD_RUN_URL}/api/account?location_id=${locationId}`;
    console.log(`Proxying GET to:`, cloudRunUrl);

    const response = await fetch(cloudRunUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
        'X-GHL-Location-ID': Array.isArray(locationId) ? locationId[0] : locationId,
      },
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Account Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Proxy failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
