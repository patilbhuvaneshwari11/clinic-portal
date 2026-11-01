'use strict';

/**
 * ClearShield Gateway — Centralised configuration
 * All values are read from the .env file in the gateway root.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  // ── Gateway ────────────────────────────────────────────────────────────────
  GATEWAY_PORT: parseInt(process.env.GATEWAY_PORT || '3000', 10),
  FASTAPI_ORIGIN: process.env.FASTAPI_ORIGIN || 'http://localhost:8000',

  // ── Tarpit ─────────────────────────────────────────────────────────────────
  TARPIT_MAX_SOCKETS: parseInt(process.env.TARPIT_MAX_SOCKETS || '10', 10),
  TARPIT_TIMEOUT_MS: parseInt(process.env.TARPIT_TIMEOUT_MS || '30000', 10),
  TARPIT_TRICKLE_INTERVAL_MS: parseInt(process.env.TARPIT_TRICKLE_INTERVAL_MS || '4000', 10),

  // ── Velocity Breaker ───────────────────────────────────────────────────────
  VELOCITY_WINDOW_MS: parseInt(process.env.VELOCITY_WINDOW_MS || '3000', 10),
  VELOCITY_MAX_CALLS: parseInt(process.env.VELOCITY_MAX_CALLS || '3', 10),
  VELOCITY_LOCKOUT_MS: parseInt(process.env.VELOCITY_LOCKOUT_MS || '60000', 10),

  // ── Crypto ─────────────────────────────────────────────────────────────────
  MASTER_SECRET: process.env.MASTER_SECRET || 'fallback-dev-secret-replace-me',
};
