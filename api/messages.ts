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
    // Route based on method
    if (req.method === 'GET') {
      // Try fetch_logs endpoint first (has number filter)
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (value) {
          queryParams.append(key, Array.isArray(value) ? value[0] : value);
        }
      }
      
      // Try fetch_logs first (filters by number)
      let cloudRunUrl = `${CLOUD_RUN_URL}/webhook/fetch_logs?${queryParams.toString()}`;
      console.log('Trying fetch_logs:', cloudRunUrl);
      
      let response = await fetch(cloudRunUrl, {
        method: 'GET',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
        },
      });

      let data = await response.json();
      console.log('fetch_logs response:', data);
      
      // If fetch_logs doesn't return valid data, fall back to messages
      if (!data.data || data.data.length === 0) {
        cloudRunUrl = `${CLOUD_RUN_URL}/webhook/messages?${queryParams.toString()}`;
        console.log('Fallback to messages:', cloudRunUrl);
        
        response = await fetch(cloudRunUrl, {
          method: 'GET',
          headers: {
            'X-Webhook-Secret': WEBHOOK_SECRET,
            'Content-Type': 'application/json',
          },
        });
        
        data = await response.json();
        console.log('messages response:', data);
      }
      
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
