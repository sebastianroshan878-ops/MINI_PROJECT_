require('dotenv').config();
const http = require('http');
const connectDB = require('../config/db');
const app = require('../server');

async function runTests() {
  console.log('--------------------------------------------------');
  console.log(' RestaurantPro API Smoke Test');
  console.log('--------------------------------------------------\n');

  let baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  let tempServer = null;

  // Check if server is already running on port 5000
  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      console.log(`[Info] Connected to existing server at ${baseUrl}\n`);
    } else {
      throw new Error('Not running');
    }
  } catch (err) {
    // Start ephemeral server
    console.log('[Info] Starting test instance with in-process server...');
    await connectDB();
    tempServer = await new Promise((resolve) => {
      const server = app.listen(0, () => {
        const address = server.address();
        baseUrl = `http://localhost:${address.port}`;
        console.log(`[Info] Ephemeral test server running at ${baseUrl}\n`);
        resolve(server);
      });
    });
  }

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    process.stdout.write(`Testing ${name}... `);
    try {
      await fn();
      console.log('\x1b[32mPASSED\x1b[0m');
      passed++;
    } catch (testErr) {
      console.log('\x1b[31mFAILED\x1b[0m');
      console.error(`  Error: ${testErr.message}`);
      failed++;
    }
  }

  async function apiGet(path) {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res.json();
  }

  async function apiPost(path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }

  try {
    // 1. Health check
    await check('Health Endpoint (GET /api/health)', async () => {
      const data = await apiGet('/api/health');
      if (data.status !== 'ok' || data.app !== 'RestaurantPro') {
        throw new Error(`Unexpected health payload: ${JSON.stringify(data)}`);
      }
    });

    // 2. Config endpoint
    await check('Config Endpoint (GET /api/config)', async () => {
      const data = await apiGet('/api/config');
      if (!data.restaurant || !data.restaurant.name) {
        throw new Error('Config missing restaurant details');
      }
    });

    // 3. Menu endpoint
    await check('Menu Endpoint (GET /api/menu)', async () => {
      const items = await apiGet('/api/menu');
      if (!Array.isArray(items)) {
        throw new Error('Menu items is not an array');
      }
    });

    // 4. Tables availability endpoint
    await check('Table Availability Endpoint (GET /api/tables/availability)', async () => {
      const today = new Date().toISOString().split('T')[0];
      const data = await apiGet(`/api/tables/availability?date=${today}&time=19:00&guests=2`);
      if (typeof data.count !== 'number' || !Array.isArray(data.tables)) {
        throw new Error('Availability response missing count or tables array');
      }
    });

    // 5. Auth login endpoint (admin demo)
    await check('Admin Login Endpoint (POST /api/auth/login)', async () => {
      const res = await apiPost('/api/auth/login', {
        email: 'admin@restaurantpro.com',
        password: 'admin123',
      });
      if (!res.token || res.user.role !== 'admin') {
        throw new Error('Failed to obtain token for admin');
      }
    });
  } finally {
    if (tempServer) {
      tempServer.close();
    }
  }

  console.log('\n--------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('--------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
