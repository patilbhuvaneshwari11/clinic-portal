/**
 * DockerLogService / Doctor Activity Log Step-Up Verification
 * Verifies that bulk patient export requests match logged clinical activities.
 */

// Daily logs for Dr. Alistair Smith
let doctorLogs = [
  { day: 'Day 1', date: '2026-10-31', activity: 'Morning triage and cardiac patient review', keywords: ['triage', 'cardiac', 'review', 'heart'] },
  { day: 'Day 2', date: '2026-11-01', activity: 'Prescription refills and post-op wound checks', keywords: ['refill', 'prescription', 'wound', 'checkup', 'medication'] },
  { day: 'Day 3', date: '2026-11-02', activity: 'Pediatric vaccinations and annual physicals', keywords: ['vaccine', 'pediatric', 'physical', 'annual'] }
];

const clinicalSynonymMap = {
  checkup: ['review', 'physical', 'check'],
  medication: ['refill', 'prescription'],
  exam: ['triage', 'physical']
};

function getDoctorLogs() {
  return doctorLogs;
}

function saveDoctorDailyLog(day, date, activity) {
  const keywords = activity.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  doctorLogs.push({ day, date, activity, keywords });
  return { success: true, count: doctorLogs.length };
}

function verifyDoctorLogAnswer(input) {
  if (!input || typeof input !== 'string') {
    return {
      verified: false,
      reason: 'No clinical activity summary was provided.'
    };
  }

  const cleanInput = input.trim().toLowerCase();
  const inputTokens = cleanInput.split(/\W+/).filter(t => t.length > 0);

  for (const log of doctorLogs) {
    const cleanActivity = log.activity.toLowerCase();

    // 1. Exact or substring match
    if (cleanActivity.includes(cleanInput) || cleanInput.includes(cleanActivity)) {
      return {
        verified: true,
        matchedLog: log,
        matchedText: log.activity,
        matchType: 'EXACT_SUBSTRING_MATCH'
      };
    }

    // 2. Keyword intersection match
    const matchedKeywords = inputTokens.filter(token => log.keywords && log.keywords.includes(token));
    if (matchedKeywords.length > 0) {
      return {
        verified: true,
        matchedLog: log,
        matchedText: log.activity,
        matchedKeywords,
        matchType: 'KEYWORD_MATCH'
      };
    }

    // 3. Synonym expansion matching
    for (const token of inputTokens) {
      const synonyms = clinicalSynonymMap[token];
      if (synonyms && synonyms.length > 0) {
        const hasMatch = synonyms.some(syn => (log.keywords && log.keywords.includes(syn)) || cleanActivity.includes(syn));
        if (hasMatch) {
          return {
            verified: true,
            matchedLog: log,
            matchedText: log.activity,
            matchedSynonym: token,
            matchType: 'GENERIC_SYNONYM_MATCH'
          };
        }
      }
    }
  }

  return {
    verified: false,
    reason: 'The entered activity does not match any of your 3 logged daily activities.'
  };
}

module.exports = {
  getDoctorLogs,
  saveDoctorDailyLog,
  verifyDoctorLogAnswer
};