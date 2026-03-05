import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Webhook-Secret, Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Fetch all bulk messages from Firestore via Cloud Run
    const cloudRunUrl = `${CLOUD_RUN_URL}/webhook/fetch_bulk_messages`;
    console.log('Proxying fetch_bulk_messages to:', cloudRunUrl);
    
    const response = await fetch(cloudRunUrl, {
      method: 'GET',
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('Cloud Run response:', data);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Fetch Bulk Messages Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch bulk messages',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
