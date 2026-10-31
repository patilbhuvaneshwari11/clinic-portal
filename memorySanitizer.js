/**
 * ClearShield In-Memory Buffer Scrubber
 * Scrubs decrypted memory, buffers, and cached sensitive charts upon response completion.
 */
function memorySanitizer(req, res, next) {
  res.on('finish', () => {
    if (res.locals && res.locals.decryptedPayload) {
      if (Buffer.isBuffer(res.locals.decryptedPayload)) {
        res.locals.decryptedPayload.fill(0);
      }
      res.locals.decryptedPayload = null;
    }
    if (res.locals && res.locals.sensitiveChart) {
      res.locals.sensitiveChart = null;
    }
  });

  next();
}

module.exports = memorySanitizer;
