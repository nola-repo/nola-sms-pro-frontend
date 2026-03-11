import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Map /api/ghl_oauth to backend /api/ghl_oauth
    const cloudRunUrl = `${CLOUD_RUN_URL}/api/ghl_oauth`;

    console.log(`Proxying ${req.method} to:`, cloudRunUrl);

    const response = await fetch(cloudRunUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('OAuth Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Proxy failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
