/**
 * Catalyst Dashboard Server v2
 * Full-featured monitoring with service details
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage
interface JobLog {
  id: number;
  timestamp: Date;
  service_name: string;
  goal: string;
  status: 'success' | 'error';
  cost: number;
  execution_time_ms: number;
  result_preview?: string;
  error?: string;
}

interface ServiceStats {
  call_count: number;
  success_count: number;
  error_count: number;
  total_earnings: number;
  total_time_ms: number;
  last_called_at: Date | null;
  recent_results: string[];
  errors: string[];
}

const jobLogs: JobLog[] = [];
const serviceStats = new Map<string, ServiceStats>();
let jobIdCounter = 0;

// Service definitions
const SERVICES = [
  { name: 'basic_orchestrate', price: 0.05, description: 'Comprehensive analysis report' },
  { name: 'micro_orchestrate', price: 0.02, description: 'Quick 2-source verification' },
  { name: 'token_safety', price: 0.03, description: 'Contract audit + risk analysis' },
  { name: 'market_analysis', price: 0.04, description: 'Fear & Greed + trending tokens' },
  { name: 'content_gen', price: 0.05, description: 'AI-powered content generation' },
  { name: 'consensus_check', price: 0.08, description: '3-source verification' },
  { name: 'multi_source_alpha', price: 0.15, description: '4-signal alpha analysis' },
  { name: 'whale_alert_pro', price: 0.10, description: 'Holder + whale tracking' },
];

// Initialize service stats
SERVICES.forEach(s => {
  serviceStats.set(s.name, {
    call_count: 0,
    success_count: 0,
    error_count: 0,
    total_earnings: 0,
    total_time_ms: 0,
    last_called_at: null,
    recent_results: [],
    errors: [],
  });
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'catalyst', timestamp: new Date() });
});

// API: Full status
app.get('/api/status', (req, res) => {
  const servicesWithStats = SERVICES.map(s => {
    const stats = serviceStats.get(s.name)!;
    return {
      ...s,
      call_count: stats.call_count,
      success_count: stats.success_count,
      error_count: stats.error_count,
      earnings: stats.total_earnings,
      avg_time_ms: stats.call_count > 0 ? Math.round(stats.total_time_ms / stats.call_count) : 0,
      last_called: stats.last_called_at?.toISOString() || null,
      success_rate: stats.call_count > 0 ? Math.round((stats.success_count / stats.call_count) * 100) : 0,
    };
  });

  let totalCalls = 0, totalSuccess = 0, totalEarnings = 0;
  serviceStats.forEach(s => {
    totalCalls += s.call_count;
    totalSuccess += s.success_count;
    totalEarnings += s.total_earnings;
  });

  res.json({
    agent: 'Catalyst',
    id: 5776,
    wallet: '0x9987106410887692E0296E711014b51267d63444',
    status: 'online',
    summary: {
      total_calls: totalCalls,
      total_success: totalSuccess,
      total_earnings: totalEarnings.toFixed(4),
      success_rate: totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 0,
    },
    services: servicesWithStats,
    apis: ['CoinGecko', 'GoPlus Labs', 'Alternative.me'],
    uptime: Math.round(process.uptime()),
  });
});

// API: Service details
app.get('/api/service/:name', (req, res) => {
  const name = req.params.name;
  const service = SERVICES.find(s => s.name === name);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const stats = serviceStats.get(name)!;
  const jobs = jobLogs.filter(j => j.service_name === name).slice(0, 20);

  res.json({
    ...service,
    stats: {
      call_count: stats.call_count,
      success_count: stats.success_count,
      error_count: stats.error_count,
      total_earnings: stats.total_earnings,
      total_time_ms: stats.total_time_ms,
      avg_time_ms: stats.call_count > 0 ? Math.round(stats.total_time_ms / stats.call_count) : 0,
      success_rate: stats.call_count > 0 ? Math.round((stats.success_count / stats.call_count) * 100) : 0,
      last_called_at: stats.last_called_at,
      recent_results: stats.recent_results,
      errors: stats.errors,
    },
    recent_jobs: jobs,
  });
});

// API: Recent jobs
app.get('/api/jobs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const service = req.query.service as string;
  
  let jobs = jobLogs;
  if (service) jobs = jobs.filter(j => j.service_name === service);
  
  res.json(jobs.slice(0, limit));
});

// API: Job details
app.get('/api/job/:id', (req, res) => {
  const job = jobLogs.find(j => j.id === parseInt(req.params.id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

// API: Log a job
app.post('/api/log', (req, res) => {
  const { service_name, goal, status, cost, execution_time_ms, result_preview, error } = req.body;

  const job: JobLog = {
    id: ++jobIdCounter,
    timestamp: new Date(),
    service_name,
    goal: goal?.substring(0, 150) || '',
    status,
    cost: cost || 0,
    execution_time_ms: execution_time_ms || 0,
    result_preview: result_preview?.substring(0, 300),
    error,
  };
  
  jobLogs.unshift(job);
  if (jobLogs.length > 500) jobLogs.pop();

  const stats = serviceStats.get(service_name);
  if (stats) {
    stats.call_count++;
    if (status === 'success') {
      stats.success_count++;
      if (result_preview) {
        stats.recent_results.unshift(result_preview.substring(0, 200));
        if (stats.recent_results.length > 5) stats.recent_results.pop();
      }
    }
    if (status === 'error') {
      stats.error_count++;
      if (error) {
        stats.errors.unshift(error.substring(0, 200));
        if (stats.errors.length > 5) stats.errors.pop();
      }
    }
    stats.total_earnings += cost || 0;
    stats.total_time_ms += execution_time_ms || 0;
    stats.last_called_at = new Date();
  }

  res.json({ success: true, job_id: job.id });
});

// HTML Dashboard
app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Catalyst Dashboard</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    
    .header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #222; margin-bottom: 20px; }
    .logo h1 { font-size: 24px; color: #00ff88; }
    .logo p { color: #666; font-size: 13px; }
    .status-badge { background: #00ff88; color: #000; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; }
    
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
    .summary-card { background: #141414; padding: 25px; border-radius: 12px; border: 1px solid #222; }
    .summary-card .value { font-size: 32px; font-weight: bold; color: #00ff88; }
    .summary-card .label { font-size: 12px; color: #666; margin-top: 5px; text-transform: uppercase; }
    .summary-card.earnings .value { color: #ffd700; }
    
    .section-title { font-size: 14px; color: #888; text-transform: uppercase; margin: 30px 0 15px; }
    
    .services { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .service { background: #141414; border-radius: 12px; padding: 20px; border: 1px solid #222; cursor: pointer; transition: all 0.3s; }
    .service:hover { border-color: #00ff88; transform: translateY(-2px); }
    .service-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .service-name { font-weight: 600; font-size: 14px; }
    .service-price { color: #ffd700; font-weight: bold; font-size: 14px; }
    .service-desc { color: #666; font-size: 12px; margin-bottom: 15px; }
    .service-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .service-stat { text-align: center; }
    .service-stat .value { color: #00ff88; font-weight: bold; font-size: 18px; }
    .service-stat .label { color: #555; font-size: 10px; text-transform: uppercase; }
    
    .jobs-container { background: #141414; border-radius: 12px; border: 1px solid #222; overflow: hidden; }
    .jobs-header { display: grid; grid-template-columns: 150px 1fr 80px 70px 70px; padding: 15px 20px; background: #1a1a1a; font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold; }
    .job-row { display: grid; grid-template-columns: 150px 1fr 80px 70px 70px; padding: 15px 20px; border-bottom: 1px solid #1a1a1a; font-size: 13px; align-items: center; cursor: pointer; }
    .job-row:hover { background: #1a1a1a; }
    .job-row.success { border-left: 3px solid #00ff88; }
    .job-row.error { border-left: 3px solid #ff4444; }
    .status-success { color: #00ff88; }
    .status-error { color: #ff4444; }
    
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); z-index: 1000; overflow-y: auto; }
    .modal.active { display: flex; align-items: flex-start; justify-content: center; padding: 50px 20px; }
    .modal-content { background: #141414; border-radius: 16px; max-width: 800px; width: 100%; border: 1px solid #222; }
    .modal-header { padding: 25px; border-bottom: 1px solid #222; display: flex; justify-content: space-between; align-items: center; }
    .modal-header h2 { color: #00ff88; }
    .modal-close { background: #222; border: none; color: #888; font-size: 24px; cursor: pointer; width: 40px; height: 40px; border-radius: 8px; }
    .modal-body { padding: 25px; }
    
    .result-preview { background: #0a0a0a; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; color: #888; white-space: pre-wrap; max-height: 200px; overflow-y: auto; margin-top: 15px; }
    
    .live { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #00ff88; }
    .live-dot { width: 8px; height: 8px; background: #00ff88; border-radius: 50%; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    
    @media (max-width: 1200px) { .services { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) { 
      .summary { grid-template-columns: repeat(2, 1fr); }
      .services { grid-template-columns: 1fr; }
      .jobs-header, .job-row { grid-template-columns: 1fr; gap: 5px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <h1>🎯 Catalyst</h1>
        <p>Multi-Source Intelligence Hub • Agent ID: 5776</p>
      </div>
      <div style="display: flex; align-items: center; gap: 20px;">
        <div class="live"><span class="live-dot"></span> LIVE</div>
        <span class="status-badge">● ONLINE</span>
      </div>
    </div>
    
    <div class="summary">
      <div class="summary-card">
        <div class="value" id="total-calls">0</div>
        <div class="label">Total Jobs</div>
      </div>
      <div class="summary-card">
        <div class="value" id="total-success">0</div>
        <div class="label">Successful</div>
      </div>
      <div class="summary-card earnings">
        <div class="value" id="total-earnings">$0</div>
        <div class="label">Total Earnings</div>
      </div>
      <div class="summary-card">
        <div class="value" id="uptime">0</div>
        <div class="label">Uptime (min)</div>
      </div>
    </div>
    
    <div class="section-title">Services</div>
    <div class="services" id="services">Loading...</div>
    
    <div class="section-title">Recent Jobs</div>
    <div class="jobs-container">
      <div class="jobs-header">
        <span>Time</span>
        <span>Service / Request</span>
        <span>Status</span>
        <span>Cost</span>
        <span>Time</span>
      </div>
      <div id="jobs">
        <div class="job-row" style="color: #666;">Waiting for jobs...</div>
      </div>
    </div>
    
    <p style="color: #444; font-size: 12px; margin-top: 30px;">
      Data Sources: CoinGecko • GoPlus Labs • Alternative.me | 
      <a href="https://app.virtuals.io/agents/5776" style="color: #00ff88;">View on Virtuals →</a>
    </p>
  </div>
  
  <div class="modal" id="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modal-title">Details</h2>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body" id="modal-body"></div>
    </div>
  </div>
  
  <script>
    async function loadData() {
      try {
        const [statusRes, jobsRes] = await Promise.all([
          fetch('/api/status'),
          fetch('/api/jobs?limit=20')
        ]);
        const status = await statusRes.json();
        const jobs = await jobsRes.json();
        
        document.getElementById('total-calls').textContent = status.summary.total_calls;
        document.getElementById('total-success').textContent = status.summary.total_success;
        document.getElementById('total-earnings').textContent = '$' + status.summary.total_earnings;
        document.getElementById('uptime').textContent = Math.round(status.uptime / 60);
        
        renderServices(status.services);
        renderJobs(jobs);
      } catch (e) {
        console.error('Load error:', e);
      }
    }
    
    function renderServices(services) {
      const html = services.map(s => 
        '<div class="service" onclick="showService(\\''+s.name+'\\')">' +
          '<div class="service-header">' +
            '<span class="service-name">' + s.name.replace(/_/g, ' ') + '</span>' +
            '<span class="service-price">$' + s.price + '</span>' +
          '</div>' +
          '<div class="service-desc">' + s.description + '</div>' +
          '<div class="service-stats">' +
            '<div class="service-stat"><div class="value">' + s.call_count + '</div><div class="label">Calls</div></div>' +
            '<div class="service-stat"><div class="value">' + s.success_rate + '%</div><div class="label">Success</div></div>' +
            '<div class="service-stat"><div class="value">$' + s.earnings.toFixed(3) + '</div><div class="label">Earned</div></div>' +
            '<div class="service-stat"><div class="value">' + s.avg_time_ms + 'ms</div><div class="label">Avg</div></div>' +
          '</div>' +
        '</div>'
      ).join('');
      document.getElementById('services').innerHTML = html;
    }
    
    function renderJobs(jobs) {
      if (!jobs || jobs.length === 0) {
        document.getElementById('jobs').innerHTML = '<div class="job-row" style="color: #666;">Waiting for jobs...</div>';
        return;
      }
      const html = jobs.map(j => 
        '<div class="job-row ' + j.status + '" onclick="showJob(' + j.id + ')">' +
          '<span>' + new Date(j.timestamp).toLocaleString() + '</span>' +
          '<span><strong>' + (j.service_name||'').replace(/_/g, ' ') + '</strong>' + (j.goal ? ': ' + j.goal.substring(0, 50) : '') + '</span>' +
          '<span class="status-' + j.status + '">' + j.status + '</span>' +
          '<span>$' + j.cost + '</span>' +
          '<span>' + j.execution_time_ms + 'ms</span>' +
        '</div>'
      ).join('');
      document.getElementById('jobs').innerHTML = html;
    }
    
    async function showService(name) {
      const res = await fetch('/api/service/' + name);
      const data = await res.json();
      
      let html = '<p style="color:#888;margin-bottom:20px;">' + data.description + '</p>';
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:25px;">';
      html += '<div class="service-stat"><div class="value">' + data.stats.call_count + '</div><div class="label">Calls</div></div>';
      html += '<div class="service-stat"><div class="value">' + data.stats.success_rate + '%</div><div class="label">Success</div></div>';
      html += '<div class="service-stat"><div class="value">$' + data.stats.total_earnings.toFixed(3) + '</div><div class="label">Earned</div></div>';
      html += '<div class="service-stat"><div class="value">' + data.stats.avg_time_ms + 'ms</div><div class="label">Avg</div></div>';
      html += '</div>';
      
      if (data.stats.recent_results && data.stats.recent_results.length > 0) {
        html += '<h4 style="color:#888;margin:20px 0 10px;">Recent Results</h4>';
        data.stats.recent_results.forEach(r => { html += '<div class="result-preview">' + escapeHtml(r) + '</div>'; });
      }
      
      if (data.stats.errors && data.stats.errors.length > 0) {
        html += '<h4 style="color:#ff4444;margin:20px 0 10px;">Recent Errors</h4>';
        data.stats.errors.forEach(e => { html += '<div class="result-preview" style="border-left:3px solid #ff4444;">' + escapeHtml(e) + '</div>'; });
      }
      
      document.getElementById('modal-title').textContent = data.name.replace(/_/g, ' ');
      document.getElementById('modal-body').innerHTML = html;
      document.getElementById('modal').classList.add('active');
    }
    
    async function showJob(id) {
      const res = await fetch('/api/job/' + id);
      const job = await res.json();
      
      let html = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:15px;margin-bottom:20px;">';
      html += '<div><strong>Service:</strong> ' + job.service_name + '</div>';
      html += '<div><strong>Status:</strong> <span class="status-' + job.status + '">' + job.status + '</span></div>';
      html += '<div><strong>Cost:</strong> $' + job.cost + '</div>';
      html += '<div><strong>Time:</strong> ' + job.execution_time_ms + 'ms</div>';
      html += '<div><strong>Timestamp:</strong> ' + new Date(job.timestamp).toLocaleString() + '</div>';
      html += '</div>';
      
      if (job.goal) {
        html += '<h4 style="color:#888;margin:15px 0 10px;">Request</h4>';
        html += '<div class="result-preview">' + escapeHtml(job.goal) + '</div>';
      }
      if (job.result_preview) {
        html += '<h4 style="color:#888;margin:15px 0 10px;">Result</h4>';
        html += '<div class="result-preview">' + escapeHtml(job.result_preview) + '</div>';
      }
      if (job.error) {
        html += '<h4 style="color:#ff4444;margin:15px 0 10px;">Error</h4>';
        html += '<div class="result-preview" style="border-left:3px solid #ff4444;">' + escapeHtml(job.error) + '</div>';
      }
      
      document.getElementById('modal-title').textContent = 'Job #' + job.id;
      document.getElementById('modal-body').innerHTML = html;
      document.getElementById('modal').classList.add('active');
    }
    
    function escapeHtml(text) {
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    function closeModal() {
      document.getElementById('modal').classList.remove('active');
    }
    
    document.getElementById('modal').addEventListener('click', function(e) {
      if (e.target.id === 'modal') closeModal();
    });
    
    loadData();
    setInterval(loadData, 5000);
  </script>
</body>
</html>`;
  
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`[Dashboard] Running at http://localhost:${PORT}`);
});
