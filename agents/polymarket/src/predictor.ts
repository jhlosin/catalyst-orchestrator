/**
 * BTC Direction Prediction Simulator
 * 5분/1시간/1일 방향 예측 시뮬레이션
 */

import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 3002;

app.use(express.json());

// 예측 기록
interface Prediction {
  id: number;
  timeframe: '5m' | '1h' | '1d';
  direction: 'UP' | 'DOWN';
  predictedAt: Date;
  targetTime: Date;
  priceAtPrediction: number;
  confidence: number; // 0-100
  status: 'pending' | 'correct' | 'wrong';
  priceAtTarget?: number;
  priceChange?: number;
}

const predictions: Prediction[] = [];
let predictionIdCounter = 0;

// 현재 BTC 가격
let currentPrice = 95000;
let lastFetch = 0;

// 실제 가격 가져오기 (CoinGecko API)
async function fetchRealPrice(): Promise<number> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currency=usd', {
      timeout: 5000,
    } as any);
    const data = await res.json();
    return data.bitcoin?.usd || currentPrice;
  } catch (e) {
    console.log('[Predictor] Failed to fetch real price, using cached');
    return currentPrice;
  }
}

// 30초마다 실제 가격 업데이트
async function updatePrice() {
  const now = Date.now();
  if (now - lastFetch > 30000) {
    const realPrice = await fetchRealPrice();
    if (realPrice && realPrice > 0) {
      currentPrice = realPrice;
      lastFetch = now;
      console.log(`[Predictor] Updated BTC price: $${currentPrice.toLocaleString()}`);
    }
  }
}

// 10초마다 가격 업데이트 체크
setInterval(updatePrice, 10000);

// 초기 가격 로드
updatePrice();

// 예측 생성
function createPrediction(timeframe: '5m' | '1h' | '1d', direction: 'UP' | 'DOWN', confidence: number): Prediction {
  const now = new Date();
  const targetTime = new Date(now);
  
  // 시뮬레이션용으로 시간 단축 (5m→30초, 1h→5분, 1d→30분)
  const simMultipliers = { '5m': 30, '1h': 300, '1d': 1800 };
  targetTime.setSeconds(targetTime.getSeconds() + simMultipliers[timeframe]);
  
  return {
    id: ++predictionIdCounter,
    timeframe,
    direction,
    predictedAt: now,
    targetTime,
    priceAtPrediction: currentPrice,
    confidence,
    status: 'pending',
  };
}

// 예측 정산
function settlePrediction(prediction: Prediction): void {
  prediction.priceAtTarget = currentPrice;
  prediction.priceChange = ((currentPrice - prediction.priceAtPrediction) / prediction.priceAtPrediction) * 100;
  
  const isUp = currentPrice > prediction.priceAtPrediction;
  const predictedUp = prediction.direction === 'UP';
  
  prediction.status = (isUp === predictedUp) ? 'correct' : 'wrong';
}

// 정산 체크 (1초마다)
setInterval(() => {
  const now = new Date();
  predictions.forEach(p => {
    if (p.status === 'pending' && now >= p.targetTime) {
      settlePrediction(p);
    }
  });
}, 1000);

// 자동 예측 (Catalyst 스타일 분석 시뮬레이션)
function generateAutoPrediction(): Prediction {
  // 무작위 + 약간의 모멘텀 반영
  const recentTrend = Math.random() > 0.5 ? 'UP' : 'DOWN';
  const confidence = 50 + Math.floor(Math.random() * 30); // 50-80%
  const timeframes: Array<'5m' | '1h' | '1d'> = ['5m', '1h', '1d'];
  const tf = timeframes[Math.floor(Math.random() * timeframes.length)];
  
  return createPrediction(tf, recentTrend, confidence);
}

// 30초마다 자동 예측 생성
setInterval(() => {
  if (predictions.filter(p => p.status === 'pending').length < 5) {
    predictions.unshift(generateAutoPrediction());
    if (predictions.length > 100) predictions.pop();
  }
}, 30000);

// API: 상태
app.get('/api/status', (req, res) => {
  const pending = predictions.filter(p => p.status === 'pending');
  const correct = predictions.filter(p => p.status === 'correct');
  const wrong = predictions.filter(p => p.status === 'wrong');
  
  const total = correct.length + wrong.length;
  const accuracy = total > 0 ? Math.round((correct.length / total) * 100) : 0;
  
  // 평균 confidence vs 실제 정확도 비교
  const avgConfidence = predictions.length > 0 
    ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length)
    : 0;
  
  res.json({
    currentPrice,
    totalPredictions: predictions.length,
    pending: pending.length,
    correct: correct.length,
    wrong: wrong.length,
    accuracy,
    avgConfidence,
    calibration: accuracy > 0 ? (accuracy / avgConfidence * 100).toFixed(0) + '%' : 'N/A',
  });
});

// API: 예측 목록
app.get('/api/predictions', (req, res) => {
  res.json(predictions.slice(0, 50));
});

// API: 수동 예측 생성
app.post('/api/predict', (req, res) => {
  const { timeframe, direction, confidence } = req.body;
  const prediction = createPrediction(timeframe, direction, confidence || 60);
  predictions.unshift(prediction);
  if (predictions.length > 100) predictions.pop();
  res.json(prediction);
});

// API: timeframe별 통계
app.get('/api/stats/:timeframe', (req, res) => {
  const { timeframe } = req.params;
  const filtered = predictions.filter(p => p.timeframe === timeframe);
  const correct = filtered.filter(p => p.status === 'correct').length;
  const wrong = filtered.filter(p => p.status === 'wrong').length;
  const total = correct + wrong;
  
  res.json({
    timeframe,
    total: filtered.length,
    settled: total,
    correct,
    wrong,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
  });
});

// HTML Dashboard
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>BTC Direction Predictor</title>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
    h1 { color: #f7931a; margin-bottom: 20px; }
    .card { background: #141414; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #222; }
    .price { font-size: 48px; color: #f7931a; }
    .accuracy { font-size: 36px; }
    .good { color: #00ff88; }
    .bad { color: #ff4444; }
    .label { color: #888; font-size: 12px; margin-bottom: 5px; }
    .prediction { background: #1a1a1a; padding: 12px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .correct { border-left: 3px solid #00ff88; }
    .wrong { border-left: 3px solid #ff4444; }
    .pending { border-left: 3px solid #f7931a; }
    .up { color: #00ff88; }
    .down { color: #ff4444; }
    .tf-badge { background: #333; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .stat-box { text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; }
    button { background: #f7931a; color: #000; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-right: 10px; }
    button:hover { opacity: 0.8; }
    select, input { background: #1a1a1a; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 6px; }
    .controls { margin: 20px 0; }
  </style>
</head>
<body>
  <h1>📈 BTC Direction Predictor</h1>
  
  <div class="card">
    <div class="label">Current BTC Price (Simulated)</div>
    <div class="price" id="price">$95,000</div>
  </div>
  
  <div class="card">
    <div class="grid">
      <div class="stat-box">
        <div class="label">Total Predictions</div>
        <div class="stat-value" id="total">0</div>
      </div>
      <div class="stat-box">
        <div class="label">Accuracy</div>
        <div class="stat-value accuracy" id="accuracy">-</div>
      </div>
      <div class="stat-box">
        <div class="label">Avg Confidence</div>
        <div class="stat-value" id="confidence">-</div>
      </div>
      <div class="stat-box">
        <div class="label">Calibration</div>
        <div class="stat-value" id="calibration">-</div>
      </div>
    </div>
  </div>
  
  <div class="card">
    <h3 style="margin-bottom:15px;">📊 Timeframe Performance</h3>
    <div class="grid">
      <div class="stat-box">
        <div class="tf-badge">5 MIN</div>
        <div class="stat-value" id="tf-5m">-</div>
      </div>
      <div class="stat-box">
        <div class="tf-badge">1 HOUR</div>
        <div class="stat-value" id="tf-1h">-</div>
      </div>
      <div class="stat-box">
        <div class="tf-badge">1 DAY</div>
        <div class="stat-value" id="tf-1d">-</div>
      </div>
    </div>
  </div>
  
  <div class="controls">
    <select id="tf">
      <option value="5m">5 Min</option>
      <option value="1h">1 Hour</option>
      <option value="1d">1 Day</option>
    </select>
    <select id="dir">
      <option value="UP">⬆️ UP</option>
      <option value="DOWN">⬇️ DOWN</option>
    </select>
    <input type="number" id="conf" value="70" min="1" max="100" style="width:80px;"> % confidence
    <button onclick="makePrediction()">Predict</button>
    <button onclick="load()" style="background:#333;color:#fff;">Refresh</button>
  </div>
  
  <h3 style="color:#888;margin:20px 0 10px;">Recent Predictions</h3>
  <div id="predictions">Loading...</div>
  
  <script>
    async function load() {
      const [statusRes, predictionsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/predictions')
      ]);
      
      const status = await statusRes.json();
      const predictions = await predictionsRes.json();
      
      document.getElementById('price').textContent = '$' + status.currentPrice.toLocaleString();
      document.getElementById('total').textContent = status.totalPredictions;
      document.getElementById('accuracy').textContent = status.accuracy + '%';
      document.getElementById('accuracy').className = 'stat-value accuracy ' + (status.accuracy >= 55 ? 'good' : status.accuracy < 45 ? 'bad' : '');
      document.getElementById('confidence').textContent = status.avgConfidence + '%';
      document.getElementById('calibration').textContent = status.calibration;
      
      // Load timeframe stats
      for (const tf of ['5m', '1h', '1d']) {
        const res = await fetch('/api/stats/' + tf);
        const data = await res.json();
        const el = document.getElementById('tf-' + tf);
        el.textContent = data.accuracy + '%';
        el.className = 'stat-value ' + (data.accuracy >= 55 ? 'good' : data.accuracy < 45 ? 'bad' : '');
      }
      
      // Render predictions
      if (predictions.length === 0) {
        document.getElementById('predictions').innerHTML = '<div style="color:#666;">No predictions yet. Auto-generating...</div>';
      } else {
        document.getElementById('predictions').innerHTML = predictions.map(p => {
          const dirClass = p.direction === 'UP' ? 'up' : 'down';
          const dirIcon = p.direction === 'UP' ? '⬆️' : '⬇️';
          const statusText = p.status === 'pending' ? '⏳ Pending' : (p.status === 'correct' ? '✅ Correct' : '❌ Wrong');
          const changeText = p.priceChange ? (' (' + (p.priceChange > 0 ? '+' : '') + p.priceChange.toFixed(2) + '%)') : '';
          
          return '<div class="prediction ' + p.status + '">' +
            '<div>' +
              '<span class="tf-badge">' + p.timeframe + '</span> ' +
              '<span class="' + dirClass + '">' + dirIcon + ' ' + p.direction + '</span> ' +
              '<span style="color:#888;">' + p.confidence + '%</span>' +
            '</div>' +
            '<div>' +
              '<span style="color:#666;">$' + p.priceAtPrediction.toLocaleString() + '</span> → ' +
              (p.priceAtTarget ? '<span style="color:#888;">$' + p.priceAtTarget.toLocaleString() + changeText + '</span>' : '') +
              ' ' + statusText +
            '</div>' +
          '</div>';
        }).join('');
      }
    }
    
    async function makePrediction() {
      const tf = document.getElementById('tf').value;
      const dir = document.getElementById('dir').value;
      const conf = parseInt(document.getElementById('conf').value);
      
      await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeframe: tf, direction: dir, confidence: conf })
      });
      
      load();
    }
    
    load();
    setInterval(load, 2000);
  </script>
</body>
</html>`;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`[BTC Predictor] Running at http://localhost:${PORT}`);
  
  // 시작할 때 몇 개 예측 생성
  for (let i = 0; i < 3; i++) {
    predictions.unshift(generateAutoPrediction());
  }
});
