/**
 * Polymarket Betting Simulator
 * 가상 자금으로 베팅 전략 테스트
 */

import express from 'express';

const app = express();
const PORT = 3001;

app.use(express.json());

// 가상 자금
let virtualBalance = 100; // $100

// 베팅 기록
interface Bet {
  id: number;
  market: string;
  question: string;
  outcome: 'YES' | 'NO';
  odds: number; // 0-1
  amount: number;
  status: 'pending' | 'won' | 'lost';
  potentialReturn: number;
  createdAt: Date;
  settledAt?: Date;
}

const bets: Bet[] = [];
let betIdCounter = 0;

// 활성 마켓 (실제로는 Polymarket API에서 가져옴)
const activeMarkets = [
  { id: 1, question: "Will BTC reach $100k by end of 2025?", yesOdds: 0.35, noOdds: 0.65 },
  { id: 2, question: "Will ETH flip BTC market cap?", yesOdds: 0.15, noOdds: 0.85 },
  { id: 3, question: "Will BTC be above $90k on March 31?", yesOdds: 0.45, noOdds: 0.55 },
  { id: 4, question: "Will any crypto ETF be approved in Q1 2025?", yesOdds: 0.60, noOdds: 0.40 },
];

// API: 상태 확인
app.get('/api/status', (req, res) => {
  const activeBets = bets.filter(b => b.status === 'pending');
  const wonBets = bets.filter(b => b.status === 'won');
  const lostBets = bets.filter(b => b.status === 'lost');
  
  const totalWagered = bets.reduce((sum, b) => sum + b.amount, 0);
  const totalWon = wonBets.reduce((sum, b) => sum + b.potentialReturn, 0);
  const totalLost = lostBets.reduce((sum, b) => sum + b.amount, 0);
  
  res.json({
    virtualBalance,
    totalBets: bets.length,
    activeBets: activeBets.length,
    wonBets: wonBets.length,
    lostBets: lostBets.length,
    totalWagered,
    totalWon,
    totalLost,
    netProfit: totalWon - totalLost,
    winRate: bets.length > 0 ? Math.round((wonBets.length / (wonBets.length + lostBets.length)) * 100) : 0,
  });
});

// API: 활성 마켓 목록
app.get('/api/markets', (req, res) => {
  res.json(activeMarkets);
});

// API: 베팅 생성
app.post('/api/bet', (req, res) => {
  const { marketId, outcome, amount } = req.body;
  
  if (amount > virtualBalance) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  const market = activeMarkets.find(m => m.id === marketId);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const odds = outcome === 'YES' ? market.yesOdds : market.noOdds;
  const potentialReturn = amount / odds; // 역산
  
  virtualBalance -= amount;
  
  const bet: Bet = {
    id: ++betIdCounter,
    market: `Market #${marketId}`,
    question: market.question,
    outcome,
    odds,
    amount,
    status: 'pending',
    potentialReturn,
    createdAt: new Date(),
  };
  
  bets.unshift(bet);
  
  res.json({
    success: true,
    bet,
    newBalance: virtualBalance,
  });
});

// API: 베팅 정산 (시뮬레이션)
app.post('/api/bet/:id/settle', (req, res) => {
  const { id } = req.params;
  const { won } = req.body;
  
  const bet = bets.find(b => b.id === parseInt(id));
  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }
  
  if (bet.status !== 'pending') {
    return res.status(400).json({ error: 'Bet already settled' });
  }
  
  bet.status = won ? 'won' : 'lost';
  bet.settledAt = new Date();
  
  if (won) {
    virtualBalance += bet.potentialReturn;
  }
  
  res.json({
    success: true,
    bet,
    newBalance: virtualBalance,
  });
});

// API: 베팅 기록
app.get('/api/bets', (req, res) => {
  res.json(bets);
});

// HTML Dashboard
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Polymarket Simulator</title>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
    h1 { color: #00ff88; margin-bottom: 20px; }
    .card { background: #141414; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #222; }
    .balance { font-size: 48px; color: #00ff88; }
    .label { color: #888; font-size: 12px; }
    .market { background: #1a1a1a; padding: 15px; border-radius: 8px; margin-bottom: 10px; }
    .odds { color: #ffd700; }
    button { background: #00ff88; color: #000; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-right: 10px; }
    button:hover { opacity: 0.8; }
    .bet { background: #1a1a1a; padding: 10px; border-radius: 6px; margin-bottom: 8px; }
    .won { border-left: 3px solid #00ff88; }
    .lost { border-left: 3px solid #ff4444; }
    .pending { border-left: 3px solid #888; }
    input { background: #1a1a1a; border: 1px solid #333; color: #fff; padding: 8px; border-radius: 6px; width: 100px; }
  </style>
</head>
<body>
  <h1>🎰 Polymarket Simulator</h1>
  
  <div class="card">
    <div class="label">Virtual Balance</div>
    <div class="balance" id="balance">$100.00</div>
  </div>
  
  <div class="card">
    <div class="label">Stats</div>
    <div id="stats">Loading...</div>
  </div>
  
  <h2 style="color:#888;margin:20px 0 10px;">Active Markets</h2>
  <div id="markets">Loading...</div>
  
  <h2 style="color:#888;margin:20px 0 10px;">Your Bets</h2>
  <div id="bets">No bets yet</div>
  
  <script>
    async function load() {
      const [statusRes, marketsRes, betsRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/markets'),
        fetch('/api/bets')
      ]);
      
      const status = await statusRes.json();
      const markets = await marketsRes.json();
      const bets = await betsRes.json();
      
      document.getElementById('balance').textContent = '$' + status.virtualBalance.toFixed(2);
      
      document.getElementById('stats').innerHTML = 
        'Bets: ' + status.totalBets + 
        ' | Active: ' + status.activeBets + 
        ' | Won: ' + status.wonBets + 
        ' | Lost: ' + status.lostBets + 
        ' | Win Rate: ' + status.winRate + '%' +
        ' | Net: <span style="color:' + (status.netProfit >= 0 ? '#00ff88' : '#ff4444') + '">$' + status.netProfit.toFixed(2) + '</span>';
      
      document.getElementById('markets').innerHTML = markets.map(m => 
        '<div class="market">' +
          '<div style="margin-bottom:10px;">' + m.question + '</div>' +
          '<div style="margin-bottom:10px;">' +
            '<span class="odds">YES: ' + (m.yesOdds * 100).toFixed(0) + '%</span> | ' +
            '<span class="odds">NO: ' + (m.noOdds * 100).toFixed(0) + '%</span>' +
          '</div>' +
          '<div>' +
            '<input type="number" id="amount-' + m.id + '" value="10" min="1" max="100"> ' +
            '<button onclick="placeBet(' + m.id + ', \'YES\')">Bet YES</button>' +
            '<button onclick="placeBet(' + m.id + ', \'NO\')">Bet NO</button>' +
          '</div>' +
        '</div>'
      ).join('');
      
      if (bets.length > 0) {
        document.getElementById('bets').innerHTML = bets.map(b => 
          '<div class="bet ' + b.status + '">' +
            '<strong>' + b.outcome + '</strong> $' + b.amount + ' on "' + b.question.substring(0, 40) + '..."' +
            ' @ ' + (b.odds * 100).toFixed(0) + '%' +
            ' | Status: ' + b.status +
            (b.status === 'pending' ? 
              ' | <button onclick="settleBet(' + b.id + ', true)">Won</button>' +
              '<button onclick="settleBet(' + b.id + ', false)">Lost</button>' : '') +
          '</div>'
        ).join('');
      }
    }
    
    async function placeBet(marketId, outcome) {
      const amount = parseFloat(document.getElementById('amount-' + marketId).value);
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId, outcome, amount })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else load();
    }
    
    async function settleBet(id, won) {
      await fetch('/api/bet/' + id + '/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ won })
      });
      load();
    }
    
    load();
    setInterval(load, 5000);
  </script>
</body>
</html>`;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`[Polymarket Simulator] Running at http://localhost:${PORT}`);
});
