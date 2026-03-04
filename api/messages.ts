import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io/api/messages";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for the response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Webhook-Secret, Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Build query string from request query params
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (value) {
        queryParams.append(key, Array.isArray(value) ? value[0] : value);
      }
    }

    // Forward request to Cloud Run
    const cloudRunUrl = `${CLOUD_RUN_URL}?${queryParams.toString()}`;
    console.log('Proxying to:', cloudRunUrl);
    
    const response = await fetch(cloudRunUrl, {
      method: 'GET', // Force GET for messages
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('Cloud Run response:', data);
    
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
