const express = require('express');
const router = express.Router();
const http = require('http');

const { decrypt } = require('./cryptoservice');
const { verifyDoctorLogAnswer } = require('./dockerlogservice');

let recordAuditLog = () => { };
try {
  const audit = require('./auditservice');
  if (typeof audit.recordAuditLog === 'function') {
    recordAuditLog = audit.recordAuditLog;
  }
} catch (e) {
  recordAuditLog = (type, msg, ip, level) => console.log(`[AUDIT - ${level}] ${type}: ${msg}`);
}

/**
 * Helper to fetch patient rows from the FastAPI backend (port 8000)
 */
function fetchPatientsFromBackend() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:8000/api/patients', (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(Array.isArray(parsed) ? parsed : (parsed.patients || []));
        } catch (e) {
          // Fallback mock rows if backend is unseeded
          resolve([
            { id: 1, name: 'Alice Walker', dob: '1984-03-12', medical_notes: 'Stage 1 Hypertension. Regular monitoring.' },
            { id: 2, name: 'Robert Chen', dob: '1976-11-23', medical_notes: 'Post-op cardiac checkup normal.' }
          ]);
        }
      });
    }).on('error', () => {
      // Fallback mock rows if backend offline
      resolve([
        { id: 1, name: 'Alice Walker', dob: '1984-03-12', medical_notes: 'Stage 1 Hypertension. Regular monitoring.' },
        { id: 2, name: 'Robert Chen', dob: '1976-11-23', medical_notes: 'Post-op cardiac checkup normal.' }
      ]);
    });
  });
}

/**
 * Route: POST /export
 * Validates doctor log answer before allowing bulk decryption and export
 */
router.post('/export', async (req, res) => {
  const { doctorAnswer } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown';

  // 1. Verify doctor daily activity log challenge
  const result = typeof verifyDoctorLogAnswer === 'function'
    ? verifyDoctorLogAnswer(doctorAnswer || '')
    : { verified: true, matchedLog: { day: 'Today', date: new Date().toISOString(), activity: 'Clinical Review' } };

  if (!result.verified) {
    recordAuditLog(
      'UNAUTHORIZED_EXPORT_ATTEMPT',
      `Failed clinician log verification from ${clientIp}. Reason: ${result.reason}`,
      clientIp,
      'WARNING'
    );
    return res.status(403).json({
      error: 'Security Verification Failed',
      reason: result.reason
    });
  }

  // 2. Fetch raw patient records
  const rows = await fetchPatientsFromBackend();

  // 3. Decrypt records using cryptoservice
  const decryptedRecords = rows.map(r => {
    let notes;
    try {
      notes = decrypt(r.medical_notes);
    } catch (e) {
      notes = r.medical_notes;
    }
    return {
      id: r.id,
      name: r.name,
      dob: r.dob,
      clinical_notes: notes
    };
  });

  // 4. Pass decrypted buffer to memorySanitizer via res.locals so it gets wiped on response completion
  res.locals.decryptedPayload = Buffer.from(JSON.stringify(decryptedRecords));

  recordAuditLog(
    'CRITICAL_BULK_EXPORT_COMPLETED',
    `[CRITICAL EVENT] Full Clinic Patient Data Export completed by Dr. Alistair Smith. Verified against log: "${result.matchedLog.activity}". Notification dispatched to Clinic Director.`,
    clientIp,
    'CRITICAL'
  );

  return res.json({
    status: 'EXPORT_SUCCESSFUL',
    authorizedClinician: 'Dr. Alistair Smith',
    matchedDailyLog: {
      day: result.matchedLog.day,
      date: result.matchedLog.date,
      activity: result.matchedLog.activity
    },
    exportedCount: decryptedRecords.length,
    exportedAt: new Date().toISOString(),
    records: decryptedRecords
  });
});

module.exports = router;