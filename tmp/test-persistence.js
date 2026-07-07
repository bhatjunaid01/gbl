// Verify previously created challans still exist after server restart
const http = require('http');

const challansToCheck = ['PERSIST-TEST-123', 'PERSIST-TEST-456'];

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== Verifying challan persistence after server restart ===\n');
  
  for (const challanNo of challansToCheck) {
    console.log(`--- Checking ${challanNo} ---`);
    
    // Check API endpoint
    const api = await request('GET', `/api/challans/${encodeURIComponent(challanNo)}`);
    console.log(`  API status: ${api.status}`);
    if (api.status === 200) {
      const data = JSON.parse(api.body);
      console.log(`  Challan Number: ${data.challanNumber}`);
      console.log(`  QR URL: ${data.qrUrl}`);
      console.log(`  Created At: ${data.createdAt}`);
    } else {
      console.log(`  ERROR: ${api.body}`);
    }

    // Check HTML verification page
    const page = await request('GET', `/challan/${encodeURIComponent(challanNo)}`);
    console.log(`  QR Page status: ${page.status}`);
    console.log(`  Page contains challan: ${page.body.includes(challanNo)}`);
    console.log('');
  }
}

main().catch(console.error);
