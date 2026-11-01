'use strict';

/**
 * ClearShield — AES-256-GCM Encryption Service
 * Adapted for gateway/services/ from the root cryptoservice.js reference.
 *
 * Format: <ivHex>:<authTagHex>:<ciphertextHex>
 */

const crypto = require('crypto');
const { MASTER_SECRET } = require('../config/keys');

const ALGORITHM = 'aes-256-gcm';
// Derive a fixed 32-byte key from the master secret using scrypt
const KEY = crypto.scryptSync(MASTER_SECRET, 'clearshield-salt', 32);

/**
 * Encrypt a plaintext string.
 * @param {string} text
 * @returns {string}  "<ivHex>:<tagHex>:<ciphertextHex>"
 */
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

/**
 * Decrypt a ciphertext string produced by encrypt().
 * @param {string} ciphertext  "<ivHex>:<tagHex>:<ciphertextHex>"
 * @returns {string}
 */
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format. Expected "<ivHex>:<tagHex>:<ciphertextHex>".');
  }
  const [ivHex, tagHex, content] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(content, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = { encrypt, decrypt };
