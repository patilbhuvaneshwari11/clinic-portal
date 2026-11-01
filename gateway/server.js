'use strict';

/**
 * ClearShield Security Gateway — server.js
 * =========================================
 * Sits between the Vite dev-server (or browser) and the FastAPI backend.
 *
 * Request flow:
 *   Browser → Vite(:5173) → Gateway(:3000) → FastAPI(:8000)
 *
 * Middleware chain (in order):
 *   1. VelocityBreaker  — rate-limits IPs, detects distributed bot hopping
 *   2. Tarpit           — stalls SQL-injection / scanner traffic
 *   3. MemorySanitizer  — scrubs decrypted data from res.locals after response
 *   4. Proxy            — forwards clean requests to FastAPI
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { GATEWAY_PORT, FASTAPI_ORIGIN } = require('./config/keys');
const velocityBreaker = require('./middleware/velocityBreaker');
const tarpitMiddleware = require('./middleware/tarpit');
const memorySanitizer  = require('./middleware/memorySanitizer');
const { recordAuditLog, getAuditLogs } = require('./services/auditService');

const app = express();

// ── Parse JSON bodies BEFORE middleware so tarpit can inspect req.body ────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Security middleware chain ─────────────────────────────────────────────────
app.use(velocityBreaker);   // 1. Rate limiting
app.use(tarpitMiddleware);  // 2. SQLi / scanner trap
app.use(memorySanitizer);   // 3. Post-response memory scrub

// ── Gateway audit log endpoint (internal use only) ───────────────────────────
// Exposes the in-memory ClearShield audit log at /gateway/audit-logs
// This is intentionally NOT proxied to FastAPI.
app.get('/gateway/audit-logs', (req, res) => {
  res.json(getAuditLogs());
});

app.get('/gateway/health', (req, res) => {
  res.json({
    status: 'ok',
    gateway: 'ClearShield Active Defense Gateway',
    upstream: FASTAPI_ORIGIN,
    timestamp: new Date().toISOString(),
  });
});

// ── Proxy: forward all /api/* traffic to FastAPI ─────────────────────────────
app.use(
  '/api',
  createProxyMiddleware({
    target: FASTAPI_ORIGIN,
    changeOrigin: true,
    on: {
      error: (err, req, res) => {
        console.error('[GATEWAY] Proxy error:', err.message);
        recordAuditLog('PROXY_ERROR', `Upstream unreachable: ${err.message}`, req.ip, 'ALARM');
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Bad Gateway',
            message: `Could not reach FastAPI backend at ${FASTAPI_ORIGIN}. Is it running?`,
          });
        }
      },
      proxyReq: (proxyReq, req) => {
        // Forward real IP to FastAPI so its audit logs show the actual client
        proxyReq.setHeader('X-Forwarded-For', req.ip || 'unknown');
        proxyReq.setHeader('X-Gateway', 'ClearShield/1.0');
      },
    },
  })
);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found on gateway.` });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(GATEWAY_PORT, () => {
  recordAuditLog('GATEWAY_START', `ClearShield Gateway started on port ${GATEWAY_PORT}. Upstream: ${FASTAPI_ORIGIN}`, 'internal', 'INFO');
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║       ClearShield Security Gateway  v1.0         ║');
  console.log('  ╠══════════════════════════════════════════════════╣');
  console.log(`  ║  Gateway    → http://localhost:${GATEWAY_PORT}             ║`);
  console.log(`  ║  Upstream   → ${FASTAPI_ORIGIN.padEnd(34)}║`);
  console.log('  ║  Engines    → VelocityBreaker, Tarpit, Sanitizer ║');
  console.log('  ║  Audit log  → GET /gateway/audit-logs            ║');
  console.log('  ║  Health     → GET /gateway/health                ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
});
