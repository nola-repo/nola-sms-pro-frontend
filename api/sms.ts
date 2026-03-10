import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    });
  }

  try {
    // Parse the form data from request body
    const { number, message, sendername, batch_id, name, recipient_key } = req.body?.customData || req.body || {};

    let formattedNumber = number || '';
    // Format Philippine phone numbers - the webhook expects 09xxxxxxxxx format
    if (formattedNumber.startsWith('+63')) {
      formattedNumber = '0' + formattedNumber.substring(3);
    } else if (formattedNumber.startsWith('639')) {
      formattedNumber = '0' + formattedNumber.substring(2);
    } else if (formattedNumber.startsWith('09') && formattedNumber.length === 11) {
      // Already in correct format
    } else if (formattedNumber.startsWith('9') && formattedNumber.length === 10) {
      formattedNumber = '0' + formattedNumber;
    }

    // Rebuild the body with all supported fields
    const payload = {
      customData: {
        number: formattedNumber,
        message: message || '',
        sendername: sendername || 'NOLACRM',
        batch_id,
        name,
        recipient_key
      }
    };

    const targetUrl = 'https://smspro-api.nolacrm.io/webhook/send_sms';
    console.log('Proxying SMS to:', targetUrl, 'for', formattedNumber);

    const webhookResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
      },
      body: JSON.stringify(payload),
    });

    const errorText = !webhookResponse.ok ? await webhookResponse.text().catch(() => 'No body') : '';
    if (!webhookResponse.ok) {
      console.error('Backend SMS Error:', webhookResponse.status, errorText);
      let parsedError = {};
      try { parsedError = JSON.parse(errorText); } catch { }

      return res.status(webhookResponse.status).json({
        status: 'error',
        message: 'Backend rejected SMS',
        details: errorText.substring(0, 500),
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
