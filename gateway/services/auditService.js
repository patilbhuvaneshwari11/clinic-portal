'use strict';

/**
 * ClearShield — In-Memory Forensic Audit Log Store
 * Adapted for gateway/services/ from the root auditservice.js reference.
 */

const auditLogs = [
  {
    id: 1,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: 'SYSTEM_READY',
    message: 'ClearShield Active Defense & Deception Security Gateway initialized. 3 engines engaged: VelocityBreaker, Tarpit, MemorySanitizer.',
    severity: 'INFO',
  },
];

/**
 * Append a new entry to the in-memory audit log.
 * @param {string} type        - Event type/code (e.g. 'TARPIT_ENGAGED')
 * @param {string} message     - Human-readable description
 * @param {string} clientIp    - Source IP address
 * @param {string} severity    - INFO | WARNING | ALARM | CRITICAL
 * @returns {object}           - The created log entry
 */
function recordAuditLog(type, message, clientIp = 'internal', severity = 'INFO') {
  const logEntry = {
    id: auditLogs.length + 1,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: new Date().toISOString(),
    type,
    message,
    clientIp,
    severity,
  };
  auditLogs.unshift(logEntry); // Keep latest at top
  if (auditLogs.length > 100) {
    auditLogs.pop(); // Cap at 100 entries
  }
  return logEntry;
}

/**
 * Return all audit log entries (newest first).
 * @returns {object[]}
 */
function getAuditLogs() {
  return auditLogs;
}

module.exports = { recordAuditLog, getAuditLogs };
