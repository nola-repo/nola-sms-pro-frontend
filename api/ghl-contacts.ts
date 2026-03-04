import type { VercelRequest, VercelResponse } from '@vercel/node';

const GHL_API_URL = "https://services.leadconnectorhq.com";
const GHL_API_TOKEN = "sxtUvcl8Sm3ki3TRQz3x";
const LOCATION_ID = "pit-34cb9a15-8bbe-49a8-b73d-b57e935c9ad9";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Try different GHL endpoints
      const endpoints = [
        // Try contacts/list first
        `${GHL_API_URL}/contacts/list?locationId=${LOCATION_ID}&limit=100`,
        // Fallback to contacts/search
        `${GHL_API_URL}/contacts/search?locationId=${LOCATION_ID}&limit=100`,
      ];
      
      let data = null;
      let lastError = null;
      
      for (const url of endpoints) {
        try {
          console.log('Trying GHL endpoint:', url);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${GHL_API_TOKEN}`,
              'Content-Type': 'application/json',
              'Version': '2021-07-28'
            }
          });

          if (response.ok) {
            data = await response.json();
            console.log('GHL API Success:', url);
            break;
          } else {
            const errorText = await response.text();
            console.log('GHL endpoint failed:', response.status, errorText);
            lastError = { status: response.status, text: errorText };
          }
        } catch (e) {
          lastError = e;
        }
      }
      
      if (!data) {
        console.error('All GHL endpoints failed:', lastError);
        return res.status(lastError?.status || 500).json({ 
          error: 'Failed to fetch contacts from GHL',
          details: lastError?.text || lastError?.message 
        });
      }
      
      // Transform GHL contacts to our format
      const contacts = (data.contacts || data.users || []).map((contact: any) => ({
        id: contact.id,
        name: contact.name || contact.firstName + ' ' + (contact.lastName || ''),
        phone: contact.phone || contact.mobileNumber || '',
        email: contact.email || '',
      })).filter((c: any) => c.phone);

      return res.status(200).json(contacts);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('GHL Contacts Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch contacts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
