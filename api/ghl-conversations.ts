import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Webhook-Secret, X-GHL-Location-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const cloudRunUrl = `${CLOUD_RUN_URL}/api/ghl-conversations`;

    console.log(`Proxying ${req.method} to:`, cloudRunUrl);

    const headers: Record<string, string> = {
      'X-Webhook-Secret': WEBHOOK_SECRET,
      'Content-Type': 'application/json',
    };

    // Forward location ID from frontend if present
    const locationId = req.headers['x-ghl-location-id'] || req.query.location_id;
    if (locationId) {
      headers['X-GHL-Location-ID'] = Array.isArray(locationId) ? locationId[0] : locationId;
    }

    const response = await fetch(cloudRunUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('GHL Conversations Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Proxy failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
