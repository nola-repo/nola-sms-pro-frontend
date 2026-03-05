import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
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
    // Route based on action parameter
    const action = req.query.action as string;
    const batch_id = req.query.batch_id as string;
    const recipient_key = req.query.recipient_key as string;
    
    if (action === 'fetch_bulk_messages') {
      // Fetch all bulk messages from Firestore
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
      return res.status(response.status).json(data);
    }
    
    // Route based on method
    if (req.method === 'GET') {
      // GET /api/messages - fetch messages
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (value) {
          queryParams.append(key, Array.isArray(value) ? value[0] : value);
        }
      }
      
      // Forward batch_id OR recipient_key to Cloud Run
      let cloudRunUrl = `${CLOUD_RUN_URL}/api/messages?${queryParams.toString()}`;
      
      // If no specific filter provided, add default filters
      if (!batch_id && !recipient_key && !req.query.number) {
        // Get outbound messages only
        cloudRunUrl = `${CLOUD_RUN_URL}/api/messages?direction=outbound&${queryParams.toString()}`;
      }
      
      console.log('Proxying GET to:', cloudRunUrl);
      
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
    } else if (req.method === 'POST') {
      // POST /api/messages - send SMS
      const cloudRunUrl = `${CLOUD_RUN_URL}/webhook/send_sms`;
      console.log('Proxying POST to:', cloudRunUrl);
      console.log('Request body:', req.body);
      
      const response = await fetch(cloudRunUrl, {
        method: 'POST',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      console.log('Cloud Run SMS response:', data);
      return res.status(response.status).json(data);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Proxy failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
