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
      // Fetch contacts from GHL using search endpoint
      const searchUrl = `${GHL_API_URL}/contacts/search`;
      
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          locationId: LOCATION_ID,
          limit: 100
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GHL API Error:', response.status, errorText);
        return res.status(response.status).json({ 
          error: 'Failed to fetch contacts from GHL',
          details: errorText 
        });
      }

      const data = await response.json();
      
      // Transform GHL contacts to our format
      const contacts = (data.contacts || []).map((contact: any) => ({
        id: contact.id,
        name: contact.name || contact.firstName + ' ' + (contact.lastName || ''),
        phone: contact.phone || contact.mobileNumber || '',
        email: contact.email || '',
      })).filter((c: any) => c.phone); // Only include contacts with phone

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
