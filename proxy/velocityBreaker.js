const VELOCITY_WINDOW_MS = 3000; const VELOCITY_MAX_CALLS = 3; const VELOCITY_LOCKOUT_MS = 6000;
let recordAuditLog = () => { };
try {
  const audit = require('./auditservice');
  if (typeof audit.recordAuditLog === 'function') {
    recordAuditLog = audit.recordAuditLog;
  }
} catch (e) {
  recordAuditLog = (type, msg, ip, level) => console.log(`[AUDIT - ${level}] ${type}: ${msg}`);
}

const requestLog = new Map(); // Stores { timestamps: number[], lockedUntil: number }
const recentLockedIps = []; // Stores { ip: string, timestamp: number }

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
  const clientKey = req.headers['authorization'] || clientIp;
  const now = Date.now();

  let clientRecord = requestLog.get(clientKey);
  if (!clientRecord) {
    clientRecord = { timestamps: [], lockedUntil: 0 };
    requestLog.set(clientKey, clientRecord);
  }

  // Check if client is currently in lockout
  if (now < clientRecord.lockedUntil) {
    const remainingSec = Math.ceil((clientRecord.lockedUntil - now) / 1000);
    console.error(`[DEFENSE ALARM] Request from locked client IP: ${clientKey} (${remainingSec}s remaining in lockout)`);
    return res.status(429).json({
      error: `Velocity Breaker Engaged: IP ${clientKey} locked due to abnormal query frequency.`,
      clientIp: clientKey,
      remainingLockoutSeconds: remainingSec,
      mitigation: 'Session locked by ClearShield Active Defense.'
    });
  }

  // Filter timestamps within sliding window
  clientRecord.timestamps = clientRecord.timestamps.filter(t => now - t < VELOCITY_WINDOW_MS);

  if (clientRecord.timestamps.length >= VELOCITY_MAX_CALLS) {
    clientRecord.lockedUntil = now + VELOCITY_LOCKOUT_MS;
    clientRecord.timestamps = [];
    console.error(`[DEFENSE ALARM] Velocity Circuit Breaker tripped by IP: ${clientKey}`);

    // Track for IP hopping / distributed proxy rotation pattern
    recentLockedIps.push({ ip: clientKey, timestamp: now });
    // Clean entries older than 20 seconds
    while (recentLockedIps.length > 0 && now - recentLockedIps[0].timestamp > 20000) {
      recentLockedIps.shift();
    }
    const distinctBlockedIps = Array.from(new Set(recentLockedIps.map(entry => entry.ip)));

    if (distinctBlockedIps.length >= 3) {
      recordAuditLog(
        'DISTRIBUTED_IP_HOPPING',
        `[BOT ESCALATION] Distributed IP rotation / proxy hopping bot detected across ${distinctBlockedIps.length} IPs (${distinctBlockedIps.join(', ')}). Global vault guard engaged.`,
        clientKey,
        'CRITICAL'
      );
    } else {
      recordAuditLog(
        'VELOCITY_BREAKER',
        `Abnormal query speed (>3 calls/3s) detected from IP ${clientKey}. IP locked for 60s.`,
        clientKey,
        'WARNING'
      );
    }

    return res.status(429).json({
      error: `Velocity Breaker Engaged: IP ${clientKey} locked for 60 seconds.`,
      clientIp: clientKey,
      limit: `${VELOCITY_MAX_CALLS} requests per ${VELOCITY_WINDOW_MS / 1000}s`,
      remainingLockoutSeconds: 60,
      mitigation: 'Velocity Circuit Breaker tripped.'
    });
  }

  clientRecord.timestamps.push(now);
  next();
}

function resetVelocityBreaker() {
  requestLog.clear();
  recentLockedIps.length = 0;
}

module.exports = velocityBreaker;
module.exports.resetVelocityBreaker = resetVelocityBreaker;

