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
    recordAuditLog(
      'CRITICAL_BULK_EXPORT_COMPLETED',
      `[CRITICAL EVENT] Full Clinic Patient Data Export completed by Dr. Alistair Smith. Verified against log: "${result.matchedLog.activity}". Notification dispatched to Clinic Director.`,
      req.ip,
      'CRITICAL'
    );
    res.json({
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
});
module.exports = router;