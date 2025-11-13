const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Initialize cache with 1-hour TTL (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Middleware
app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname))); // Serve your frontend files


// Endpoint to get fuel prices
app.get('/api/fuel-prices', async (_req, res) => {
  try {
    const url = 'https://opendata.cbs.nl/ODataFeed/odata/80416ENG/TypedDataSet?$format=json';
    const { data } = await axios.get(url);

    const rows = data.value || [];
    if (!rows.length) return res.status(502).json({ error: 'No data from CBS' });

    // Sort by Periods (YYYYMMDD as string) just to be safe and pick latest
    rows.sort((a, b) => String(a.Periods).localeCompare(String(b.Periods)));

    const latest = rows[rows.length - 1];

    // helper: 20251103 -> 2025-11-03
    const fmtDate = (yyyymmdd) =>
      `${String(yyyymmdd).slice(0,4)}-${String(yyyymmdd).slice(4,6)}-${String(yyyymmdd).slice(6,8)}`;

    const response = {
      date: fmtDate(latest.Periods),
      euro95: Number(latest.Euro95_1),   // ensure numeric
      diesel: Number(latest.Diesel_2),
      lpg: Number(latest.LPG_3),
      currency: 'EUR',
      unit: 'per_liter',
      source: 'CBS StatLine 80416ENG',
      lastUpdated: new Date().toISOString()
    };

    res.json(response);
  } catch (err) {
    console.error('CBS fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch CBS fuel prices' });
  }
});

// Endpoint to get all prices for multiple countries


// Endpoint to check cache status
app.get('/api/cache/stats', (req, res) => {
  const stats = cache.getStats();
  const keys = cache.keys();
  
  res.json({
    ...stats,
    cachedCountries: keys.length,
    keys: keys
  });
});

// Endpoint to clear cache (for testing)
app.delete('/api/cache/clear', (req, res) => {
  cache.flushAll();
  res.json({ message: 'Cache cleared successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fuel Price API Proxy Server running on http://localhost:${PORT}`);
  console.log(`Cache TTL: 1 hour (3600 seconds)`);
});
