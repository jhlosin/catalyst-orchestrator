/**
 * database.ts
 * SQLite database module for persistent logging
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, 'catalyst.db');

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    goal TEXT,
    category TEXT,
    agents_used TEXT,
    status TEXT,
    cost REAL,
    execution_time_ms INTEGER,
    result_summary TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_stats (
    agent_id TEXT PRIMARY KEY,
    agent_name TEXT,
    call_count INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    total_time_ms INTEGER DEFAULT 0,
    last_called_at TEXT
  );

  CREATE TABLE IF NOT EXISTS category_stats (
    category TEXT PRIMARY KEY,
    request_count INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0.0,
    last_requested_at TEXT
  );
`);

export interface RequestLog {
  id?: number;
  timestamp: Date;
  goal: string;
  category: string;
  agents_used: string[];
  status: 'success' | 'error';
  cost: number;
  execution_time_ms: number;
  result_summary: string;
  error?: string;
}

export interface AgentStat {
  agent_id: string;
  agent_name: string;
  call_count: number;
  total_cost: number;
  total_time_ms: number;
  last_called_at: Date;
}

export interface CategoryStat {
  category: string;
  request_count: number;
  total_cost: number;
  last_requested_at: Date;
}

/**
 * Save a request log to database
 */
export function saveRequestLog(log: RequestLog): void {
  const stmt = db.prepare(`
    INSERT INTO request_logs (timestamp, goal, category, agents_used, status, cost, execution_time_ms, result_summary, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.timestamp.toISOString(),
    log.goal,
    log.category,
    JSON.stringify(log.agents_used),
    log.status,
    log.cost,
    log.execution_time_ms,
    log.result_summary,
    log.error || null
  );

  // Update agent stats
  log.agents_used.forEach(agentId => {
    updateAgentStat(agentId, log.cost, log.execution_time_ms);
  });

  // Update category stats
  updateCategoryStat(log.category, log.cost);
}

/**
 * Update agent statistics
 */
function updateAgentStat(agentId: string, cost: number, timeMs: number): void {
  const existing = db.prepare(`SELECT * FROM agent_stats WHERE agent_id = ?`).get(agentId);

  if (existing) {
    db.prepare(`
      UPDATE agent_stats
      SET call_count = call_count + 1,
          total_cost = total_cost + ?,
          total_time_ms = total_time_ms + ?,
          last_called_at = ?
      WHERE agent_id = ?
    `).run(cost, timeMs, new Date().toISOString(), agentId);
  } else {
    db.prepare(`
      INSERT INTO agent_stats (agent_id, agent_name, call_count, total_cost, total_time_ms, last_called_at)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(agentId, agentId, cost, timeMs, new Date().toISOString());
  }
}

/**
 * Update category statistics
 */
function updateCategoryStat(category: string, cost: number): void {
  const existing = db.prepare(`SELECT * FROM category_stats WHERE category = ?`).get(category);

  if (existing) {
    db.prepare(`
      UPDATE category_stats
      SET request_count = request_count + 1,
          total_cost = total_cost + ?,
          last_requested_at = ?
      WHERE category = ?
    `).run(cost, new Date().toISOString(), category);
  } else {
    db.prepare(`
      INSERT INTO category_stats (category, request_count, total_cost, last_requested_at)
      VALUES (?, 1, ?, ?)
    `).run(category, cost, new Date().toISOString());
  }
}

/**
 * Get recent request logs
 */
export function getRecentLogs(limit: number = 50): RequestLog[] {
  const logs = db.prepare(`
    SELECT * FROM request_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as any[];

  return logs.map(log => ({
    ...log,
    timestamp: new Date(log.timestamp),
    agents_used: JSON.parse(log.agents_used),
    last_called_at: log.last_called_at ? new Date(log.last_called_at) : undefined
  }));
}

/**
 * Get agent statistics from DB (actual call data)
 */
export interface AgentStat {
  agent_id: string;
  agent_name: string;
  call_count: number;
  total_cost: number;
  total_time_ms: number;
  last_called_at: Date;
}

export function getAgentStats(): AgentStat[] {
  const stats = db.prepare(`
    SELECT * FROM agent_stats
    ORDER BY call_count DESC
  `).all() as any[];

  return stats.map(s => ({
    agent_id: s.agent_id,
    agent_name: s.agent_name || s.agent_id,
    call_count: s.call_count,
    total_cost: s.total_cost,
    total_time_ms: s.total_time_ms,
    last_called_at: new Date(s.last_called_at)
  }));
}

/**
 * Get all statistics
 */
export function getStats() {
  const totalRequests = db.prepare(`SELECT COUNT(*) as count FROM request_logs`).get() as { count: number };
  const successfulRequests = db.prepare(`SELECT COUNT(*) as count FROM request_logs WHERE status = 'success'`).get() as { count: number };

  const totalCost = db.prepare(`SELECT SUM(cost) as total FROM request_logs`).get() as { total: number | null };
  const avgTime = db.prepare(`SELECT AVG(execution_time_ms) as avg FROM request_logs`).get() as { avg: number | null };

  // Agent usage
  const agentUsage = db.prepare(`
    SELECT agent_id, agent_name, call_count
    FROM agent_stats
    ORDER BY call_count DESC
  `).all() as any[];

  // Category stats
  const categoryStats = db.prepare(`
    SELECT category, request_count
    FROM category_stats
    ORDER BY request_count DESC
  `).all() as any[];

  return {
    summary: {
      total_requests: totalRequests.count,
      successful: successfulRequests.count,
      failed: totalRequests.count - successfulRequests.count,
      success_rate: totalRequests.count > 0 ? ((successfulRequests.count / totalRequests.count) * 100).toFixed(1) : 0,
      total_earnings: (totalCost?.total || 0).toFixed(4),
      avg_execution_time_ms: Math.round(avgTime?.avg || 0),
      uptime: Math.round(process.uptime())
    },
    agent_usage: agentUsage,
    category_stats: categoryStats
  };
}

/**
 * Clean up old logs (older than 30 days)
 */
export function cleanupOldLogs(days: number = 30): void {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  db.prepare(`
    DELETE FROM request_logs
    WHERE timestamp < ?
  `).run(cutoff.toISOString());
}

export default db;
