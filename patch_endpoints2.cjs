const fs = require('fs');
let code = fs.readFileSync('server/routes/endpoints.js', 'utf8');

// Import runSyncJob
code = "import { runSyncJob } from '../syncEngine.js';\n" + code;

// Remove runSyncJob from endpoints.js
const regex = /async function runSyncJob[\s\S]*?router\.post\('\/:id\/sync',/m;
code = code.replace(regex, "router.post('/:id/sync',");

// Update router.post('/:id/sync')
const syncRegex = /res\.json\(\{ message: 'Sync started' \}\);\s+\/\/ Start background process detached\s+runSyncJob\(endpointId, skipOffset\)\.catch\(err => console\.error\('Background job error:', err\)\);/;
const newSyncCode = `res.json({ message: 'Sync started' });

    // Netlify Background Function handling
    if (process.env.NETLIFY) {
      const host = req.headers.host || 'localhost:8888';
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      fetch(\`\${proto}://\${host}/.netlify/functions/sync-background\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointIdStr: endpointId, skipOffset })
      }).catch(err => console.error('Failed to trigger background function', err));
    } else {
      runSyncJob(endpointId.toString(), skipOffset).catch(err => console.error('Background job error:', err));
    }`;

code = code.replace(syncRegex, newSyncCode);

fs.writeFileSync('server/routes/endpoints.js', code);
console.log('Successfully updated endpoints.js');
