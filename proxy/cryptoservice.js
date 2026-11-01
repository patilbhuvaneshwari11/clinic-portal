const crypto = require('crypto');

// Safe fallback for master secret key derivation
let MASTER_SECRET = process.env.MASTER_SECRET || 'clearshield-default-master-secret-32b';
try {
  const keys = require('../config/keys');
  if (keys && keys.MASTER_SECRET) {
    MASTER_SECRET = keys.MASTER_SECRET;
  }
} catch (err) {
  // Use fallback secret if config/keys is absent
}

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(MASTER_SECRET, 'salt', 32);

function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${enc}`;
}

function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }
  const [ivHex, tagHex, content] = parts;
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(content, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = { encrypt, decrypt };