import type { VercelRequest, VercelResponse } from '@vercel/node';

const GHL_API_URL = "https://services.leadconnectorhq.com";
const GHL_LOCATION_ID = "ugBqfQsPtGijLjrmLdmA";
const GHL_API_TOKEN = "pit-9c4000ad-590a-47b6-8572-e919dc20d39c";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Try different GHL endpoints
      const endpoints = [
        `${GHL_API_URL}/contacts/search?locationId=${GHL_LOCATION_ID}&limit=100`,
        `${GHL_API_URL}/contacts?locationId=${GHL_LOCATION_ID}&limit=100`,
        `${GHL_API_URL}/contacts/list?locationId=${GHL_LOCATION_ID}&limit=100`,
      ];
      
      let lastError: { status?: number; text?: string; message?: string } | null = null;
      let data = null;
      
      for (const url of endpoints) {
        try {
          console.log('Trying GHL endpoint:', url);
          const response = await fetch(url, {
            method: 'POST', // Try POST for search
            headers: {
              'Authorization': `Bearer ${GHL_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              locationId: GHL_LOCATION_ID,
              limit: 100
            })
          });

          if (response.ok) {
            data = await response.json();
            console.log('GHL API Success:', url);
            break;
          } else {
            const errorText = await response.text();
            console.log('GHL endpoint failed:', response.status, errorText);
            lastError = { status: response.status, text: errorText };
            
            // Try GET if POST fails
            const getResponse = await fetch(url.replace('POST', 'GET').replace('search?', '?'), {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${GHL_API_TOKEN}`,
                'Content-Type': 'application/json',
              }
            });
            
            if (getResponse.ok) {
              data = await getResponse.json();
              console.log('GHL API Success with GET:', url);
              break;
            }
          }
        } catch (e: unknown) {
          const err = e instanceof Error ? { message: e.message } : { message: 'Unknown error' };
          lastError = err;
        }
      }
      
      if (!data) {
        console.error('All GHL endpoints failed:', lastError);
        return res.status(401).json({ 
          error: 'Failed to authenticate with GHL',
          details: lastError?.text || lastError?.message 
        });
      }
      
      // Handle GHL response format
      let contacts: any[] = [];
      if (Array.isArray(data)) {
        contacts = data;
      } else if (data.contacts) {
        contacts = data.contacts;
      } else if (data.data) {
        contacts = data.data;
      }
      
      // Transform to our format
      const transformedContacts = contacts.map((contact: any) => ({
        id: contact.id,
        name: contact.name || contact.firstName + ' ' + (contact.lastName || ''),
        phone: contact.phone || contact.mobileNumber || '',
        email: contact.email || '',
      })).filter((c: any) => c.phone);
      
      console.log('Transformed contacts:', transformedContacts.length);
      return res.status(200).json(transformedContacts);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('GHL API Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch contacts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
