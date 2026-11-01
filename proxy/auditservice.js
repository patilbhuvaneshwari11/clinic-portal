// In-memory forensic audit log store for ClearShield
const auditLogs = [
  {
    id: 1,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: 'SYSTEM_READY',
    message: 'ClearShield Active Defense & Deception Security Middleware initialized. 5 engines engaged.',
    severity: 'INFO'
  }
];
function recordAuditLog(type, message, clientIp = 'internal', severity = 'INFO') {
  const logEntry = {
    id: auditLogs.length + 1,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: new Date().toISOString(),
    type,
    message,
    clientIp,
    severity
  };
  auditLogs.unshift(logEntry); // Keep latest at top
  if (auditLogs.length > 100) {
    auditLogs.pop(); // Cap at 100 items
  }
  return logEntry;
}
function getAuditLogs() {
  return auditLogs;
}
module.exports = {
  recordAuditLog,
  getAuditLogs
};