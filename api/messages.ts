import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for the response
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Webhook-Secret, Content-Type, X-GHL-Location-ID');
  res.setHeader('Content-Type', 'application/json');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get Location ID from headers or query
  const locationId = req.headers['x-ghl-location-id'] || req.query.location_id;
  const forwardedLocationId = Array.isArray(locationId) ? locationId[0] : locationId;

  try {
    // Route based on action parameter
    const action = req.query.action as string;

    if (action === 'fetch_bulk_messages') {
      // Fetch all bulk messages from Firestore
      const cloudRunUrl = forwardedLocationId
        ? `${CLOUD_RUN_URL}/api/bulk-campaigns?location_id=${encodeURIComponent(forwardedLocationId)}`
        : `${CLOUD_RUN_URL}/api/bulk-campaigns`;
      console.log('Proxying fetch_bulk_messages to:', cloudRunUrl);

      const response = await fetch(cloudRunUrl, {
        method: 'GET',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
          ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (action === 'fetch_conversations') {
      // Fetch all conversations from Firestore.
      // Returns [] gracefully if the Cloud Run endpoint isn't deployed yet.
      const cloudRunUrl = forwardedLocationId 
        ? `${CLOUD_RUN_URL}/api/conversations?location_id=${encodeURIComponent(forwardedLocationId)}`
        : `${CLOUD_RUN_URL}/api/conversations`;
      console.log('Proxying fetch_conversations to:', cloudRunUrl);

      const response = await fetch(cloudRunUrl, {
        method: 'GET',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
          ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
        },
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    // Route based on method
    if (req.method === 'GET') {
      // GET /api/messages - fetch messages, forwarding all query params as-is
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (value && key !== 'action') {
          queryParams.append(key, Array.isArray(value) ? value[0] : value);
        }
      }

      const cloudRunUrl = `${CLOUD_RUN_URL}/api/messages?${queryParams.toString()}`;
      console.log('Proxying GET to:', cloudRunUrl);

      const response = await fetch(cloudRunUrl, {
        method: 'GET',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
          ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
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
          ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      console.log('Cloud Run SMS response:', data);
      return res.status(response.status).json(data);
    } else if (req.method === 'PUT') {
      // PUT /api/messages - Update conversation (e.g., rename)
      const cloudRunUrl = `${CLOUD_RUN_URL}/api/conversations`;
      console.log('Proxying PUT to:', cloudRunUrl);

      const response = await fetch(cloudRunUrl, {
        method: 'PUT',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
          ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else if (req.method === 'DELETE') {
      // DELETE /api/messages - Delete conversation
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (value && key !== 'action') {
          queryParams.append(key, Array.isArray(value) ? value[0] : value);
        }
      }

      const cloudRunUrl = `${CLOUD_RUN_URL}/api/conversations?${queryParams.toString()}`;
      console.log('Proxying DELETE to:', cloudRunUrl);

      const response = await fetch(cloudRunUrl, {
        method: 'DELETE',
        headers: {
          'X-Webhook-Secret': WEBHOOK_SECRET,
          'Content-Type': 'application/json',
          ...(forwardedLocationId ? { 'X-GHL-Location-ID': forwardedLocationId } : {}),
        },
      });

      const data = await response.json();
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
