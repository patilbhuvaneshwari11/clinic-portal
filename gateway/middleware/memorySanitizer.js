'use strict';

/**
 * ClearShield — In-Memory Buffer Scrubber (Memory Sanitizer)
 * Clears any decrypted payloads or sensitive chart data stored in res.locals
 * after the response is sent, so they don't linger in the Node.js heap.
 *
 * Adapted for gateway/middleware/ from the root memorySanitizer.js reference.
 * No external dependencies — safe to use as-is.
 */

function memorySanitizer(req, res, next) {
  res.on('finish', () => {
    // Zero-fill and null any decrypted buffer held in res.locals
    if (res.locals && res.locals.decryptedPayload) {
      if (Buffer.isBuffer(res.locals.decryptedPayload)) {
        res.locals.decryptedPayload.fill(0);
      }
      res.locals.decryptedPayload = null;
    }

    // Null any sensitive chart / data object
    if (res.locals && res.locals.sensitiveChart) {
      res.locals.sensitiveChart = null;
    }
  });

  next();
}

module.exports = memorySanitizer;
