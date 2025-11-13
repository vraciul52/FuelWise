const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Initialize cache with 1-hour TTL (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve your frontend files

// ---- Helpers ----
const CBS_URL =
  'https://opendata.cbs.nl/ODataApi/OData/80416ENG/TypedDataSet?$format=json';

function fmtDate(yyyymmdd) {
  const s = String(yyyymmdd);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function fetchNetherlandsFuelPrices() {
  const { data } = await axios.get(CBS_URL);
  const rows = data.value || [];
  if (!rows.length) throw new Error('No data from CBS');

  // Find row with the largest Periods code (i.e., latest date)
  const latest = rows.reduce((maxRow, row) => {
    const p = parseInt(row.Periods, 10);
    if (!maxRow) return row;
    const maxP = parseInt(maxRow.Periods, 10);
    return p > maxP ? row : maxRow;
  }, null);

  const periodCode = String(latest.Periods);
  let formattedDate = periodCode;

  // Periods is like 20251110 (YYYYMMDD)
  if (/^\d{8}$/.test(periodCode)) {
    formattedDate = `${periodCode.slice(0, 4)}-${periodCode.slice(4, 6)}-${periodCode.slice(6, 8)}`;
  }

  return {
    date: formattedDate,
    euro95: Number(latest.Euro95_1),
    diesel: Number(latest.Diesel_2),
    lpg: Number(latest.LPG_3),
    currency: 'EUR',
    unit: 'per_liter',
    source: 'CBS StatLine 80416ENG',
    lastUpdated: new Date().toISOString(),
  };
}


// ---- API endpoints ----

// Main endpoint: returns latest NL prices with cache status
app.get('/api/fuel-prices', async (_req, res) => {
  const cacheKey = 'cbs:nl:latest';

  try {
    // 1) Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cacheStatus: 'cached',
      });
    }

    // 2) Fetch fresh from CBS
    const freshData = await fetchNetherlandsFuelPrices();
    cache.set(cacheKey, freshData);

    return res.json({
      ...freshData,
      cacheStatus: 'fresh',
    });
  } catch (err) {
    console.error('CBS fetch error:', err.message);

    // Optional: soft-fallback to stale cache if available
    const stale = cache.get(cacheKey);
    if (stale) {
      return res.status(200).json({
        ...stale,
        cacheStatus: 'stale',
        warning: 'Live CBS request failed; using last cached value.',
      });
    }

    return res.status(500).json({ error: 'Failed to fetch CBS fuel prices' });
  }
});

// Cache stats – useful while debugging
app.get('/api/cache/stats', (_req, res) => {
  const stats = cache.getStats();
  const keys = cache.keys();

  res.json({
    ...stats,
    cachedCountries: keys.length,
    keys,
  });
});

// Clear cache – for testing
app.delete('/api/cache/clear', (_req, res) => {
  cache.flushAll();
  res.json({ message: 'Cache cleared successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fuel Price API Proxy Server running on http://localhost:${PORT}`);
  console.log(`Cache TTL: 1 hour (3600 seconds)`);
});
