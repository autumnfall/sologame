#!/usr/bin/env node
/**
 * 在线排行榜参考服务器（零依赖 Node >= 18）。
 *
 * 用法：  node scripts/leaderboard-server.cjs [端口=8787]
 * 部署到任意有公网地址的主机后，把地址填进 src/ui/leaderboard.ts 的 LEADERBOARD_API
 * （如 http://your-host:8787），游戏端即可上传/拉取排行榜。
 * API：
 *   POST /submit  body = RunRecord JSON（按 clientId 去重，只保留最好成绩）
 *   GET  /board   -> RunRecord[]（耗时升序，前 10）
 * 数据持久化在同目录 leaderboard.json。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8787;
const FILE = path.join(__dirname, 'leaderboard.json');

function readBoard() {
  try {
    const list = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeBoard(list) {
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function merge(list, n = 10) {
  const best = new Map();
  for (const e of list) {
    if (!e || typeof e.ms !== 'number' || typeof e.name !== 'string') continue;
    const key = e.clientId || `${e.name}@${e.at ?? 0}`;
    const cur = best.get(key);
    if (!cur || e.ms < cur.ms) best.set(key, e);
  }
  return [...best.values()].sort((a, b) => a.ms - b.ms).slice(0, n);
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/board') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(merge(readBoard())));
    return;
  }
  if (req.method === 'POST' && url.pathname === '/submit') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      try {
        const rec = JSON.parse(body);
        if (typeof rec.ms !== 'number' || typeof rec.name !== 'string') throw new Error('bad record');
        rec.name = String(rec.name).slice(0, 24);
        writeBoard(merge([...readBoard(), rec], 1000));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`leaderboard server on :${PORT}`));
