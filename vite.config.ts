import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer } from 'vite'

// Custom Vite plugin to handle SMS proxy
const smsProxyPlugin = () => ({
  name: 'sms-proxy',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/api', async (req, res, next) => {
      // If it's a POST/PUT/DELETE or specific GET that we want to proxy to the real backend
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const path = url.pathname;

      // We already have specific handlers for some paths, but let's make a generic one for /api/*
      // that forwards to https://smspro-api.nolacrm.io/api/*

      // Skip if already handled by other specific middlewares (though next() would be called anyway)
      if (['/api/sms', '/webhook/send_sms', '/api/credits', '/api/ghl-contacts'].some(p => path.startsWith(p))) {
        return next();
      }

      try {
        const cloudRunUrl = `https://smspro-api.nolacrm.io${path}${url.search}`;
        console.log('Dev proxy (API):', cloudRunUrl);

        const response = await fetch(cloudRunUrl, {
          method: req.method || 'GET',
          headers: {
            'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
            'Content-Type': 'application/json',
            ...(req.headers['x-ghl-location-id'] ? { 'X-GHL-Location-ID': req.headers['x-ghl-location-id'] as string } : {}),
          },
          body: (req.method !== 'GET' && req.method !== 'HEAD') ? req : undefined,
          // @ts-ignore - fetch in node handles stream bodies
          duplex: 'half'
        });

        const data = await response.json();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } catch (error) {
        // Only log if it's not a 404 which might be handled by next()
        console.error(`Dev proxy error for ${path}:`, error);
        next();
      }
    });

    // Keeping specific ones for SMS because of payload wrapping logic
    server.middlewares.use('/api/sms', async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const { number, message, sendername } = JSON.parse(body);

            // Rebuild the body with the customData wrapper as JSON
            const payload = {
              customData: {
                number: number || '',
                message: message || '',
                sendername: sendername || 'NOLACRM',
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
            console.error('Vite Proxy Error:', error);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'error', message: 'Failed to send SMS via proxy' }));
          }
        });
      }
    });

    // Dev proxy for /webhook/send_sms (matches the relative path used by sms.ts)
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
            console.error('Dev proxy error for /webhook/send_sms:', error);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ status: 'error', message: 'Failed to send SMS' }));
          }
        });
      }
    });


    server.middlewares.use('/api/credits', async (_req, res) => {
      try {
        const cloudRunUrl = 'https://smspro-api.nolacrm.io/api/credits';
        const response = await fetch(cloudRunUrl, {
          method: 'GET',
          headers: {
            'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } catch (error) {
        console.error('Dev proxy error for /api/credits:', error);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'Failed to fetch credits from backend' }));
      }
    });

    server.middlewares.use('/api/contacts', (_req, res) => {
      const mockContacts = [
        { id: '1', name: 'Raely Ivan Reyes', phone: '0976 173 1036' },
        { id: '2', name: 'David Monzon', phone: '0970 812 9927' },
        { id: '3', name: 'Nola Support', phone: '09987654321' },
        { id: '4', name: 'John Doe', phone: '09223334445' },
        { id: '5', name: 'Jane Smith', phone: '09556667778' },
      ];
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(mockContacts));
    });

    // Dev proxy for /api/ghl-contacts → forwards to real backend
    server.middlewares.use('/api/ghl-contacts', async (req, res) => {
      try {
        const url = new URL(req.url || '', 'http://localhost');
        const cloudRunUrl = `https://smspro-api.nolacrm.io/api/ghl-contacts${url.search}`;
        const response = await fetch(cloudRunUrl, {
          method: req.method || 'GET',
          headers: {
            'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6',
            'Content-Type': 'application/json',
            ...(req.headers['x-ghl-location-id'] ? { 'X-GHL-Location-ID': req.headers['x-ghl-location-id'] as string } : {}),
          },
        });
        const data = await response.json();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      } catch (error) {
        console.error('Dev proxy error for /api/ghl-contacts:', error);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: 'Failed to fetch GHL contacts' }));
      }
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), smsProxyPlugin()],
})
