'use strict';

/**
 * ClearShield — Tarpit Middleware
 * Detects SQL injection / path-traversal patterns and stalls the attacker
 * by holding the connection open with a slow chunked stream instead of
 * immediately closing it. This wastes attacker resources and buys time.
 *
 * Adapted for gateway/middleware/ from the root tarpit.js reference.
 * require('../config/keys') resolves to gateway/config/keys.js ✅
 * require('../services/auditService') resolves to gateway/services/auditService.js ✅
 */

const { TARPIT_MAX_SOCKETS, TARPIT_TIMEOUT_MS, TARPIT_TRICKLE_INTERVAL_MS } = require('../config/keys');
const { recordAuditLog } = require('../services/auditService');

// Regex covering common SQL injection tokens and path-traversal sequences
const SQLI_REGEX = /(\b(UNION(\s+ALL)?|SELECT|INSERT|DELETE|UPDATE|DROP)\b|'|--|\/\*|\.\.\/)/i;

let activeTarpitCount = 0;

function tarpitMiddleware(req, res, next) {
  let decodedUrl = req.url;
  try {
    decodedUrl = decodeURIComponent(req.url);
  } catch (e) {
    // Keep raw if malformed
  }

  const bodyStr = JSON.stringify(req.body || '');
  const target = `${req.url} ${decodedUrl} ${bodyStr}`;

  if (SQLI_REGEX.test(target)) {
    const clientIp = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';

    recordAuditLog(
      'TARPIT_ENGAGED',
      `SQL Injection / path-traversal detected on ${req.path}. Attacker IP ${clientIp} stalled in chunked stream.`,
      clientIp,
      'ALARM'
    );

    // Hard cap: if all tarpit slots are full, just block the IP immediately
    if (activeTarpitCount >= TARPIT_MAX_SOCKETS) {
      console.warn(
        `[CLEARSHIELD ALARM] Tarpit capacity reached (${activeTarpitCount}/${TARPIT_MAX_SOCKETS}). Blacklisting IP: ${clientIp}`
      );
      return res.status(403).json({ error: 'IP blacklisted due to malicious activity.' });
    }

    activeTarpitCount++;
    console.warn(
      `[CLEARSHIELD ALARM] Malicious SQLi/scanner pattern from ${clientIp}. Routing to Tarpit (${activeTarpitCount}/${TARPIT_MAX_SOCKETS} slots).`
    );

    // Send a 200 with chunked transfer — automated scanners keep the connection open
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
    });

    let cleanedUp = false;
    // Trickle 1 byte at the configured interval to stall the attacker
    const interval = setInterval(() => {
      if (!res.writableEnded) res.write(' ');
    }, TARPIT_TRICKLE_INTERVAL_MS);

    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        clearInterval(interval);
        activeTarpitCount = Math.max(0, activeTarpitCount - 1);
      }
    };

    // After max stall time, close the connection
    const timer = setTimeout(() => {
      cleanup();
      if (!res.writableEnded) {
        res.end('\n[Session Terminated by ClearShield Engine]');
      }
    }, TARPIT_TIMEOUT_MS);

    // If the attacker closes early, clean up resources
    res.on('close', () => {
      clearTimeout(timer);
      cleanup();
    });

    return; // Do NOT call next() — request is trapped
  }

  next();
}

module.exports = tarpitMiddleware;
