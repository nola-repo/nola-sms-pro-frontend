import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from 'vite'

// Custom Vite plugin to handle SMS proxy
const smsProxyPlugin = () => ({
  name: 'sms-proxy',
  configureServer(server: ViteDevServer) {
    // 1. Specific handler for SMS (needs payload wrapping)
    server.middlewares.use('/api/sms', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const { number, message, sendername } = JSON.parse(body);
            const payload = {
              customData: {
                number: number || '',
                message: message || '',
                sendername: sendername || 'NOLASMSPro',
              }
            };

            const response = await fetch('https://smspro-api.nolacrm.io/webhook/send_sms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
              },
              body: JSON.stringify(payload),
            });

            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (error) {
            console.error('Vite Proxy Error (/api/sms):', error);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'error', message: 'Failed to send SMS' }));
          }
        });
      }
    });

    // 2. Specific handler for /webhook/send_sms
    server.middlewares.use('/webhook/send_sms', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          try {
            const response = await fetch('https://smspro-api.nolacrm.io/webhook/send_sms', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
              },
              body,
            });
            const data = await response.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          } catch (error) {
            console.error('Vite Proxy Error (/webhook/send_sms):', error);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'error', message: 'Failed to send SMS' }));
          }
        });
      }
    });

    // 3. Generic API Proxy for /api/* 
    server.middlewares.use('/api', async (req, res, next) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      let path = url.pathname;
      const method = req.method || 'GET';

      try {
        let cloudRunUrl = `https://smspro-api.nolacrm.io/api${path}${url.search}`;

        // Specific Rerouting Logic
        if (path === '/contacts') {
          // Map /api/contacts to backend /api/ghl-contacts
          cloudRunUrl = `https://smspro-api.nolacrm.io/api/ghl-contacts${url.search}`;
        } else if (path === '/messages' && (method === 'PUT' || method === 'DELETE')) {
          // Map /api/messages (PUT/DELETE) to backend /api/conversations
          cloudRunUrl = `https://smspro-api.nolacrm.io/api/conversations${url.search}`;
        }

        console.log(`Dev proxy (${method}):`, cloudRunUrl);

        const response = await fetch(cloudRunUrl, {
          method: method,
          headers: {
            'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
            'Content-Type': 'application/json',
            ...(req.headers['x-ghl-location-id'] ? { 'X-GHL-Location-ID': req.headers['x-ghl-location-id'] as string } : {}),
            ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] as string } : {}),
          },
          body: (method !== 'GET' && method !== 'HEAD') ? req : undefined,
          // @ts-ignore
          duplex: 'half'
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        } else {
          const text = await response.text();
          console.error(`Backend non-JSON response for ${path}:`, response.status);
          res.statusCode = response.status;
          res.end(text);
        }
      } catch (error) {
        console.error(`Dev proxy error for /api${path}:`, error);
        next(); // Fallback to SPA if it really blows up
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), smsProxyPlugin()],
})
