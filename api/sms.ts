import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUD_RUN_URL = "https://smspro-api.nolacrm.io";
const WEBHOOK_SECRET = "f7RkQ2pL9zV3tX8cB1nS4yW6";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Webhook-Secret, Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    });
  }

  try {
    // Forward the existing body if it has customData, otherwise wrap it
    const payload = req.body?.customData ? req.body : { customData: req.body };

    // Ensure number is formatted if it exists inside customData
    if (payload.customData?.number) {
      let formattedNumber = payload.customData.number;
      if (typeof formattedNumber === 'string') {
        if (formattedNumber.startsWith('+63')) {
          formattedNumber = '0' + formattedNumber.substring(3);
        } else if (formattedNumber.startsWith('639')) {
          formattedNumber = '0' + formattedNumber.substring(2);
        } else if (formattedNumber.startsWith('9') && formattedNumber.length === 10) {
          formattedNumber = '0' + formattedNumber;
        }
        payload.customData.number = formattedNumber;
      }
    }

    const targetUrl = `${CLOUD_RUN_URL}/webhook/send_sms`;
    console.log('Proxying SMS to:', targetUrl);

    const webhookResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text().catch(() => 'No body');
      console.error('Backend SMS Error:', webhookResponse.status, errorText);

      let parsedError = {};
      try { parsedError = JSON.parse(errorText); } catch { }

      return res.status(webhookResponse.status).json({
        status: 'error',
        message: 'Backend rejected SMS',
        details: errorText.substring(0, 500) || `HTTP ${webhookResponse.status} from backend`,
        ...(typeof parsedError === 'object' ? parsedError : {})
      });
    }

    const data = await webhookResponse.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('SMS Proxy Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to proxy SMS',
      details: error.message
    });
  }
}
