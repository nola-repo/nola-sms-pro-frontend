const https = require('https');

const req = https.request('https://smspro-api.nolacrm.io/api/admin_sender_requests.php', {
  method: 'GET',
  headers: {
    'X-Webhook-Secret': 'f7RkQ2pL9zV3tX8cB1nS4yW6'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${data}`);
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
