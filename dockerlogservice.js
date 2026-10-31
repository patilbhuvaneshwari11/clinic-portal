    if (matchedKeywords.length > 0) {
      return {
        verified: true,
        matchedLog: log,
        matchedText: log.activity,
        matchedKeywords,
        matchType: 'KEYWORD_MATCH'
      };
    }
    // 3. Synonym expansion matching for generic doctor answers
    // (e.g., doctor typed "medication refill" -> maps to "prescription review")
    for (const token of inputTokens) {
      const synonyms = clinicalSynonymMap[token];
      if (synonyms && synonyms.length > 0) {
        const hasMatch = synonyms.some(syn => log.keywords.includes(syn) || cleanActivity.includes(syn));
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