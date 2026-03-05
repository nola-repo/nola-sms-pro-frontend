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
    const cloudRunUrl = `${CLOUD_RUN_URL}/api/fetch_bulk_messages`;
    console.log('Proxying fetch_bulk_messages to:', cloudRunUrl);
    
    const response = await fetch(cloudRunUrl, {
      method: 'GET',
      headers: {
        'X-Webhook-Secret': WEBHOOK_SECRET,
        'Content-Type': 'application/json',
      },
    });

    // Get response as text first to check for errors
    const responseText = await response.text();
    console.log('Cloud Run response text:', responseText.substring(0, 500));
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Cloud Run response as JSON:', parseErr);
      return res.status(500).json({
        success: false,
        error: 'Cloud Run returned non-JSON response',
        message: responseText.substring(0, 200),
      });
    }
    
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
