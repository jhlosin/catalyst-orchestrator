/**
 * Polymarket Agent - Main Entry
 */

import express from 'express';

const app = express();
const PORT = 3003;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'polymarket', timestamp: new Date() });
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Polymarket Agent</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 40px; }
    h1 { color: #f7931a; }
    a { color: #00ff88; display: block; margin: 10px 0; font-size: 18px; }
    .status { background: #141414; padding: 20px; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>🎰 Polymarket Agent</h1>
  <div class="status">
    <p><strong>Status:</strong> Running</p>
    <p><strong>Services:</strong></p>
    <a href="http://localhost:3001">📊 Betting Simulator</a>
    <a href="http://localhost:3002">📈 BTC Predictor</a>
  </div>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`[Polymarket Agent] Main server at http://localhost:${PORT}`);
  console.log(`[Polymarket Agent] Simulator at http://localhost:3001`);
  console.log(`[Polymarket Agent] Predictor at http://localhost:3002`);
});
