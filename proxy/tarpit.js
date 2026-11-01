const TARPIT_MAX_SOCKETS = 10;
const TARPIT_TIMEOUT_MS = 30000;         // Keep attacker stalled for 30 seconds
const TARPIT_TRICKLE_INTERVAL_MS = 2000; // Trickle 1 byte every 2 seconds

let recordAuditLog = () => { };
try {
  const audit = require('./auditservice');
  if (typeof audit.recordAuditLog === 'function') {
    recordAuditLog = audit.recordAuditLog;
  }
} catch (e) {
  recordAuditLog = (type, msg, ip, level) => console.log(`[AUDIT - ${level}] ${type}: ${msg}`);
}

const SQLI_REGEX = /(\b(UNION(\s+ALL)?|SELECT|INSERT|DELETE|UPDATE|DROP)\b|'|--|\/\*|\.\.\/)/i;
let activeTarpitCount = 0;

function tarpitMiddleware(req, res, next) {
  let decodedUrl = req.url;
  try {
    decodedUrl = decodeURIComponent(req.url);
  } catch (e) {
    // If malformed, keep raw
  }

  const bodyStr = JSON.stringify(req.body || '');
  const target = `${req.url} ${decodedUrl} ${bodyStr}`;

  if (SQLI_REGEX.test(target)) {
    const clientIp = req.headers['x-forwarded-for'] || req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';

    recordAuditLog('TARPIT_ENGAGED', `SQL Injection detected on ${req.path}. Attacker IP ${clientIp} stalled in chunked stream.`, clientIp, 'ALARM');

    if (activeTarpitCount >= TARPIT_MAX_SOCKETS) {
      console.warn(`[DEFENSE ALARM] Tarpit capacity reached (${activeTarpitCount}/${TARPIT_MAX_SOCKETS}). Blacklisting IP: ${clientIp}`);
      return res.status(403).json({ error: 'IP blacklisted due to malicious activity.' });
    }

    activeTarpitCount++;
    console.warn(`[DEFENSE ALARM] Malicious SQL/Scanner pattern detected from IP: ${clientIp}. Routing to Tarpit.`);

    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff'
    });

    let cleanedUp = false;
    const interval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(' '); // Trickle 1 byte every 2 seconds to stall automated tools
      }
    }, TARPIT_TRICKLE_INTERVAL_MS);

    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        clearInterval(interval);
        activeTarpitCount = Math.max(0, activeTarpitCount - 1);
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      if (!res.writableEnded) {
        res.end('\n[Session Terminated by ClearShield Engine]');
      }
    }, TARPIT_TIMEOUT_MS);

    res.on('close', () => {
      clearTimeout(timer);
      cleanup();
    });

    return;
  }

  next();
}

module.exports = tarpitMiddleware;