/**
 * Polymarket Agent - 통합 버전
 * 실제 Polymarket 마켓 + 페이퍼 트레이딩 + 자동 정산
 */

import express from 'express';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

app.use(express.json());

// ============================================================================
// 상태 관리
// ============================================================================

interface State {
  virtualBalance: number;
  btcPrice: number;
  ethPrice: number;
  bets: Bet[];
  lastUpdate: Date;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
}

interface RealMarket {
  id: string;
  question: string;
  outcomes: string[];
  prices: number[];
  category?: string;
  targetPrice?: number;
  condition?: string;
}

interface Bet {
  id: number;
  marketId: string;
  question: string;
  outcome: string;
  odds: number;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  potentialReturn: number;
  priceAtBet?: number;
  targetPrice?: number;
  currentPrice?: number;
  createdAt: Date;
  settledAt?: Date;
}

const state: State = {
  virtualBalance: 1000,
  btcPrice: 67000,
  ethPrice: 3500,
  bets: [],
  lastUpdate: new Date(),
  totalWagered: 0,
  totalWon: 0,
  totalLost: 0,
};

let betId = 0;
let realMarkets: RealMarket[] = [];

// 커스텀 마켓 (가격 기반 자동 정산용)
const customMarkets = [
  {
    id: 'btc-100k-2025',
    question: 'Will BTC reach $100,000 by end of 2025?',
    category: 'bitcoin',
    targetPrice: 100000,
    condition: 'above',
    deadline: new Date('2025-12-31'),
  },
  {
    id: 'btc-75k-march',
    question: 'Will BTC be above $75,000 on March 31?',
    category: 'bitcoin',
    targetPrice: 75000,
    condition: 'above',
    deadline: new Date('2025-03-31'),
  },
  {
    id: 'eth-4k-2025',
    question: 'Will ETH reach $4,000 by end of 2025?',
    category: 'ethereum',
    targetPrice: 4000,
    condition: 'above',
    deadline: new Date('2025-12-31'),
  },
  {
    id: 'eth-3.5k-today',
    question: 'Will ETH be above $3,500 in 1 hour?',
    category: 'ethereum',
    targetPrice: 3500,
    condition: 'above',
    deadline: new Date(Date.now() + 60 * 60 * 1000),
  },
];

// ============================================================================
// API 함수들
// ============================================================================

async function fetchPrices(): Promise<void> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    const data = await res.json();
    if (data.bitcoin?.usd) state.btcPrice = data.bitcoin.usd;
    if (data.ethereum?.usd) state.ethPrice = data.ethereum.usd;
    state.lastUpdate = new Date();
    console.log(`[Polymarket] BTC: $${state.btcPrice.toLocaleString()} | ETH: $${state.ethPrice.toLocaleString()}`);
  } catch (e) {
    console.log('[Polymarket] Price fetch failed');
  }
}

async function fetchMarkets(): Promise<void> {
  try {
    const url = `https://clob.polymarket.com/markets?limit=30&_s=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const json = await res.json();
    const data = json.data || [];
    
    realMarkets = data.map((m: any) => ({
      id: m.condition_id || String(m.id),
      question: m.question,
      outcomes: ['Yes', 'No'],
      prices: [
        parseFloat(m.outcome_prices?.[0] || '0.5'),
        parseFloat(m.outcome_prices?.[1] || '0.5'),
      ],
    }));
    
    // 커스텀 마켓 추가 (가격 기반)
    customMarkets.forEach(cm => {
      const currentPrice = cm.category === 'bitcoin' ? state.btcPrice : state.ethPrice;
      const ratio = currentPrice / cm.targetPrice!;
      const yesProb = Math.min(0.95, Math.max(0.05, ratio * 0.5));
      
      realMarkets.push({
        id: cm.id,
        question: cm.question,
        outcomes: ['Yes', 'No'],
        prices: [Math.round(yesProb * 100) / 100, Math.round((1 - yesProb) * 100) / 100],
        category: cm.category,
        targetPrice: cm.targetPrice,
        condition: cm.condition,
      });
    });
    
    console.log(`[Polymarket] Loaded ${realMarkets.length} markets (${data.length} real + ${customMarkets.length} custom)`);
  } catch (e: any) {
    console.log('[Polymarket] Market fetch failed:', e.message);
    
    // 폴백: 커스텀 마켓만 사용
    realMarkets = customMarkets.map(cm => {
      const currentPrice = cm.category === 'bitcoin' ? state.btcPrice : state.ethPrice;
      const ratio = currentPrice / cm.targetPrice!;
      const yesProb = Math.min(0.95, Math.max(0.05, ratio * 0.5));
      
      return {
        id: cm.id,
        question: cm.question,
        outcomes: ['Yes', 'No'],
        prices: [Math.round(yesProb * 100) / 100, Math.round((1 - yesProb) * 100) / 100],
        category: cm.category,
        targetPrice: cm.targetPrice,
        condition: cm.condition,
      };
    });
  }
}

// 자동 정산 (가격 기반 마켓만)
function autoSettle(): void {
  state.bets.forEach(bet => {
    if (bet.status !== 'pending') return;
    
    const market = realMarkets.find(m => m.id === bet.marketId);
    if (!market || !market.category) return; // 커스텀 마켓만 자동 정산
    
    const currentPrice = market.category === 'bitcoin' ? state.btcPrice : state.ethPrice;
    bet.currentPrice = currentPrice;
    
    // 조건 체크
    let won = false;
    if (market.condition === 'above') {
      won = currentPrice >= market.targetPrice!;
    } else {
      won = currentPrice <= market.targetPrice!;
    }
    
    // 타겟 도달 시에만 정산
    if (won) {
      bet.status = 'won';
      bet.settledAt = new Date();
      state.virtualBalance += bet.potentialReturn;
      state.totalWon += bet.potentialReturn;
      console.log(`[Polymarket] Bet #${bet.id} WON! +$${bet.potentialReturn.toFixed(2)}`);
    }
  });
}

// ============================================================================
// API 엔드포인트
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'polymarket', timestamp: new Date() });
});

app.get('/api/status', (req, res) => {
  const wonBets = state.bets.filter(b => b.status === 'won');
  const lostBets = state.bets.filter(b => b.status === 'lost');
  
  res.json({
    virtualBalance: state.virtualBalance.toFixed(2),
    prices: { btc: state.btcPrice, eth: state.ethPrice },
    totalBets: state.bets.length,
    activeBets: state.bets.filter(b => b.status === 'pending').length,
    wonBets: wonBets.length,
    lostBets: lostBets.length,
    totalWagered: state.totalWagered.toFixed(2),
    totalWon: state.totalWon.toFixed(2),
    totalLost: state.totalLost.toFixed(2),
    netProfit: (state.totalWon - state.totalLost).toFixed(2),
    winRate: (wonBets.length + lostBets.length) > 0 
      ? Math.round((wonBets.length / (wonBets.length + lostBets.length)) * 100) : 0,
    lastUpdate: state.lastUpdate,
  });
});

app.get('/api/markets', (req, res) => {
  const marketsWithPrices = realMarkets.map(m => {
    if (m.category) {
      const currentPrice = m.category === 'bitcoin' ? state.btcPrice : state.ethPrice;
      return {
        ...m,
        currentPrice,
        priceToTarget: ((currentPrice / m.targetPrice!) * 100).toFixed(1) + '%',
      };
    }
    return m;
  });
  res.json(marketsWithPrices);
});

app.post('/api/bet', (req, res) => {
  const { marketId, outcome, amount } = req.body;
  
  if (amount > state.virtualBalance) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  const market = realMarkets.find(m => m.id === marketId);
  if (!market) {
    return res.status(404).json({ error: 'Market not found' });
  }
  
  const outcomeIndex = outcome === 'Yes' || outcome === 'YES' ? 0 : 1;
  const odds = market.prices[outcomeIndex] || 0.5;
  const potentialReturn = amount / odds;
  const currentPrice = market.category === 'bitcoin' ? state.btcPrice : state.ethPrice;
  
  state.virtualBalance -= amount;
  state.totalWagered += amount;
  
  const bet: Bet = {
    id: ++betId,
    marketId,
    question: market.question,
    outcome,
    odds,
    amount,
    status: 'pending',
    potentialReturn,
    priceAtBet: currentPrice,
    targetPrice: market.targetPrice,
    currentPrice,
    createdAt: new Date(),
  };
  
  state.bets.unshift(bet);
  
  res.json({ success: true, bet, newBalance: state.virtualBalance });
});

app.post('/api/bet/:id/settle', (req, res) => {
  const { id } = req.params;
  const { won } = req.body;
  
  const bet = state.bets.find(b => b.id === parseInt(id));
  if (!bet) return res.status(404).json({ error: 'Bet not found' });
  if (bet.status !== 'pending') return res.status(400).json({ error: 'Already settled' });
  
  bet.status = won ? 'won' : 'lost';
  bet.settledAt = new Date();
  
  if (won) {
    state.virtualBalance += bet.potentialReturn;
    state.totalWon += bet.potentialReturn;
  } else {
    state.totalLost += bet.amount;
  }
  
  res.json({ success: true, bet, newBalance: state.virtualBalance });
});

// 자동 정산 API
app.post('/api/auto-settle', (req, res) => {
  const before = state.bets.filter(b => b.status === 'pending').length;
  autoSettle();
  const after = state.bets.filter(b => b.status === 'pending').length;
  const settled = before - after;
  
  res.json({ 
    success: true, 
    settled, 
    newBalance: state.virtualBalance.toFixed(2),
    message: settled > 0 ? `${settled} bets auto-settled` : 'No bets to settle'
  });
});

app.get('/api/bets', (req, res) => {
  // 현재 가격 업데이트
  const betsWithPrices = state.bets.map(b => {
    const market = realMarkets.find(m => m.id === b.marketId);
    if (market && market.category && b.status === 'pending') {
      b.currentPrice = market.category === 'bitcoin' ? state.btcPrice : state.ethPrice;
    }
    return b;
  });
  res.json(betsWithPrices);
});

// ============================================================================
// 대시보드 HTML - 통합 버전
// ============================================================================

app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Polymarket Agent</title>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #fff; padding: 20px; }
    h1 { color: #f7931a; margin-bottom: 5px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .label { color: #888; font-size: 12px; }
    
    /* Header */
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .prices { display: flex; gap: 20px; }
    .price-box { text-align: right; }
    .price { font-size: 24px; font-weight: bold; }
    .btc { color: #f7931a; }
    .eth { color: #627eea; }
    
    /* Stats */
    .stats-bar { background: #141414; border-radius: 8px; padding: 15px 20px; margin-bottom: 20px; display: flex; gap: 30px; align-items: center; }
    .balance { font-size: 28px; color: #00ff88; font-weight: bold; }
    .stat { text-align: center; }
    .stat-value { font-size: 18px; font-weight: bold; }
    .good { color: #00ff88; }
    .bad { color: #ff4444; }
    
    /* Markets Grid */
    .markets-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .market-card { background: #141414; border-radius: 8px; padding: 12px; border: 1px solid #222; }
    .market-card.custom { border-color: #f7931a; }
    .market-question { font-size: 13px; margin-bottom: 10px; line-height: 1.3; height: 34px; overflow: hidden; }
    .market-meta { font-size: 11px; color: #666; margin-bottom: 8px; }
    .market-odds { display: flex; gap: 8px; margin-bottom: 10px; }
    .odds-badge { font-size: 11px; padding: 3px 8px; border-radius: 4px; }
    .yes-odds { background: #1a4d1a; color: #00ff88; }
    .no-odds { background: #4d1a1a; color: #ff4444; }
    .market-actions { display: flex; gap: 5px; }
    .market-actions input { width: 50px; padding: 4px; font-size: 12px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 4px; }
    .btn { padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; }
    .btn:hover { opacity: 0.8; }
    .btn-yes { background: #00ff88; color: #000; }
    .btn-no { background: #ff4444; color: #fff; }
    .btn-action { background: #f7931a; color: #000; padding: 8px 16px; }
    
    /* Bets */
    .bets-header { display: flex; justify-content: space-between; align-items: center; margin: 20px 0 10px; }
    .bets-list { max-height: 300px; overflow-y: auto; }
    .bet-item { background: #1a1a1a; padding: 10px; border-radius: 6px; margin-bottom: 8px; font-size: 13px; }
    .won { border-left: 3px solid #00ff88; }
    .lost { border-left: 3px solid #ff4444; }
    .pending { border-left: 3px solid #f7931a; }
    
    .tabs { display: flex; gap: 10px; margin-bottom: 15px; }
    .tab { padding: 8px 16px; background: #1a1a1a; border: none; color: #888; cursor: pointer; border-radius: 6px; }
    .tab.active { background: #f7931a; color: #000; }
    
    @media (max-width: 1200px) { .markets-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 900px) { .markets-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 600px) { .markets-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>🎰 Polymarket Agent</h1>
        <p class="label">Real markets + Paper trading + Auto-settlement</p>
      </div>
      <div class="prices">
        <div class="price-box">
          <div class="label">BTC</div>
          <div class="price btc" id="btc">$67,000</div>
        </div>
        <div class="price-box">
          <div class="label">ETH</div>
          <div class="price eth" id="eth">$3,500</div>
        </div>
      </div>
    </div>
    
    <div class="stats-bar">
      <div class="balance" id="balance">$1,000</div>
      <div class="stat"><div class="stat-value" id="bets">0</div><div class="label">Bets</div></div>
      <div class="stat"><div class="stat-value" id="winrate">-</div><div class="label">Win%</div></div>
      <div class="stat"><div class="stat-value" id="profit">$0</div><div class="label">P/L</div></div>
      <div class="stat"><div class="stat-value" id="active">0</div><div class="label">Active</div></div>
      <div class="stat"><div class="stat-value" id="wagered">$0</div><div class="label">Wagered</div></div>
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="showTab('all')">All Markets</button>
      <button class="tab" onclick="showTab('custom')">Price-Based</button>
      <button class="tab" onclick="showTab('real')">Real Polymarket</button>
    </div>
    
    <h2 style="color:#888;font-size:14px;margin-bottom:10px;">LIVE MARKETS</h2>
    <div class="markets-grid" id="markets">Loading...</div>
    
    <div class="bets-header">
      <h2 style="color:#888;font-size:14px;">YOUR BETS</h2>
      <button class="btn btn-action" onclick="autoSettle()">⚡ Auto Settle</button>
    </div>
    <div class="bets-list" id="bets-list">No bets yet</div>
  </div>
  
  <script>
    let currentTab = 'all';
    let allMarkets = [];
    
    async function load() {
      const [status, markets, bets] = await Promise.all([
        fetch('/api/status').then(r => r.json()),
        fetch('/api/markets').then(r => r.json()),
        fetch('/api/bets').then(r => r.json())
      ]);
      
      document.getElementById('btc').textContent = '$' + status.prices.btc.toLocaleString();
      document.getElementById('eth').textContent = '$' + status.prices.eth.toLocaleString();
      document.getElementById('balance').textContent = '$' + status.virtualBalance;
      document.getElementById('bets').textContent = status.totalBets;
      document.getElementById('winrate').textContent = status.winRate + '%';
      document.getElementById('active').textContent = status.activeBets;
      document.getElementById('wagered').textContent = '$' + status.totalWagered;
      
      const pl = parseFloat(status.netProfit);
      const plEl = document.getElementById('profit');
      plEl.textContent = (pl >= 0 ? '+' : '') + '$' + status.netProfit;
      plEl.className = 'stat-value ' + (pl >= 0 ? 'good' : 'bad');
      
      allMarkets = markets;
      renderMarkets();
      renderBets(bets);
    }
    
    function showTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      renderMarkets();
    }
    
    function renderMarkets() {
      let filtered = allMarkets;
      if (currentTab === 'custom') filtered = allMarkets.filter(m => m.category);
      else if (currentTab === 'real') filtered = allMarkets.filter(m => !m.category);
      
      document.getElementById('markets').innerHTML = filtered.map(m => {
        const yesPrice = (m.prices[0] * 100).toFixed(1);
        const noPrice = (m.prices[1] * 100).toFixed(1);
        const isCustom = m.category;
        
        let meta = '';
        if (isCustom) {
          const icon = m.category === 'bitcoin' ? '₿' : 'Ξ';
          meta = '<div class="market-meta">' + icon + ' $' + m.currentPrice.toLocaleString() + ' → Target: $' + m.targetPrice.toLocaleString() + ' (' + m.priceToTarget + ')</div>';
        }
        
        return '<div class="market-card ' + (isCustom ? 'custom' : '') + '">' +
          '<div class="market-question">' + m.question + '</div>' +
          meta +
          '<div class="market-odds">' +
            '<span class="odds-badge yes-odds">Yes ' + yesPrice + '%</span>' +
            '<span class="odds-badge no-odds">No ' + noPrice + '%</span>' +
          '</div>' +
          '<div class="market-actions">' +
            '<input type="number" id="amt-' + m.id + '" value="10" min="1">' +
            '<button class="btn btn-yes" onclick="bet(\\''+m.id+'\\',\\'Yes\\')">Yes</button>' +
            '<button class="btn btn-no" onclick="bet(\\''+m.id+'\\',\\'No\\')">No</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    
    function renderBets(bets) {
      if (bets.length === 0) {
        document.getElementById('bets-list').innerHTML = '<div style="color:#666;padding:20px;">No bets yet. Select a market above to place a bet.</div>';
        return;
      }
      
      document.getElementById('bets-list').innerHTML = bets.slice(0, 15).map(b => {
        const statusIcon = b.status === 'pending' ? '⏳' : (b.status === 'won' ? '✅' : '❌');
        const priceInfo = b.priceAtBet ? ('$' + b.priceAtBet.toLocaleString() + (b.currentPrice ? ' → $' + b.currentPrice.toLocaleString() : '')) : '';
        
        return '<div class="bet-item ' + b.status + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<div>' +
              '<strong>' + b.outcome + '</strong> $' + b.amount + ' @ ' + (b.odds*100).toFixed(0) + '% ' +
              '<span style="color:#888;">' + b.question.substring(0,40) + '...</span>' +
            '</div>' +
            '<div>' +
              '<span style="color:#666;font-size:11px;">' + priceInfo + '</span> ' +
              statusIcon +
            '</div>' +
          '</div>' +
          (b.status === 'pending' ? 
            '<div style="margin-top:8px;">' +
              '<button class="btn btn-yes" onclick="settle(' + b.id + ',true)">Won</button>' +
              '<button class="btn btn-no" onclick="settle(' + b.id + ',false)">Lost</button>' +
            '</div>' : '') +
        '</div>';
      }).join('');
    }
    
    async function bet(id, outcome) {
      const amount = parseFloat(document.getElementById('amt-' + id).value) || 10;
      const res = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: id, outcome, amount })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else load();
    }
    
    async function settle(id, won) {
      await fetch('/api/bet/' + id + '/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ won })
      });
      load();
    }
    
    async function autoSettle() {
      const res = await fetch('/api/auto-settle', { method: 'POST' });
      const data = await res.json();
      if (data.message) alert(data.message);
      load();
    }
    
    load();
    setInterval(load, 10000);
  </script>
</body>
</html>`;
  res.send(html);
});

// ============================================================================
// 스케줄러
// ============================================================================

setInterval(fetchPrices, 30000);
setInterval(fetchMarkets, 300000);
setInterval(autoSettle, 60000); // 1분마다 자동 정산 체크

// ============================================================================
// 시작
// ============================================================================

async function start() {
  await Promise.all([fetchPrices(), fetchMarkets()]);
  
  app.listen(PORT, () => {
    console.log(`[Polymarket Agent] Running at http://localhost:${PORT}`);
    console.log(`[Polymarket] Features: Real markets + Paper trading + Auto-settlement`);
  });
}

start();
