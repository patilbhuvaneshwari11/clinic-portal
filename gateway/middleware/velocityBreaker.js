'use strict';

/**
 * ClearShield — Velocity Breaker (Rate Limiter)
 * Tracks requests per IP in a sliding window. When the threshold is exceeded,
 * the IP is locked out for a configurable period. Also detects distributed
 * IP-hopping / proxy-rotation bot patterns across multiple IPs.
 *
 * Adapted for gateway/middleware/ from the root velocityBreaker.js reference.
 */

const { VELOCITY_WINDOW_MS, VELOCITY_MAX_CALLS, VELOCITY_LOCKOUT_MS } = require('../config/keys');
const { recordAuditLog } = require('../services/auditService');

// Map<clientKey, { timestamps: number[], lockedUntil: number }>
const requestLog = new Map();
// Rolling list of recently locked IPs for bot-swarm detection
const recentLockedIps = [];

/**
 * Resolve the real client IP, honouring X-Forwarded-For set by Vite / a reverse proxy.
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const firstIp = forwarded.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  return req.headers['x-real-ip'] || req.ip || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
}

function velocityBreaker(req, res, next) {
  const clientIp = getClientIp(req);
  // Use the auth token as a key when present (catches token-reuse bots that rotate IPs)
  const clientKey = req.headers['authorization'] || clientIp;
  const now = Date.now();

  let record = requestLog.get(clientKey);
  if (!record) {
    record = { timestamps: [], lockedUntil: 0 };
    requestLog.set(clientKey, record);
  }

  // ── Active lockout ────────────────────────────────────────────────────────
  if (now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    console.error(`[CLEARSHIELD ALARM] Request from locked client: ${clientKey} (${remainingSec}s remaining).`);
    return res.status(429).json({
      error: `Velocity Breaker Engaged: client locked due to abnormal query frequency.`,
      clientIp: clientKey,
      remainingLockoutSeconds: remainingSec,
      mitigation: 'Session locked by ClearShield Active Defense.',
    });
  }

  // ── Sliding-window cleanup ────────────────────────────────────────────────
  record.timestamps = record.timestamps.filter((t) => now - t < VELOCITY_WINDOW_MS);

  // ── Threshold exceeded — engage lockout ───────────────────────────────────
  if (record.timestamps.length >= VELOCITY_MAX_CALLS) {
    record.lockedUntil = now + VELOCITY_LOCKOUT_MS;
    record.timestamps = [];

    console.error(`[CLEARSHIELD ALARM] Velocity Circuit Breaker tripped by: ${clientKey}`);

    // Track for distributed IP-hopping / proxy-rotation detection
    recentLockedIps.push({ ip: clientKey, timestamp: now });
    // Prune entries older than 20 s
    while (recentLockedIps.length > 0 && now - recentLockedIps[0].timestamp > 20000) {
      recentLockedIps.shift();
    }
    const distinctIps = [...new Set(recentLockedIps.map((e) => e.ip))];

    if (distinctIps.length >= 3) {
      recordAuditLog(
        'DISTRIBUTED_IP_HOPPING',
        `[BOT ESCALATION] Distributed IP-rotation bot detected across ${distinctIps.length} IPs (${distinctIps.join(', ')}). Global vault guard engaged.`,
        clientKey,
        'CRITICAL'
      );
    } else {
      recordAuditLog(
        'VELOCITY_BREAKER',
        `Abnormal query speed (>${VELOCITY_MAX_CALLS} calls/${VELOCITY_WINDOW_MS / 1000}s) from ${clientKey}. Locked for ${VELOCITY_LOCKOUT_MS / 1000}s.`,
        clientKey,
        'WARNING'
      );
    }

    return res.status(429).json({
      error: `Velocity Breaker Engaged: client locked for ${VELOCITY_LOCKOUT_MS / 1000} seconds.`,
      clientIp: clientKey,
      limit: `${VELOCITY_MAX_CALLS} requests per ${VELOCITY_WINDOW_MS / 1000}s`,
      remainingLockoutSeconds: Math.ceil(VELOCITY_LOCKOUT_MS / 1000),
      mitigation: 'Velocity Circuit Breaker tripped.',
    });
  }

  record.timestamps.push(now);
  next();
}

/** Reset all rate-limit state (useful for tests). */
function resetVelocityBreaker() {
  requestLog.clear();
  recentLockedIps.length = 0;
}

module.exports = velocityBreaker;
module.exports.resetVelocityBreaker = resetVelocityBreaker;
