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
    if (req.method === 'GET') {
      // First try the webhook that extracts contacts from sms_logs (phone numbers)
      const webhookUrl = `${CLOUD_RUN_URL}/webhook/fetch_contacts`;
      console.log('Fetching contacts from:', webhookUrl);
      
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Webhook error:', response.status, errorText);
        // Try the direct API as fallback
        return fetchFromContactsAPI(req, res);
      }

      const data = await response.json();
      console.log('Contacts from webhook:', data);
      return res.status(response.status).json(data);
    } else if (req.method === 'POST') {
      // Create new contact
      return fetchFromContactsAPI(req, res);
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

async function fetchFromContactsAPI(req: VercelRequest, res: VercelResponse) {
  // Try direct contacts API
  const cloudRunUrl = `${CLOUD_RUN_URL}/api/contacts`;
  console.log('Fetching from contacts API:', cloudRunUrl);
  
  const response = await fetch(cloudRunUrl, {
    method: 'GET',
    headers: {
      'X-Webhook-Secret': WEBHOOK_SECRET,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log('Contacts API response:', data);
  return res.status(response.status).json(data);
}
